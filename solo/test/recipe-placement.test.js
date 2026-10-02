import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import Structure, { createShelter, SHELTER_SIZE } from '../js/models/entities/immobile/Structure.js'
import { getRecipe } from '../js/models/crafting/Recipes.js'
import { GRANTED_RECIPES } from '../js/models/skills/SkillUnlocks.js'

// #120: `basic_shelter` was a recipe that made nothing. It carried `placeable: true`
// with the comment "Creates structure entity in world", and no line of code read the
// flag - the output object went into the pack like a flint knife, `capacity: 2`
// implied a storehouse that did not exist, and the world never gained a building.
// It was unreachable twice over as well: nothing in the unlock table granted it, and
// its frame asked for 20 grass, an item type no entity in the tree has ever yielded
// (grass is flora a browser eats; there is no `gather()` and no thatch).
//
// So these tests hold three promises: `placeable` means a Structure appears on the
// ground and nothing goes into the pack; the materials are ones a pawn can actually
// pick up; and both routes to a shelter - this one and the civic `build_structure`
// goal - raise the same kind of building through the same factory.

const MAP_SEED = 7

let serial = 0
function makeItem(type) {
  return { id: `rp${++serial}`, type, name: type, weight: 1, size: 1 }
}

function sheltersIn(world) {
  return Array.from(world.entitiesMap.values()).filter(entity => entity?.tags?.has?.('shelter'))
}

/**
 * A pawn who earned the knowledge the way the table says it is earned: she has seen a
 * building, which is what `construction_basics` asks for, and she carries the sticks,
 * fibre and cord the frame costs.
 */
function builder({ x = 120, y = 120, stick = 8, fiber = 4, cordage = 2, slots = 24 } = {}) {
  const world = new World(600, 600, { mapSeed: MAP_SEED })
  const pawn = new Pawn('p1', 'Ryla', x, y)
  world.addEntity(pawn)
  pawn.inventorySlots = slots
  pawn.maxSize = 120
  pawn.maxWeight = 120

  for (let i = 0; i < stick; i++) pawn.addItemToInventory(makeItem('stick'))
  for (let i = 0; i < fiber; i++) pawn.addItemToInventory(makeItem('fiber'))
  for (let i = 0; i < cordage; i++) pawn.addItemToInventory(makeItem('cordage'))

  pawn.observeStructure({ subtype: 'structure', tags: new Set(['structure', 'immobile']) })
  pawn.evaluateSkillUnlocks()

  return { world, pawn }
}

function packOf(pawn) {
  return pawn.inventory.map(item => item.type).sort().join(',')
}

function calm(pawn) {
  // These tests are about the craft. A starving pawn with other ideas is a different
  // subject (and is #128).
  for (const need of Object.keys(pawn.needs.needs)) pawn.needs.needs[need] = 0
}

// ------------------------------------------------------------------ the flag

test('a placeable recipe raises a building instead of a burden', () => {
  const { world, pawn } = builder()
  const recipe = getRecipe('basic_shelter')
  const before = world.entitiesMap.size
  const packBefore = pawn.inventory.length

  const result = pawn.craft(recipe)

  assert.ok(result, 'the craft did not fail')
  assert.strictEqual(result.subtype, 'structure', 'what came back is a building, not an item')
  assert.strictEqual(result.placed, true, 'and the caller can tell without re-reading the recipe')
  assert.strictEqual(world.entitiesMap.size, before + 1, 'the world gained exactly that entity')
  assert.ok(sheltersIn(world).includes(result), 'and it is in the world, not merely returned')
  // The pack is one building lighter, not one building heavier: the materials went
  // into the frame and nothing came back out of it.
  assert.strictEqual(pawn.inventory.length, packBefore - 14, 'the 14 sticks, fibres and cords were spent')
  assert.ok(!pawn.inventory.some(item => item.type === 'shelter'), 'a shelter in a pack is the bug this issue is about')
})

test('the shelter the recipe makes is the shelter the game means', () => {
  const { world, pawn } = builder()
  pawn.craft(getRecipe('basic_shelter'))

  const shelter = sheltersIn(world)[0]
  assert.ok(shelter instanceof Structure)
  assert.strictEqual(shelter.size, SHELTER_SIZE, 'one frame, one footprint')
  assert.strictEqual(shelter.ownerId, pawn.id, 'she knows whose it is')
  assert.ok(shelter.condition > 0 && shelter.condition <= shelter.maxCondition)
  assert.strictEqual(shelter.restBonus, 1.3, 'the recipe advertises a resting place; the entity has one')

  // The civic `build_structure` goal raises its shelter through the same factory, so
  // the two must not drift into two different buildings with two different sets of
  // numbers - that is how a fix to one quietly stops applying to the other.
  const built = createShelter({ id: 'civic', name: 'Civic Lean-to', x: 1, y: 1, ownerId: 'someone' })
  assert.deepStrictEqual(
    [...shelter.tags].sort(),
    [...built.tags].sort(),
    'both routes tag the same way, so anything that looks for `shelter` finds both'
  )
  assert.strictEqual(shelter.size, built.size)
})

test('crafting a shelter on crowded ground costs nothing', () => {
  const { world, pawn } = builder()
  world.addEntity(createShelter({ id: 'near', name: "Old Man's Lean-to", x: pawn.x + 4, y: pawn.y + 2 }))

  const pack = packOf(pawn)
  const entities = world.entitiesMap.size

  assert.strictEqual(pawn.craft(getRecipe('basic_shelter')), null, 'two lean-tos cannot share a spot')
  assert.strictEqual(world.entitiesMap.size, entities, 'and the attempt added no building')
  assert.strictEqual(packOf(pawn), pack, 'nor ate a single stick: a failed craft is not a purchase')
})

test('a full pack cannot stop a roof', () => {
  // #112 was about materials vanishing into a pack with no room. The shelter route had
  // the same shape: the old code handed the output to `addItemToInventory`, so a pawn
  // standing on an empty clearing with full hands could not build.
  const { world, pawn } = builder({ slots: 14 })
  assert.strictEqual(pawn.inventory.length, 14, 'the pack is exactly full')

  assert.ok(pawn.craft(getRecipe('basic_shelter')), 'the shelter went up anyway')
  assert.strictEqual(sheltersIn(world).length, 1)
})

test('a pawn remembers the roof she raised', () => {
  const { pawn } = builder()
  const shelter = pawn.craft(getRecipe('basic_shelter'))

  const remembered = pawn.memoryMap.find(entry => entry.type === 'shelter')
  assert.ok(remembered, 'the landmark is in her memory, so she can come back')
  assert.strictEqual(remembered.event, 'raised')
  assert.ok(Math.hypot(remembered.x - shelter.x, remembered.y - shelter.y) < 1)
})

// -------------------------------------------------------------- the materials

test('the frame is priced in materials the world has', () => {
  const recipe = getRecipe('basic_shelter')
  const types = recipe.requiredItems.map(req => req.type)

  // `grass` and `herb` have never been obtainable item types (#129). A recipe that
  // asks for them is not hard, it is impossible, and the difference matters: the pawn
  // spends a lifetime looking for something no entity in the game can give it.
  assert.ok(!types.includes('grass'), 'no grass: nothing gathers thatch')
  assert.ok(!types.includes('herb'), 'no herb: there is no herb plant in the tree')
  assert.deepStrictEqual(types, ['stick', 'fiber', 'cordage'], 'each of which a pawn can pick up or make')
})

test('the shelter recipe costs about what the civic build costs', () => {
  // `build_structure` has always raised this same lean-to for 8 sticks and 4 fibre.
  // Two cords of lashing is the difference between a frame propped against a branch
  // and one tied together; it should not also be the difference between a reachable
  // shelter and an unreachable one.
  const recipe = getRecipe('basic_shelter')
  const asked = Object.fromEntries(recipe.requiredItems.map(req => [req.type, req.count]))
  assert.deepStrictEqual(asked, { stick: 8, fiber: 4, cordage: 2 })
})

test('the book no longer holds a recipe nobody can learn', () => {
  assert.ok(GRANTED_RECIPES.includes('basic_shelter'), 'the unlock table grants it')

  const { pawn } = builder({ stick: 0, fiber: 0, cordage: 0 })
  assert.ok(pawn.unlocked.recipes.has('basic_shelter'), 'and a pawn who has seen a building gets it')
  assert.ok(pawn.getSkill('construction_basics') >= 1, 'the qualification arrives with the permission (#116)')
  assert.ok(pawn.unlocked.goals.has('craft_basic_shelter'), 'and so is the idea, not just the permission (#117)')
})

// ----------------------------------------------------------------- the factory

test('workmanship decides how long the frame stands', () => {
  const sloppy = createShelter({ id: 'a', name: 'A', x: 0, y: 0, quality: 0.5 })
  const average = createShelter({ id: 'b', name: 'B', x: 0, y: 0 })
  const skilled = createShelter({ id: 'c', name: 'C', x: 0, y: 0, quality: 2 })

  assert.ok(sloppy.maxCondition < average.maxCondition, 'a bad job rots sooner')
  assert.ok(skilled.maxCondition > average.maxCondition, 'a good job outlasts it')
  assert.strictEqual(average.maxCondition, 110, 'and the hand-built frame is exactly what it always was')
  assert.strictEqual(average.condition, average.maxCondition, 'a new building is not already broken')
})

// --------------------------------------------------------------- the goal path

test('the craft goal places the shelter rather than carrying it', async () => {
  const { world, pawn } = builder()
  calm(pawn)

  const goal = { type: 'craft_basic_shelter', recipeName: 'basic_shelter', priority: 2, description: 'raise a lean-to on the flat ground' }
  pawn.goals.goalQueue = pawn.goals.goalQueue.filter(candidate => candidate !== goal)
  pawn.goals.currentGoal = goal

  const packBefore = pawn.inventory.length
  // The executor loads the recipe book with a dynamic import, so the work lands on a
  // later microtask; pump the goal and let the queue drain between turns.
  for (let i = 0; i < 4 && pawn.goals.currentGoal; i++) {
    pawn.world.clock.currentTick++
    pawn.goals.updateGoalSpecificLogic()
    await new Promise(resolve => setImmediate(resolve))
  }

  assert.strictEqual(sheltersIn(world).length, 1, 'the goal put a building on the ground')
  assert.strictEqual(pawn.inventory.length, packBefore - 14, 'the materials went into the frame')
  assert.ok(!pawn.inventory.some(item => item.type === 'shelter'), 'and nothing was carried home')
  assert.notStrictEqual(pawn.goals.currentGoal, goal, 'the goal is finished, not retried forever')
})
