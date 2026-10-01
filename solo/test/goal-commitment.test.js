import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

function makePawn(name) {
  const world = new World(300, 300)
  const pawn = new Pawn(name, name, 140, 140)
  world.addEntity(pawn)
  return pawn
}

function committedGoal(startTick) {
  return {
    type: 'craft_cordage',
    priority: 1,
    description: 'Craft cordage from gathered fiber',
    targetType: 'activity',
    action: 'craft',
    startedAtTick: startTick,
    preemptible: false
  }
}

test('fresh routine goal is preemptible by urgent (p3) needs', () => {
  const pawn = makePawn('p-fresh')
  pawn.goals.currentGoal = committedGoal(pawn.world.clock.currentTick)

  assert.strictEqual(pawn.goals.getCommitmentCost(), 0)
  assert.strictEqual(
    pawn.goals.shouldPreemptForEmergencyNeed({ need: 'hunger', priority: 3 }),
    true
  )
})

test('committed goal resists urgent needs after one commitment step', () => {
  const pawn = makePawn('p-committed')
  const start = pawn.world.clock.currentTick
  pawn.goals.currentGoal = committedGoal(start - 60)

  assert.strictEqual(pawn.goals.getCommitmentCost(), 1)
  assert.strictEqual(
    pawn.goals.shouldPreemptForEmergencyNeed({ need: 'hunger', priority: 3 }),
    false
  )
  // Critical needs still preempt regardless of commitment
  assert.strictEqual(
    pawn.goals.shouldPreemptForEmergencyNeed({ need: 'thirst', priority: 4 }),
    true
  )
})

test('commitment cost is capped so deep investment does not lock out critical needs', () => {
  const pawn = makePawn('p-deep')
  pawn.goals.currentGoal = committedGoal(pawn.world.clock.currentTick - 10000)
  assert.strictEqual(pawn.goals.getCommitmentCost(), 1)
})

test('emergency and command goals never accrue commitment cost', () => {
  const pawn = makePawn('p-emergency')
  pawn.goals.currentGoal = { ...committedGoal(pawn.world.clock.currentTick - 500), preemptible: true }
  assert.strictEqual(pawn.goals.getCommitmentCost(), 0)

  pawn.goals.currentGoal = { ...committedGoal(pawn.world.clock.currentTick - 500), groupCommand: true }
  assert.strictEqual(pawn.goals.getCommitmentCost(), 0)
})

test('startGoal stamps investment clock and classifies preemptibility', () => {
  const pawn = makePawn('p-start')
  const tickBefore = pawn.world.clock.currentTick

  const routine = { type: 'socialize', priority: 1, description: 'Swap stories' }
  pawn.goals.startGoal(routine)
  assert.strictEqual(routine.startedAtTick, tickBefore)
  assert.strictEqual(routine.preemptible, false)

  const urgent = { type: 'find_water', priority: 3, description: 'Find water' }
  pawn.goals.startGoal(urgent)
  assert.strictEqual(urgent.preemptible, true)
})

test('preemption records a switch log entry with invested time', () => {
  const pawn = makePawn('p-log')
  const start = pawn.world.clock.currentTick
  pawn.goals.currentGoal = { ...committedGoal(start - 5), preemptible: true }

  pawn.needs.needs.thirst = 95
  pawn.needs.needs.hunger = 40
  pawn.needs.needs.energy = 20
  pawn.goals.evaluateAndSetGoals()

  assert.strictEqual(pawn.goals.currentGoal.type, 'find_water')
  const entry = pawn.goals.goalSwitchLog.at(-1)
  assert.ok(entry, 'expected a switch log entry')
  assert.strictEqual(entry.from, 'craft_cordage')
  assert.strictEqual(entry.reason, 'preempted_for_thirst')
  assert.strictEqual(entry.investedTicks, 5)
})

test('goal switch log is bounded', () => {
  const pawn = makePawn('p-cap')
  for (let i = 0; i < 40; i++) {
    pawn.goals.logGoalSwitch({ type: 'a', description: 'a' }, { type: 'b' }, `reason_${i}`)
  }
  assert.ok(pawn.goals.goalSwitchLog.length <= 12)
  assert.strictEqual(pawn.goals.goalSwitchLog.at(-1).reason, 'reason_39')
})

test('getGoalCommitmentDebug exposes stable goal state for the UI', () => {
  const pawn = makePawn('p-debug')
  assert.deepStrictEqual(pawn.goals.getGoalCommitmentDebug(), { active: false })

  pawn.goals.currentGoal = committedGoal(pawn.world.clock.currentTick - 70)
  const debug = pawn.goals.getGoalCommitmentDebug()
  assert.strictEqual(debug.active, true)
  assert.strictEqual(debug.preemptible, false)
  assert.ok(debug.investedTicks >= 70)
  assert.strictEqual(debug.commitmentCost, 1)
  assert.ok(Array.isArray(debug.recentSwitches))
})
