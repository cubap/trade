import test from 'node:test'
import assert from 'node:assert'
import Pawn from '../js/models/entities/mobile/Pawn.js'

function createWorldWith(...entities) {
  const world = {
    entitiesMap: new Map(),
    clock: { currentTick: 0 }
  }

  for (const entity of entities) {
    entity.world = world
    world.entitiesMap.set(entity.id, entity)
  }

  return world
}

test('Trust Decay - trust erodes over time', () => {
  const pawn1 = new Pawn('p1', 'Alice', 100, 100)
  const pawn2 = new Pawn('p2', 'Bob', 105, 105)
  const world = createWorldWith(pawn1, pawn2)

  pawn1.setGroupTrustIn(pawn2, 0.5)
  assert.strictEqual(pawn1.getGroupTrustIn(pawn2), 0.5)

  world.clock.currentTick = 200 // One decay period
  pawn1.applyTrustDecay()

  const decayedTrust = pawn1.getGroupTrustIn(pawn2)
  assert.ok(decayedTrust < 0.5, 'Trust should decay')
  assert.ok(decayedTrust >= 0.1, 'Trust should not decay below floor')
})

test('Trust Decay - trust at floor stays at floor', () => {
  const pawn1 = new Pawn('p1', 'Alice', 100, 100)
  const pawn2 = new Pawn('p2', 'Bob', 105, 105)
  const world = createWorldWith(pawn1, pawn2)

  pawn1.setGroupTrustIn(pawn2, 0.1) // At floor
  world.clock.currentTick = 200
  pawn1.applyTrustDecay()

  assert.strictEqual(pawn1.getGroupTrustIn(pawn2), 0.1, 'Trust at floor should stay at floor')
})

test('Trust Decay - no decay within period', () => {
  const pawn1 = new Pawn('p1', 'Alice', 100, 100)
  const pawn2 = new Pawn('p2', 'Bob', 105, 105)
  const world = createWorldWith(pawn1, pawn2)

  pawn1.setGroupTrustIn(pawn2, 0.5)
  world.clock.currentTick = 100 // Less than decay period (200)
  pawn1.applyTrustDecay()

  assert.strictEqual(pawn1.getGroupTrustIn(pawn2), 0.5, 'Trust should not decay within period')
})

test('Trust Decay - disabled decay has no effect', () => {
  const pawn1 = new Pawn('p1', 'Alice', 100, 100)
  const pawn2 = new Pawn('p2', 'Bob', 105, 105)
  const world = createWorldWith(pawn1, pawn2)

  pawn1.setGroupTrustIn(pawn2, 0.5)
  pawn1.trustDecayConfig.enabled = false
  world.clock.currentTick = 200
  pawn1.applyTrustDecay()

  assert.strictEqual(pawn1.getGroupTrustIn(pawn2), 0.5, 'Disabled decay should have no effect')
})

test('Branch Inclination - default values sum to 1.0', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const total = Object.values(pawn.branchInclination).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - 1.0) < 0.001, 'Default inclinations should sum to 1.0')
})

test('Branch Inclination - recording signal increases branch', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  const before = pawn.branchInclination.tribal
  pawn.recordInclinationSignal('tribal', 0.05)

  assert.ok(pawn.branchInclination.tribal > before, 'Tribal inclination should increase')
  const total = Object.values(pawn.branchInclination).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - 1.0) < 0.001, 'Inclinations should still sum to 1.0 after signal')
})

test('Branch Inclination - dominant branch reflects signals', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  // Record many tribal signals
  for (let i = 0; i < 10; i++) {
    pawn.recordInclinationSignal('tribal', 0.05)
  }

  assert.strictEqual(pawn.getDominantBranch(), 'tribal', 'Tribal should be dominant after many signals')
})

test('Branch Inclination - bias multiplier favors dominant branch goals', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  // Make tribal dominant
  for (let i = 0; i < 10; i++) {
    pawn.recordInclinationSignal('tribal', 0.05)
  }

  const tribalBias = pawn.getInclinationBias('hunt')
  const civicBias = pawn.getInclinationBias('build_structure')

  assert.ok(tribalBias > civicBias, 'Tribal goals should have higher bias when tribal is dominant')
  assert.ok(tribalBias > 1.0, 'Dominant branch goals should have bias > 1.0')
})

test('Branch Inclination - unknown goal type returns neutral bias', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)

  const bias = pawn.getInclinationBias('unknown_goal_type')
  assert.strictEqual(bias, 1.0, 'Unknown goal types should return neutral bias')
})

test('Serialization - Phase 0 state can be serialized and loaded', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const pawn2 = new Pawn('p2', 'Bob', 105, 105)
  const world = createWorldWith(pawn, pawn2)

  // Set up some state
  pawn.setGroupTrustIn(pawn2, 0.5)
  pawn.recordInclinationSignal('tribal', 0.1)
  pawn.homeLandmark = { x: 100, y: 100, sleepCount: 3, significance: 2 }

  // Serialize
  const state = pawn.serializePhase0State()

  assert.ok(state.groupTrust['p2'] === 0.5, 'Trust should be serialized')
  assert.ok(state.branchInclination.tribal > 0.33, 'Inclination should be serialized')
  assert.ok(state.homeLandmark.sleepCount === 3, 'Home landmark should be serialized')

  // Load into new pawn
  const newPawn = new Pawn('p1', 'Alice', 100, 100)
  newPawn.world = world
  newPawn.loadPhase0State(state)

  assert.strictEqual(newPawn.getGroupTrustIn(pawn2), 0.5, 'Trust should be loaded')
  assert.ok(newPawn.branchInclination.tribal > 0.33, 'Inclination should be loaded')
  assert.strictEqual(newPawn.homeLandmark?.sleepCount, 3, 'Home landmark should be loaded')
})

test('Serialization - loading null state has no effect', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const originalTrust = pawn.getGroupTrustIn('p2')

  pawn.loadPhase0State(null)

  assert.strictEqual(pawn.getGroupTrustIn('p2'), originalTrust, 'Loading null should have no effect')
})

test('Goal Selection - inclination bias affects goal weight', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  // Make tribal dominant
  for (let i = 0; i < 10; i++) {
    pawn.recordInclinationSignal('tribal', 0.05)
  }

  const tribalGoal = { type: 'hunt', priority: 2 }
  const civicGoal = { type: 'build_structure', priority: 2 }

  const tribalWeight = pawn.goals.getGoalWeight(tribalGoal)
  const civicWeight = pawn.goals.getGoalWeight(civicGoal)

  assert.ok(tribalWeight > civicWeight, 'Tribal goals should have higher weight when tribal is dominant')
})

test('Goal Completion - records inclination signal', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  const before = pawn.branchInclination.tribal

  // Simulate completing a tribal goal
  pawn.goals.currentGoal = { type: 'hunt', description: 'Hunt an animal' }
  pawn.goals.completeCurrentGoal()

  assert.ok(pawn.branchInclination.tribal >= before, 'Completing tribal goal should increase tribal inclination')
})

test('Goal Branch Mapping - goal types map to correct branches', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)

  assert.strictEqual(pawn.goals.getGoalBranch('hunt'), 'tribal')
  assert.strictEqual(pawn.goals.getGoalBranch('build_structure'), 'civic')
  assert.strictEqual(pawn.goals.getGoalBranch('trade'), 'mercantile')
  assert.strictEqual(pawn.goals.getGoalBranch('unknown_goal'), null)
})

test('Update Loop - trust decay is called in update', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const pawn2 = new Pawn('p2', 'Bob', 105, 105)
  const world = createWorldWith(pawn, pawn2)

  pawn.setGroupTrustIn(pawn2, 0.5)
  world.clock.currentTick = 0

  // Stub methods that try to add entities to world (not relevant to trust decay test)
  pawn.discoverNearbyCaches = () => {}
  pawn.processPonderingQueue = () => {}
  pawn.applyIdlePlanner = () => {}

  // Simulate multiple ticks
  for (let tick = 0; tick < 300; tick++) {
    world.clock.currentTick = tick
    pawn.update(tick)
  }

  const finalTrust = pawn.getGroupTrustIn(pawn2)
  assert.ok(finalTrust < 0.5, 'Trust should decay over multiple update ticks')
  assert.ok(finalTrust >= 0.1, 'Trust should not decay below floor')
})
