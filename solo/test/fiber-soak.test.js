import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import WaterSource from '../js/models/entities/resources/WaterSource.js'
import { RECIPES, getRecipe, canCraftRecipe } from '../js/models/crafting/Recipes.js'

// #121: nothing in play ever started a fibre soak, so `soaked_fiber` - the only
// input `durable_cordage` asks for - could not be obtained by any pawn, and the
// strongest cord in the game was a recipe about an ingredient that did not exist.
// The technique was finished (`startFiberSoakAtCache` queues a job, the cache
// converts it a day later); the caller was missing. These tests are about the
// caller: who decides to bury fibre, what stops them, and whether the fibre comes
// back soaked.
//
// Seed 7 is the dry map. The river seeds (4242, 2024, 555, 1234) stop a walking
// pawn at the bank, which is #125's problem, and a soak test that fails on a
// river is not testing the soak.

const MAP_SEED = 7

let serial = 0
function makeItem(type) {
  return { id: `sf${++serial}`, type, name: type, weight: 1, size: 1 }
}

/**
 * A weaver who has worked out that fibre can be rotted: two cords twisted is the
 * `soaking_pit` gate, so the knowledge arrives the way the table says it does
 * rather than being stapled onto the pawn.
 */
function weaver({ fibre = 6, water = true, pit = true, x = 120, y = 120, cordage = 2 } = {}) {
  const world = new World(600, 600, { mapSeed: MAP_SEED })
  const pawn = new Pawn('p1', 'Wyla', x, y)
  world.addEntity(pawn)
  pawn.inventorySlots = 20
  pawn.maxSize = 80
  pawn.maxWeight = 80

  for (let i = 0; i < fibre; i++) pawn.addItemToInventory(makeItem('fiber'))

  pawn.craftedCounts = { cordage }
  pawn.evaluateSkillUnlocks()

  if (water) world.addEntity(new WaterSource('water_1', 'Pool', x + 24, y))

  let cache = null
  if (pit) cache = pawn.createResourceCache({ x, y, purpose: 'fiber_soak', name: 'Soak Pit' })

  return { world, pawn, cache }
}

function soakGoals(pawn) {
  return pawn.goals.goalQueue.filter(goal => goal.type === 'soak_fiber')
}

// Run one goal to completion the way the goal driver does. The queue removal
// matters: `evaluateAndSetGoals` takes the goal out of the queue when it picks it
// (PawnGoals.js:193), and a harness that leaves it in place hands the pawn the
// same errand back again the moment it finishes, so it does the job twice.
function perform(pawn, goal, ticks = 30) {
  pawn.goals.goalQueue = pawn.goals.goalQueue.filter(candidate => candidate !== goal)
  pawn.goals.currentGoal = goal
  for (let i = 0; i < ticks && pawn.goals.currentGoal; i++) {
    pawn.world.clock.currentTick++
    pawn.goals.updateGoalSpecificLogic()
  }
  return pawn.goals.currentGoal
}

function calm(pawn) {
  // The chore is a long-term goal; a thirsty pawn is a pawn with other ideas, and
  // these tests are about the chore.
  for (const need of Object.keys(pawn.needs.needs)) pawn.needs.needs[need] = 0
}

// -------------------------------------------------------------- the knowledge

test('two cords twisted teaches the soak; one does not', () => {
  const { pawn } = weaver({ fibre: 0, water: false, pit: false })
  assert.ok(pawn.unlocked.recipes.has('durable_cordage'), 'the recipe is reachable in play')
  assert.ok(pawn.unlocked.goals.has('craft_durable_cordage'), 'and the pawn has the idea, not just the permission')

  const { pawn: novice } = weaver({ fibre: 0, water: false, pit: false, cordage: 1 })
  assert.ok(!novice.unlocked.recipes.has('durable_cordage'), 'one cord is not yet a reason to dig a pit')
})

test('durable cordage is no longer an orphan of the recipe book', () => {
  // The exemption list is a promise that a recipe is unreachable on purpose. Once
  // a driver exists the promise is false, and a stale exemption is how #115 hid.
  const recipe = getRecipe('durable_cordage')
  const soak = recipe.requiredItems.find(req => req.type === 'soaked_fiber')
  assert.ok(soak, 'the recipe still wants soaked fibre')
  assert.ok(RECIPES.includes(recipe))
})

// ---------------------------------------------------------------- the decision

test('a weaver with fibre, a pit and water decides to soak', () => {
  const { pawn, cache } = weaver()
  pawn.goals.addHouseholdGoals()

  const goals = soakGoals(pawn)
  assert.strictEqual(goals.length, 1)
  assert.strictEqual(goals[0].phase, 'stage')
  assert.strictEqual(goals[0].cacheId, cache.id)
  // Priority 2: below a real need, above an aspiration. It has to beat
  // `gather_materials` or the chore is another thing that never runs.
  assert.strictEqual(goals[0].priority, 2)
})

test('the chore waits for the knowledge', () => {
  const { pawn } = weaver({ cordage: 0 })
  assert.ok(!pawn.unlocked.recipes.has('durable_cordage'))
  pawn.goals.addHouseholdGoals()
  assert.strictEqual(soakGoals(pawn).length, 0, 'a pawn who does not know why has no reason to walk')
})

test('dry ground stops the soak', () => {
  const { pawn } = weaver({ water: false })
  pawn.goals.addHouseholdGoals()
  assert.strictEqual(soakGoals(pawn).length, 0)
  assert.match(pawn.recentAction ?? '', /no water/i)
})

test('a thin pack does not start a batch', () => {
  const { pawn } = weaver({ fibre: 2 })
  pawn.goals.addHouseholdGoals()
  assert.strictEqual(soakGoals(pawn).length, 0, 'three fibres is a batch and two is tomorrow')
})

test('one batch at a time', () => {
  const { pawn, cache } = weaver({ fibre: 6 })
  pawn.goals.addHouseholdGoals()
  perform(pawn, soakGoals(pawn)[0])

  assert.strictEqual(cache.soakJobs.length, 1)
  assert.ok(
    pawn.inventory.filter(item => item.type === 'fiber').length >= 3,
    'the pack still holds a whole second batch, so the guard is doing the work'
  )

  pawn.goals.addHouseholdGoals()
  assert.strictEqual(soakGoals(pawn).length, 0, 'a pit already soaking is a pit already working')
})

test('a pawn with no pit digs one where it stands by the water', () => {
  const { pawn, world } = weaver({ pit: false })
  pawn.goals.addHouseholdGoals()

  const goals = soakGoals(pawn)
  assert.strictEqual(goals.length, 1)
  assert.strictEqual(goals[0].phase, 'stage')
  assert.strictEqual(goals[0].cacheId, null, 'the pit is the thing that is missing')
  assert.deepStrictEqual(
    { x: goals[0].targetLocation.x, y: goals[0].targetLocation.y },
    { x: pawn.x, y: pawn.y }
  )

  perform(pawn, goals[0])
  const created = Array.from(world.entitiesMap.values()).find(entity => entity.subtype === 'cache')
  assert.ok(created, 'and digging it is part of the errand')
  assert.strictEqual(created.soakJobs.length, 1)
})

// ------------------------------------------------------------------ the labour

test('staging the fibre books a day-long job and ends the errand', () => {
  const { pawn, cache } = weaver({ fibre: 5 })
  const before = pawn.inventory.filter(item => item.type === 'fiber').length

  pawn.goals.addHouseholdGoals()
  const goal = soakGoals(pawn)[0]
  const remaining = perform(pawn, goal)

  assert.ok(!remaining, 'the goal completes rather than idling beside the pit')
  assert.strictEqual(cache.soakJobs.length, 1)
  assert.strictEqual(cache.soakJobs[0].quantity, 3)
  assert.strictEqual(
    cache.soakJobs[0].readyTick - cache.soakJobs[0].startTick,
    pawn.getDayTicks(),
    'the pit is worth a day of patience'
  )
  assert.strictEqual(cache.countByType('fiber'), 0, 'the fibre is in the ground, not on the shelf')
  assert.strictEqual(
    pawn.inventory.filter(item => item.type === 'fiber').length,
    before - 3,
    'and it came out of the pack'
  )
})

test('the pit hands the fibre back soaked after a day', () => {
  const { pawn, cache, world } = weaver({ fibre: 3 })
  pawn.goals.addHouseholdGoals()
  perform(pawn, soakGoals(pawn)[0])

  const dayTicks = pawn.getDayTicks()
  for (let tick = 1; tick <= dayTicks + 1; tick++) {
    world.clock.currentTick = tick
    cache.update(tick)
  }

  assert.strictEqual(cache.soakJobs.length, 0)
  assert.strictEqual(cache.countByType('soaked_fiber'), 3)
})

test('a ready batch is collected before another is stowed', () => {
  const { pawn, cache } = weaver({ fibre: 9 })
  for (let i = 0; i < 3; i++) cache.addItem(makeItem('soaked_fiber'), 1)

  pawn.goals.addHouseholdGoals()
  const goals = soakGoals(pawn)
  assert.strictEqual(goals.length, 1)
  assert.strictEqual(goals[0].phase, 'collect', 'fibre in the pack does some good; fibre in the pit does not')

  perform(pawn, goals[0])
  assert.strictEqual(pawn.inventory.filter(item => item.type === 'soaked_fiber').length, 3)
  assert.strictEqual(cache.countByType('soaked_fiber'), 0)
})

test('the errand is a walk, not a wave', () => {
  const { pawn, cache, world } = weaver({ fibre: 3 })
  cache.x = pawn.x + 60
  cache.y = pawn.y

  pawn.goals.addHouseholdGoals()
  const goal = soakGoals(pawn)[0]
  pawn.goals.goalQueue = pawn.goals.goalQueue.filter(candidate => candidate !== goal)
  pawn.goals.currentGoal = goal
  pawn.goals.updateGoalSpecificLogic()

  assert.strictEqual(cache.soakJobs.length, 0, 'a pit sixty units away cannot be filled from here')
  assert.strictEqual(pawn.nextTargetX, cache.x)
  assert.strictEqual(pawn.nextTargetY, cache.y)

  let staged = false
  for (let i = 0; i < 400 && !staged; i++) {
    calm(pawn)
    world.fastForwardTicks(1)
    staged = cache.soakJobs.length > 0
  }
  assert.ok(staged, 'and the errand is done when the pawn arrives')
  assert.strictEqual(cache.soakJobs[0].quantity, 3)
})

test('unattended, a weaver stages the soak, waits a day and brings the fibre back', () => {
  const { world, pawn, cache } = weaver({ fibre: 3 })
  // Outside the stowing radius, so the pawn has to cross the clearing to reach the
  // pit, but close enough that the errand is not at the mercy of the movement
  // planner (long walks across a river are #125's problem, not this one's).
  cache.x = pawn.x + 30

  // The shelter ambition is not the subject of this test, and in a bare world it
  // never resolves: `build_structure` hands the pawn to `stage_build_materials`,
  // which hunts for a stick that does not exist, and a pawn that never finishes a
  // goal never selects another one - so no other errand ever gets a turn. That
  // starvation is real and is #128. Switching the aspirations off here lets the
  // soak loop be seen closing by itself, which is what #121 was missing.
  pawn.goals.addLongTermGoals = () => {}
  pawn.goals.addLearningGoals = () => {}
  pawn.goals.addCivicNegotiationGoals = () => {}

  const dayTicks = pawn.getDayTicks()
  let staged = false
  let collected = false
  let carried = false
  for (let i = 0; i < dayTicks * 4 && !carried; i++) {
    calm(pawn)
    world.fastForwardTicks(1)
    // The debt is the honest trace of the two phases: staging opens it, coming back
    // for the batch closes it. Watching the current goal would miss a collect that
    // opens and finishes inside one tick.
    if (pawn.pendingSoak) staged = true
    else if (staged) collected = true
    carried = pawn.inventory.some(item => item.type === 'soaked_fiber')
  }

  assert.ok(staged, 'the pawn digs the pit in without being told')
  assert.ok(collected, 'and comes back for the fibre on its own')
  assert.ok(carried, 'the whole loop happens in the simulation, with nobody driving it')
  assert.strictEqual(cache.soakJobs.length, 0)
  assert.strictEqual(pawn.pendingSoak, null, 'and the debt is closed when the fibre is in the pack')
})

test('a pawn that wandered off still goes back for its batch', () => {
  const { pawn, cache, world } = weaver({ fibre: 3 })
  pawn.goals.addHouseholdGoals()
  perform(pawn, soakGoals(pawn)[0])

  assert.strictEqual(pawn.pendingSoak?.cacheId, cache.id, 'the pawn remembers who it owes')
  assert.strictEqual(pawn.pendingSoak.readyTick - world.clock.currentTick, pawn.getDayTicks())

  const dayTicks = pawn.getDayTicks()
  for (let tick = 1; tick <= dayTicks + 1; tick++) {
    world.clock.currentTick = tick
    cache.update(tick)
  }

  // Distance is the point. Goal proposals are rebuilt every tick, so a collect
  // errand that only showed up while the pawn was standing over the hole would
  // never be picked at all once the pawn had gone looking for something else.
  pawn.x = cache.x + 300
  pawn.y = cache.y + 240

  pawn.goals.addHouseholdGoals()
  const goals = soakGoals(pawn)
  assert.strictEqual(goals.length, 1)
  assert.strictEqual(goals[0].phase, 'collect')
  assert.strictEqual(goals[0].cacheId, cache.id)
})

// ------------------------------------------------------------------- the point

test('soaked fibre makes durable cordage craftable', () => {
  const { pawn } = weaver({ fibre: 0, water: false, pit: false })
  pawn.skills.weaving = 2
  for (let i = 0; i < 3; i++) pawn.addItemToInventory(makeItem('soaked_fiber'))

  const recipe = getRecipe('durable_cordage')
  assert.ok(canCraftRecipe(pawn, recipe), 'the recipe accepts the pawn now')

  const crafted = pawn.craft(recipe)
  assert.ok(crafted, 'and the strongest cord in the game can be made')
  assert.strictEqual(crafted.type, 'durable_cordage')
})

test('the chore has a branch and a behaviour, so the UI can say what it is', () => {
  const { pawn } = weaver({ fibre: 0, water: false, pit: false })
  assert.strictEqual(pawn.goals.getGoalBranch('soak_fiber'), 'civic')
  assert.strictEqual(pawn.goals.getBehaviorForGoal({ type: 'soak_fiber' }), 'hauling')
})
