import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import ResourceCache from '../js/models/entities/immobile/ResourceCache.js'
import { WORK_AT_TARGET_GOALS } from '../js/models/entities/mobile/PawnGoals.js'

// #132: "is the errand done" used to be a distance test. Touch `goal.target` and the
// goal completed - before the executor had been asked to do anything, because
// `checkGoalCompletion()` runs first inside `updateGoalProgress()`. A pawn that
// walked up to the build site it had been sent to stock booked a success, took its
// inclination signal for it, and staged nothing.
//
// The fix has three parts, and each has a test below: a goal whose planner states
// its own completion wins outright; work goals - the kind where the doing happens at
// the thing - are completed by their executor and not by arrival; and a target that
// has died or been picked clean ends the errand as a give-up instead of a win.
//
// The rule that is easy to get wrong is *ordering*: the lost-target check runs
// after the executor, so the pawn that harvested the last unit off a node is
// credited with that gather rather than punished for the empty stump beside it.

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PAWN_GOALS_SRC = readFileSync(
  path.join(HERE, '../js/models/entities/mobile/PawnGoals.js'), 'utf8'
)

function makeStageGoal(overrides = {}) {
  return {
    type: 'stage_build_materials',
    priority: 2,
    description: 'Stage missing build materials',
    targetType: 'location',
    targetLocation: { x: 300, y: 300 },
    requirements: [{ type: 'stick', count: 4 }],
    parentGoal: 'build_structure',
    ...overrides
  }
}

function makeWorld() {
  const world = new World(600, 600, { mapSeed: 11 })
  const pawn = new Pawn('Odla', 'odla', 300, 300)
  world.addEntity(pawn)
  return { world, pawn }
}

function makeCache(world, x, y, items = []) {
  const cache = new ResourceCache(`cache-${world.entitiesMap.size}`, 'cache', x, y, {
    purpose: 'build_site'
  })
  world.addEntity(cache)
  for (const item of items) cache.addItem(item, world.clock.currentTick)
  return cache
}

function beginGoal(pawn, goal) {
  pawn.goals.currentGoal = goal
  pawn.goals.startGoal(goal)
  pawn.goals.currentGoal = goal
  goal.target = goal.target ?? null
  return goal
}

function lastEnd(pawn, type) {
  return pawn.goals.completedGoals.findLast(entry => entry.type === type)
}

test('standing on an unstocked build cache is not a staged delivery', () => {
  const { world, pawn } = makeWorld()
  const cache = makeCache(world, 300, 300)
  const goal = beginGoal(pawn, makeStageGoal({ cacheId: cache.id }))
  goal.target = cache
  // Park the pawn exactly on the cache, which is the position the old test approved.
  pawn.x = cache.x
  pawn.y = cache.y
  pawn.size = 2

  assert.strictEqual(
    pawn.goals.checkGoalCompletion(), false,
    'a staging errand must not complete while the cache is still empty'
  )
})

test('the staging errand completes once the cache holds what it went to fetch', () => {
  const { world, pawn } = makeWorld()
  // A cache counts items, not units, and so does the staging job it belongs to.
  const cache = makeCache(world, 300, 300, [
    { type: 'stick', quantity: 1 },
    { type: 'stick', quantity: 1 },
    { type: 'stick', quantity: 1 },
    { type: 'stick', quantity: 1 }
  ])
  const goal = beginGoal(pawn, makeStageGoal({ cacheId: cache.id }))
  goal.target = cache

  assert.strictEqual(pawn.goals.checkGoalCompletion(), true)
})

test('a staged delivery that completes has actually moved the material', () => {
  const { world, pawn } = makeWorld()
  // The cache exists but is empty; the pawn is carrying the stick, so the only way
  // the errand can end in a success is by putting it down.
  const cache = makeCache(world, 306, 300)
  const goal = beginGoal(pawn, makeStageGoal({
    cacheId: cache.id,
    requirements: [{ type: 'stick', count: 1 }]
  }))
  goal.target = cache
  pawn.x = 306
  pawn.y = 300
  pawn.inventory.push({ type: 'stick', quantity: 1 })

  for (let i = 0; i < 40 && pawn.goals.currentGoal; i++) {
    world.clock.currentTick++
    pawn.goals.updateGoalProgress()
  }

  const end = lastEnd(pawn, 'stage_build_materials')
  assert.ok(end, 'the errand should have ended within 40 ticks')
  assert.strictEqual(end.endReason, 'completed')
  assert.strictEqual(cache.countByType('stick'), 1)
  assert.strictEqual(cache.hasItem?.('stick') ?? true, true)
})

test('work goals are not completed by arrival, place goals still are', () => {
  const { world, pawn } = makeWorld()
  const thing = { id: 'rock-1', x: 301, y: 300, size: 2 }
  pawn.x = 301
  pawn.y = 300

  const gather = beginGoal(pawn, {
    type: 'gather_specific',
    priority: 2,
    description: 'Gather a rock',
    targetType: 'entity',
    targetLocation: { x: 301, y: 300 }
  })
  gather.target = thing
  assert.strictEqual(
    pawn.goals.checkGoalCompletion(), false,
    'touching the rock is not having gathered it'
  )

  const eat = beginGoal(pawn, {
    type: 'find_food',
    priority: 3,
    description: 'Find food',
    targetType: 'entity',
    targetLocation: { x: 301, y: 300 }
  })
  eat.target = thing
  assert.strictEqual(
    pawn.goals.checkGoalCompletion(), true,
    'foraging is aimed at arriving, and the need system does the eating'
  )
})

test('a goal that states its own completion is the authority', () => {
  const { world, pawn } = makeWorld()
  const cache = makeCache(world, 300, 300)
  pawn.x = 300
  pawn.y = 300
  const seen = []
  const goal = beginGoal(pawn, makeStageGoal({ cacheId: cache.id }))
  goal.target = cache
  goal.completion = (g, p) => {
    seen.push([g.type, p.name])
    return false
  }

  assert.strictEqual(pawn.goals.checkGoalCompletion(), false)
  assert.deepStrictEqual(seen, [[goal.type, pawn.name]])

  goal.completion = () => true
  assert.strictEqual(pawn.goals.checkGoalCompletion(), true)
})

test('a target that has gone ends the errand as a give-up, not a win', () => {
  const { world, pawn } = makeWorld()
  const signals = []
  pawn.recordInclinationSignal = (branch, strength) => signals.push([branch, strength])

  const goal = beginGoal(pawn, {
    type: 'gather_specific',
    priority: 2,
    description: 'Gather a stick',
    targetType: 'entity',
    targetLocation: { x: 400, y: 400 }
  })
  goal.target = { id: 'stick-9', x: 400, y: 400, size: 2, isDead: true }
  const before = pawn.goals.completedGoals.length

  world.clock.currentTick++
  assert.strictEqual(pawn.goals.retireLostTarget(), true)
  assert.strictEqual(pawn.goals.currentGoal, null)

  const end = pawn.goals.completedGoals[before]
  assert.strictEqual(end.endReason, 'abandoned:target_lost')
  assert.deepStrictEqual(signals, [], 'a lost target must not pay an inclination signal')
  assert.strictEqual(pawn.goals.isGoalCooling('gather_specific'), true)
})

test('a resource a pawn has just picked clean still counts as a success', () => {
  const { world, pawn } = makeWorld()
  // `mark_target` writes the group mark and completes itself, all in the same call
  // that notices the target is gone. The executor runs first, so the mark is earned.
  const goal = beginGoal(pawn, {
    type: 'mark_target',
    priority: 2,
    description: 'Mark the threat',
    targetType: 'entity',
    targetLocation: { x: 320, y: 300 }
  })
  goal.target = { id: 'wolf-3', x: 320, y: 300, size: 3, isDead: true }

  world.clock.currentTick++
  pawn.goals.updateGoalProgress()

  const end = lastEnd(pawn, 'mark_target')
  assert.strictEqual(end?.endReason, 'completed')
  assert.ok(pawn.groupMarks?.length >= 1, 'the mark should have been recorded')
})

test('an errand aimed at a place cannot lose its target', () => {
  const { world, pawn } = makeWorld()
  const goal = beginGoal(pawn, {
    type: 'explore',
    priority: 1,
    description: 'Explore',
    targetType: 'location',
    targetLocation: { x: 100, y: 100 }
  })
  goal.target = null
  goal.targetId = 'somewhere-not-here'

  for (let i = 0; i < 10; i++) {
    world.clock.currentTick++
    pawn.goals.updateGoalProgress()
    assert.notStrictEqual(
      lastEnd(pawn, 'explore')?.endReason, 'abandoned:target_lost',
      'a bare location has nothing that can die'
    )
  }
})

test('every work goal has an executor branch that can end it', () => {
  // Denying arrival-completion to a type with no other exit would hand the pawn to
  // the #128 watchdog, which is a worse failure than the one being fixed. This test
  // is the contract that keeps the set honest.
  const orphans = [...WORK_AT_TARGET_GOALS].filter(
    type => !PAWN_GOALS_SRC.includes(`goal.type === '${type}'`)
  )
  assert.deepStrictEqual(
    orphans, [],
    `these goals deny arrival but have no executor branch: ${orphans.join(', ')}`
  )
})

test('the goals that three subsystems worked around are all in the set', () => {
  // #99 cleared `goal.target` on purpose, #121 refused the standing for the doing,
  // staging resolves its cache by id. They should not have to keep doing that.
  for (const type of ['travel_route', 'soak_fiber', 'stage_build_materials']) {
    assert.ok(WORK_AT_TARGET_GOALS.has(type), `${type} must be executor-owned`)
  }
})
