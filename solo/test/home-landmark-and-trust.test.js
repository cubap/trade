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

function createCoverEntity(id, x, y) {
  return {
    id,
    x,
    y,
    type: 'entity',
    tags: ['cover'],
    world: null
  }
}

test('Home Landmark - first sleep establishes initial home location', () => {
  const pawn = new Pawn('p1', 'Sleeper', 100, 100)
  const world = createWorldWith(pawn, createCoverEntity('cover1', 105, 105))

  pawn.registerRestOutcome()

  assert.ok(pawn.homeLandmark)
  assert.strictEqual(pawn.homeLandmark.sleepCount, 1)
  assert.strictEqual(pawn.homeLandmark.x, 100) // 100 quantized to 10-unit grid
  assert.strictEqual(pawn.homeLandmark.y, 100)
})

test('Home Landmark - sleeping at same location increases sleep count', () => {
  const pawn = new Pawn('p1', 'Sleeper', 100, 100)
  const world = createWorldWith(pawn, createCoverEntity('cover1', 105, 105))

  pawn.registerRestOutcome()
  const firstHome = { ...pawn.homeLandmark }

  // Move slightly (within 5-unit tolerance) and sleep again
  pawn.x = 103
  pawn.y = 102
  world.clock.currentTick = 100
  pawn.registerRestOutcome()

  assert.strictEqual(pawn.homeLandmark.sleepCount, 2)
  assert.strictEqual(pawn.homeLandmark.x, firstHome.x)
  assert.strictEqual(pawn.homeLandmark.y, firstHome.y)
})

test('Home Landmark - moving far resets home location tracking', () => {
  const pawn = new Pawn('p1', 'Sleeper', 100, 100)
  const cover1 = createCoverEntity('cover1', 105, 105)
  const cover2 = createCoverEntity('cover2', 200, 200)
  const world = createWorldWith(pawn, cover1, cover2)

  pawn.registerRestOutcome()
  const firstHome = pawn.homeLandmark.x

  // Move far away and sleep
  pawn.x = 200
  pawn.y = 200
  world.clock.currentTick = 100
  pawn.registerRestOutcome()

  assert.notStrictEqual(pawn.homeLandmark.x, firstHome)
  assert.strictEqual(pawn.homeLandmark.sleepCount, 1)
})

test('Home Landmark - becomes significant after 3+ reuses', () => {
  const pawn = new Pawn('p1', 'Sleeper', 100, 100)
  const world = createWorldWith(pawn, createCoverEntity('cover1', 105, 105))

  for (let i = 0; i < 3; i++) {
    pawn.registerRestOutcome()
    world.clock.currentTick += 100
  }

  assert.strictEqual(pawn.homeLandmark.sleepCount, 3)
  assert.strictEqual(pawn.homeLandmark.significance, 2)
})

test('Proximity Trust - sleeping near other pawns builds mutual trust', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, cover)

  // Both sleep near each other
  p1.registerRestOutcome()
  p2.registerRestOutcome()

  const trustP1ToP2 = p1.getGroupTrustIn(p2)
  const trustP2ToP1 = p2.getGroupTrustIn(p1)

  assert.ok(trustP1ToP2 > 0, 'P1 should have positive trust in P2')
  assert.ok(trustP2ToP1 > 0, 'P2 should have positive trust in P1')
  assert.ok(trustP1ToP2 >= 0.08, 'Trust should be at least base amount (0.08)')
})

test('Proximity Trust - multiple nights increase trust gradually', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, cover)

  // Sleep together multiple times
  for (let i = 0; i < 3; i++) {
    p1.registerRestOutcome()
    p2.registerRestOutcome()
    world.clock.currentTick += 100
  }

  const finalTrust = p1.getGroupTrustIn(p2)

  assert.ok(finalTrust >= 0.24, 'Trust should accumulate over multiple nights')
})

test('Proximity Trust - pawns too far apart do not gain trust', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 200, 200) // 141+ units away
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, cover)

  p1.registerRestOutcome()
  p2.registerRestOutcome()

  const trustP1ToP2 = p1.getGroupTrustIn(p2)

  assert.strictEqual(trustP1ToP2, 0, 'Distant pawns should not gain trust from proximity')
})

test('Civic Group Formation Trigger - detects 3+ pawns with trust + home overlap', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const p3 = new Pawn('p3', 'Carol', 105, 115)
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, p3, cover)

  // Sleep together multiple times to build trust and establish home
  for (let i = 0; i < 3; i++) {
    p1.registerRestOutcome()
    p2.registerRestOutcome()
    p3.registerRestOutcome()
    world.clock.currentTick += 100
  }

  const trigger = p1.checkCivicGroupFormationTrigger()

  assert.ok(trigger, 'Should detect civic group formation possibility')
  assert.strictEqual(trigger.type, 'civic')
  assert.strictEqual(trigger.members.length, 3)
  assert.ok(trigger.baseTrust >= 0.2, 'Base trust should be reasonable')
})

test('Civic Group Formation Trigger - requires trust >= 0.3', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, cover)

  // Only one sleep = not enough trust
  p1.registerRestOutcome()
  p2.registerRestOutcome()

  const trigger = p1.checkCivicGroupFormationTrigger()

  assert.strictEqual(trigger, null, 'Should not trigger with insufficient trust')
})

test('Civic Group Formation Trigger - requires home location overlap', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const p3 = new Pawn('p3', 'Carol', 500, 500) // Far away
  const cover1 = createCoverEntity('cover1', 105, 105)
  const cover3 = createCoverEntity('cover3', 505, 505)

  const world = createWorldWith(p1, p2, p3, cover1, cover3)

  // p1 and p2 build trust together; p3 far away
  for (let i = 0; i < 3; i++) {
    p1.registerRestOutcome()
    p2.registerRestOutcome()
    world.clock.currentTick += 100
  }

  // Now p3 catches up and builds trust but at different location
  p3.x = 505
  p3.y = 505
  for (let i = 0; i < 3; i++) {
    p3.registerRestOutcome()
    world.clock.currentTick += 100
  }

  const trigger = p1.checkCivicGroupFormationTrigger()

  // p3's home is 400+ units away, so should not be included (but trigger should still exist with p1+p2)
  assert.ok(trigger, 'Should have trigger with p1+p2')
  assert.strictEqual(trigger.members.length, 2, 'Should only include p1 and p2, not p3')
})

test('Civic Group Formation Trigger - returns initiator ID', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, cover)

  // Build trust
  for (let i = 0; i < 3; i++) {
    p1.registerRestOutcome()
    p2.registerRestOutcome()
    world.clock.currentTick += 100
  }

  const trigger = p1.checkCivicGroupFormationTrigger()

  assert.ok(trigger, 'Should detect civic group formation')
  assert.strictEqual(trigger.initiatorId, p1.id)
})

test('Civic Negotiation - queues at dusk and formalizes a trio', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const p3 = new Pawn('p3', 'Carol', 105, 115)
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, p3, cover)
  world.clock.getDayPhase = () => 'dusk'

  p1.needs.getNeedsPriority = () => []

  for (let i = 0; i < 3; i++) {
    p1.registerRestOutcome()
    p2.registerRestOutcome()
    p3.registerRestOutcome()
    world.clock.currentTick += 100
  }

  p1.goals.evaluateAndSetGoals()

  assert.ok(p1.goals.currentGoal, 'Should queue a civic negotiation goal')
  assert.strictEqual(p1.goals.currentGoal.type, 'negotiate_group')

  p1.goals.completeCurrentGoal()

  assert.ok(p1.groupState?.id, 'Group should be formalized')
  assert.strictEqual(p1.groupState.id, p2.groupState.id)
  assert.strictEqual(p1.groupState.id, p3.groupState.id)
  assert.strictEqual(p1.groupNegotiation?.pendingThird, false)
})

test('Civic Negotiation - pair group stays open for a third member', () => {
  const p1 = new Pawn('p1', 'Alice', 100, 100)
  const p2 = new Pawn('p2', 'Bob', 110, 105)
  const cover = createCoverEntity('cover1', 105, 105)

  const world = createWorldWith(p1, p2, cover)
  world.clock.getDayPhase = () => 'night'

  for (let i = 0; i < 3; i++) {
    p1.registerRestOutcome()
    p2.registerRestOutcome()
    world.clock.currentTick += 100
  }

  const trigger = p1.checkCivicGroupFormationTrigger()
  const result = p1.beginCivicNegotiation(trigger, { recruitmentWindowTicks: 720 })

  assert.ok(result, 'Should negotiate a civic pair')
  assert.strictEqual(result.pendingThird, true)
  assert.ok(p1.groupState?.id, 'Pair should be formalized into a group')
  assert.strictEqual(p1.groupState.id, p2.groupState.id)
  assert.ok(p1.groupNegotiation?.pendingThird, 'Group should stay open for a third member')
  assert.ok(p1.groupNegotiation?.recruitmentDeadlineTick >= world.clock.currentTick)
})
