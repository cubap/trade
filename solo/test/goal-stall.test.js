import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

// #128: a pawn that takes a goal which can never finish has to be able to stop
// taking it. The repro in the report is a build started where there are no sticks:
// the staging errand scans the map, finds nothing, re-aims at a fresh random point,
// and owns the pawn for the rest of the game - because a goal is only ever replaced
// when there is not one, so whatever a pawn is standing inside is load-bearing.
//
// These tests pin the three halves of the fix: the give-up itself, the cooldown
// that stops the same unrunnable errand being handed straight back, and the two
// things the give-up must never touch - a plan that is genuinely working, and a need.

function makeStageGoal(overrides = {}) {
  return {
    type: 'stage_build_materials',
    priority: 2,
    description: 'Stage missing build materials',
    targetType: 'location',
    targetLocation: { x: 300, y: 300 },
    requirements: [{ type: 'stick', count: 8 }],
    parentGoal: 'build_structure',
    ...overrides
  }
}

function bareWorld() {
  // A map with no resource entities at all: nothing in it can ever yield a stick,
  // which is the situation the pawn in the report could not escape.
  const world = new World(600, 600, { mapSeed: 7 })
  const pawn = new Pawn('Gerta', 'gerta', 300, 300)
  world.addEntity(pawn)
  return { world, pawn }
}

// Pin both stall clocks `ticksAgo` ticks in the past and snapshot the tokens they
// compare against, so the watchdog is being asked about a pawn that has provably
// done nothing rather than about whatever a real executor decides to do on the way.
function freeze(pawn, goal, ticksAgo) {
  const tick = pawn.goals.currentTick()
  goal.progressToken = pawn.goals.goalMotionToken(goal)
  goal.counterToken = pawn.goals.goalCounterToken(goal)
  goal.lastProgressTick = tick - ticksAgo
  goal.lastCounterTick = tick - ticksAgo
}

test('a stage job with no material in the world gives up rather than searching forever', () => {
  const { world, pawn } = bareWorld()
  const goal = makeStageGoal()
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)

  world.fastForwardTicks(30)

  const stall = pawn.goals.stalledGoals.find(entry => entry.type === 'stage_build_materials')
  assert.ok(stall, `expected the stage job to be given up, saw ${JSON.stringify(pawn.goals.stalledGoals)}`)
  assert.strictEqual(stall.reason, 'material_absent')

  const abandoned = pawn.goals.completedGoals.findLast(
    entry => entry.type === 'stage_build_materials'
  )
  assert.strictEqual(abandoned.endReason, 'abandoned:material_absent')

  assert.notStrictEqual(pawn.goals.currentGoal?.type, 'stage_build_materials')
  assert.match(pawn.recentAction, /Gave up on/)
})

test('giving up on an errand cools down the plan that was waiting on it', () => {
  const { world, pawn } = bareWorld()
  const goal = makeStageGoal()
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)

  world.fastForwardTicks(30)

  // The child and its parent both, because `build_structure` re-creates the staging
  // job on the spot: cooling only the child would put the pawn back in the same trap
  // one tick later, which is the monopoly the issue is about.
  assert.strictEqual(pawn.goals.isGoalCooling('stage_build_materials'), true)
  assert.strictEqual(pawn.goals.isGoalCooling('build_structure'), true)

  const before = pawn.goals.stalledGoals.length
  for (let i = 0; i < 60; i++) {
    world.clock.currentTick++
    pawn.goals.evaluateAndSetGoals()
    assert.notStrictEqual(
      pawn.goals.currentGoal?.type,
      'stage_build_materials',
      'a cooled goal type must not be picked back up while it is in the dog house'
    )
  }
  assert.strictEqual(pawn.goals.stalledGoals.length, before)
})

test('a build handed the cooled errand admits it cannot be built', () => {
  const { world, pawn } = bareWorld()
  const goal = makeStageGoal()
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)
  world.fastForwardTicks(30)

  // Direct assignment, bypassing the scheduler: the way the build plan actually
  // starts its staging job, so the cooldown has to be honoured there too.
  const build = {
    type: 'build_structure',
    priority: 1,
    description: 'Raise a shelter frame',
    targetType: 'location',
    targetLocation: { x: 300, y: 300 }
  }
  pawn.goals.currentGoal = build
  pawn.goals.startGoal(build)
  world.fastForwardTicks(10)

  const entry = pawn.goals.completedGoals.findLast(
    goal => goal.type === 'build_structure'
  )
  assert.strictEqual(entry?.endReason, 'abandoned:materials_unreachable')
  assert.ok(
    pawn.goals.stalledGoals.some(
      s => s.type === 'build_structure' && s.reason === 'materials_unreachable'
    ),
    `expected the frame to be given up, saw ${JSON.stringify(pawn.goals.stalledGoals)}`
  )
})

test('the cooldown expires, so a missing material is not give-up-forever', () => {
  const { world, pawn } = bareWorld()
  const goal = makeStageGoal()
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)
  world.fastForwardTicks(30)

  assert.strictEqual(pawn.goals.isGoalCooling('stage_build_materials'), true)
  const strikes = pawn.goals.goalCooldowns.get('stage_build_materials').strikes
  assert.ok(strikes >= 1)

  // A second failure refuses the plan for twice as long.
  const waited = pawn.goals.coolGoalType('stage_build_materials')
  assert.ok(
    pawn.goals.goalCooldowns.get('stage_build_materials').untilTick - world.clock.currentTick >= waited
  )

  world.clock.currentTick += waited + 1
  assert.strictEqual(pawn.goals.isGoalCooling('stage_build_materials'), false)
})

test('a goal that keeps making headway is never cut short', () => {
  const { world, pawn } = bareWorld()
  // `explore` has no duration and no target object, so nothing inside it can
  // complete it: it survives purely because the watchdog approves.
  const goal = {
    type: 'explore',
    priority: 1,
    description: 'Wander and observe',
    targetType: 'location',
    action: 'explore'
  }
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)

  const lifetime = pawn.goals.goalStallLimits(goal).lifetime
  assert.ok(lifetime > 0)

  for (let i = 0; i < lifetime + 60; i++) {
    world.clock.currentTick++
    // Steady headway: something in the pack, most recently on this tick.
    goal.stagedCount = i
    pawn.goals.updateGoalProgress()
    assert.strictEqual(pawn.goals.currentGoal, goal, `healthy goal was culled at ${i} ticks`)
  }
  assert.strictEqual(pawn.goals.stalledGoals.length, 0)
})

test('a pawn that gets nowhere at all is cut off by the motion budget', () => {
  const { world, pawn } = bareWorld()
  const goal = {
    type: 'chase_the_weather',
    priority: 1,
    description: 'Chase the weather',
    targetType: 'location'
  }
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)

  const { budget } = pawn.goals.goalStallLimits(goal)
  // Both clocks pinned short of the limit: the pawn is not moving and nothing is
  // being achieved, but its patience has not run out yet.
  freeze(pawn, goal, budget - 1)
  assert.strictEqual(pawn.goals.checkGoalStall(), false)
  assert.strictEqual(pawn.goals.currentGoal, goal)

  freeze(pawn, goal, budget)
  assert.strictEqual(pawn.goals.checkGoalStall(), true)
  assert.strictEqual(pawn.goals.stalledGoals.at(-1)?.reason, 'no_progress')
  assert.strictEqual(pawn.goals.completedGoals.at(-1).endReason, 'abandoned:no_progress')
  // And the type that wasted its time is not handed straight back.
  assert.strictEqual(pawn.goals.isGoalCooling('chase_the_weather'), true)
})

test('walking for ever is not the same as working', () => {
  const { world, pawn } = bareWorld()
  const goal = {
    type: 'watch_the_horizon',
    priority: 1,
    description: 'Watch the horizon',
    targetType: 'location'
  }
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)

  const { lifetime } = pawn.goals.goalStallLimits(goal)
  for (let i = 0; i < lifetime + 10; i++) {
    world.clock.currentTick++
    // Genuine travel across coarse buckets, zero headway: the busy-looking half of
    // the report, where the pawn never stops moving and never stops doing it.
    pawn.x = 20 + ((i * 71) % 540)
    pawn.goals.updateGoalProgress()
    if (pawn.goals.currentGoal !== goal) break
  }

  assert.strictEqual(pawn.goals.stalledGoals.at(-1)?.reason, 'no_headway')
})

test('a command gets more rope than a whim, and still runs out of it', () => {
  const { world, pawn } = bareWorld()
  const routine = { type: 'gather_materials', description: 'Gather resources' }
  const asked = {
    type: 'gather_materials',
    description: 'Gather resources for the group',
    groupCommand: true
  }

  const routineLimits = pawn.goals.goalStallLimits(routine)
  const commandLimits = pawn.goals.goalStallLimits(asked)
  assert.ok(commandLimits.budget > routineLimits.budget)
  assert.strictEqual(commandLimits.budget, routineLimits.budget * 4)

  // More rope is not a free pass: the leash is four times as long and then it is
  // still a leash, because the complaint in the report was that nothing ever ended.
  const order = {
    type: 'chase_the_weather',
    priority: 1,
    description: 'Chase the weather',
    targetType: 'location',
    groupCommand: true
  }
  pawn.goals.currentGoal = order
  pawn.goals.startGoal(order)

  freeze(pawn, order, commandLimits.budget - 1)
  assert.strictEqual(pawn.goals.checkGoalStall(), false)
  assert.strictEqual(pawn.goals.currentGoal, order, 'a command was dropped early')

  freeze(pawn, order, commandLimits.budget)
  assert.strictEqual(pawn.goals.checkGoalStall(), true)
  assert.notStrictEqual(pawn.goals.currentGoal, order, 'a command lasted for ever')
})

test('needs outrank the dog house', () => {
  const { world, pawn } = bareWorld()
  pawn.goals.coolGoalType('find_water')
  assert.strictEqual(pawn.goals.isGoalCooling('find_water'), true)

  pawn.needs.needs.thirst = 95
  pawn.goals.currentGoal = null
  pawn.goals.evaluateAndSetGoals()

  // A pawn that keeps failing to find water must keep looking for water. The
  // alternative is a pawn that starves politely because of a bookkeeping rule.
  assert.strictEqual(pawn.goals.currentGoal?.type, 'find_water')
  assert.strictEqual(pawn.goals.isEmergencyGoal(pawn.goals.currentGoal), true)
})

test('the give-up clock is visible to the quest panel', () => {
  const { world, pawn } = bareWorld()
  assert.deepStrictEqual(pawn.goals.getGoalCommitmentDebug(), { active: false })

  const goal = {
    type: 'chase_the_weather',
    priority: 1,
    description: 'Chase the weather',
    targetType: 'location'
  }
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)
  freeze(pawn, goal, 40)

  const debug = pawn.goals.getGoalCommitmentDebug()
  assert.strictEqual(debug.active, true)
  assert.strictEqual(debug.sinceHeadwayTicks, 40)
  assert.strictEqual(debug.sinceProgressTicks, 40)
  assert.strictEqual(debug.stallBudget, pawn.goals.goalStallLimits(goal).budget)
  assert.ok(debug.stallLifetime > debug.stallBudget)
  assert.ok(Array.isArray(debug.recentAbandons))

  pawn.goals.abandonCurrentGoal('no_headway')
  assert.notStrictEqual(pawn.goals.currentGoal, goal)
  assert.strictEqual(pawn.goals.stalledGoals.at(-1).reason, 'no_headway')
})
