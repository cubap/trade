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

// Party Commands: follow, protect, scout, mark
test('Party Command - scout command creates scout_area goal', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')
  member.setGroupTrustIn(leader, 0.5) // Trust required for command acceptance

  const accepted = member.receiveGroupCommand(
    { type: 'scout', targetLocation: { x: 200, y: 200 }, radius: 120, priority: 5 },
    leader
  )

  assert.strictEqual(accepted, true, 'Member should accept scout command')

  const goal = member.getNextGroupCommandGoal()
  assert.strictEqual(goal.type, 'scout_area', 'Scout command should produce scout_area goal')
  assert.strictEqual(goal.targetLocation.x, 200, 'Goal should have target location')
  assert.strictEqual(goal.radius, 120, 'Goal should have radius')
})

test('Party Command - mark command creates mark_target goal', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')
  member.setGroupTrustIn(leader, 0.5) // Trust required for command acceptance

  const target = { id: 'target1', x: 150, y: 150 }
  const accepted = member.receiveGroupCommand(
    { type: 'mark', target, priority: 6 },
    leader
  )

  assert.strictEqual(accepted, true, 'Member should accept mark command')

  const goal = member.getNextGroupCommandGoal()
  assert.strictEqual(goal.type, 'mark_target', 'Mark command should produce mark_target goal')
  assert.strictEqual(goal.targetId, 'target1', 'Goal should have target ID')
})

// Coordinated Hunt Behavior
test('Coordinated Hunt - leader creates hunt party', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member1 = new Pawn('member1', 'Member1', 105, 105)
  const member2 = new Pawn('member2', 'Member2', 110, 110)
  const world = createWorldWith(leader, member1, member2)

  leader.createGroup('group1')
  member1.joinGroup(leader, 'group1')
  member2.joinGroup(leader, 'group1')

  const target = { id: 'prey1', x: 200, y: 200, type: 'deer' }
  const huntParty = leader.createHuntParty(target, ['member1', 'member2'])

  assert.ok(huntParty, 'Hunt party should be created')
  assert.strictEqual(huntParty.members.length, 3, 'Hunt party should include leader and members')
  assert.strictEqual(huntParty.targetId, 'prey1', 'Hunt party should have target ID')
  assert.ok(leader.huntParty, 'Leader should have hunt party assigned')
  assert.ok(member1.huntParty, 'Member1 should have hunt party assigned')
  assert.ok(member2.huntParty, 'Member2 should have hunt party assigned')
})

test('Coordinated Hunt - hunt party records tactical memory', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  const target = { id: 'prey1', x: 200, y: 200, type: 'deer' }
  leader.createHuntParty(target, ['member'])

  const memories = member.tacticalMemory.filter(m => m.type === 'threat')
  assert.ok(memories.length > 0, 'Member should have threat memory from hunt')
  assert.ok(memories[0].description.includes('deer'), 'Memory should describe target type')
})

test('Coordinated Hunt - hunt party ends and records history', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  const target = { id: 'prey1', x: 200, y: 200, type: 'deer' }
  leader.createHuntParty(target, ['member'])
  leader.endHuntParty(true)

  assert.strictEqual(leader.huntParty, null, 'Leader hunt party should be cleared')
  assert.strictEqual(member.huntParty, null, 'Member hunt party should be cleared')
  assert.ok(leader.huntHistory.length >= 1, 'Leader should have hunt history entry')
  assert.strictEqual(leader.huntHistory[leader.huntHistory.length - 1].success, true, 'Last hunt history should record success')
})

test('Coordinated Hunt - non-leader cannot create hunt party', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  const target = { id: 'prey1', x: 200, y: 200, type: 'deer' }
  const huntParty = member.createHuntParty(target, ['leader'])

  assert.strictEqual(huntParty, null, 'Non-leader should not be able to create hunt party')
})

// Escort Behavior
test('Escort Behavior - escort command creates escort_target goal', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')
  member.setGroupTrustIn(leader, 0.5) // Trust required for command acceptance

  const target = { id: 'escortee', x: 150, y: 150, subtype: 'pawn' }
  const accepted = member.receiveGroupCommand(
    { type: 'escort', target, destination: { x: 300, y: 300 }, priority: 7 },
    leader
  )

  assert.strictEqual(accepted, true, 'Member should accept escort command')

  const goal = member.getNextGroupCommandGoal()
  assert.strictEqual(goal.type, 'escort_target', 'Escort command should produce escort_target goal')
  assert.strictEqual(goal.targetId, 'escortee', 'Goal should have target ID')
  assert.ok(goal.destination, 'Goal should have destination')
})

// Territory and Tactical Memory Loops
test('Tactical Memory - recording memory adds to tactical memory array', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  pawn.recordTacticalMemory('territory', { x: 100, y: 100 }, 'Important landmark', 0.8)

  assert.strictEqual(pawn.tacticalMemory.length, 1, 'Should have one tactical memory')
  assert.strictEqual(pawn.tacticalMemory[0].type, 'territory', 'Memory type should be territory')
  assert.strictEqual(pawn.tacticalMemory[0].significance, 0.8, 'Memory significance should be set')
})

test('Tactical Memory - old memories are pruned', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  // Add some memories
  pawn.recordTacticalMemory('territory', { x: 100, y: 100 }, 'Landmark 1', 0.5)
  pawn.recordTacticalMemory('route', { x: 110, y: 110 }, 'Route 1', 0.6)
  pawn.recordTacticalMemory('threat', { x: 120, y: 120 }, 'Threat 1', 0.7)

  world.clock.currentTick = 1100 // After decay threshold
  pawn.updateTacticalMemory(1100)

  assert.ok(pawn.tacticalMemory.length < 3, 'Old memories should be pruned')
})

test('Tactical Memory - territory landmarks are updated from memories', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  pawn.recordTacticalMemory('territory', { x: 100, y: 100 }, 'Important landmark', 0.5)
  pawn.updateTerritoryLandmarks(pawn.tacticalMemory)

  assert.strictEqual(pawn.territoryLandmarks.length, 1, 'Should have one territory landmark')
  assert.strictEqual(pawn.territoryLandmarks[0].x, 100, 'Landmark should have correct position')
})

test('Tactical Memory - getTerritoryMemories filters by significance', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)
  const world = createWorldWith(pawn)

  pawn.recordTacticalMemory('territory', { x: 100, y: 100 }, 'Important', 0.5)
  pawn.recordTacticalMemory('territory', { x: 110, y: 110 }, 'Less important', 0.1)
  pawn.recordTacticalMemory('route', { x: 120, y: 120 }, 'Not territory', 0.8)

  const territoryMemories = pawn.getTerritoryMemories()
  assert.strictEqual(territoryMemories.length, 1, 'Should only return significant territory memories')
  assert.strictEqual(territoryMemories[0].significance, 0.5, 'Should return memory with significance > 0.2')
})

// Security Contract Primitives
test('Security Contract - patrol route assignment', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member1 = new Pawn('member1', 'Member1', 105, 105)
  const member2 = new Pawn('member2', 'Member2', 110, 110)
  const world = createWorldWith(leader, member1, member2)

  leader.createGroup('group1')
  member1.joinGroup(leader, 'group1')
  member2.joinGroup(leader, 'group1')

  const waypoints = [{ x: 100, y: 100 }, { x: 150, y: 150 }, { x: 200, y: 200 }]
  const assigned = leader.assignPatrolRoute('route1', waypoints, leader)

  assert.strictEqual(assigned, true, 'Patrol route should be assigned')
  assert.ok(member1.patrolRoutes['route1'], 'Member1 should have patrol route')
  assert.ok(member2.patrolRoutes['route1'], 'Member2 should have patrol route')
  assert.strictEqual(member1.patrolRoutes['route1'].waypoints.length, 3, 'Route should have waypoints')
})

test('Security Contract - defense position assignment', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  const position = { x: 150, y: 150 }
  const assigned = leader.assignDefensePosition('def1', position, leader)

  assert.strictEqual(assigned, true, 'Defense position should be assigned')
  assert.ok(member.defenseAssignments['def1'], 'Member should have defense assignment')
  assert.strictEqual(member.defenseAssignments['def1'].position.x, 150, 'Position should be set')
})

test('Security Contract - creating contract between groups', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const world = createWorldWith(leader)

  leader.createGroup('group1')
  leader.groupState.role = 'leader'

  const contract = leader.createSecurityContract(
    'contract1',
    'group2',
    'patrol',
    { waypoints: [{ x: 100, y: 100 }], duration: 1000 }
  )

  assert.ok(contract, 'Contract should be created')
  assert.strictEqual(contract.withGroup, 'group2', 'Contract should reference other group')
  assert.strictEqual(contract.type, 'patrol', 'Contract type should be patrol')
  assert.ok(leader.securityContracts['contract1'], 'Leader should have contract stored')
})

test('Security Contract - getting active contracts', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const world = createWorldWith(leader)

  leader.createGroup('group1')
  leader.groupState.role = 'leader'

  leader.createSecurityContract('contract1', 'group2', 'patrol', {})
  leader.createSecurityContract('contract2', 'group3', 'defense', {})
  leader.terminateSecurityContract('contract1')

  const activeContracts = leader.getActiveSecurityContracts()
  assert.strictEqual(activeContracts.length, 1, 'Should have one active contract')
  assert.strictEqual(activeContracts[0].contractId, 'contract2', 'Active contract should be contract2')
})

test('Security Contract - non-leader cannot assign routes or positions', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  const waypoints = [{ x: 100, y: 100 }]
  const routeAssigned = member.assignPatrolRoute('route1', waypoints, member)
  const positionAssigned = member.assignDefensePosition('def1', { x: 100, y: 100 }, member)

  assert.strictEqual(routeAssigned, false, 'Non-leader should not assign patrol routes')
  assert.strictEqual(positionAssigned, false, 'Non-leader should not assign defense positions')
})

// Patrol and Defense Command Goals
test('Patrol Command - patrol command creates patrol_route goal', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')
  member.setGroupTrustIn(leader, 0.5) // Trust required for command acceptance

  const waypoints = [{ x: 100, y: 100 }, { x: 150, y: 150 }]
  const accepted = member.receiveGroupCommand(
    { type: 'patrol', waypoints, routeId: 'route1', priority: 6 },
    leader
  )

  assert.strictEqual(accepted, true, 'Member should accept patrol command')

  const goal = member.getNextGroupCommandGoal()
  assert.strictEqual(goal.type, 'patrol_route', 'Patrol command should produce patrol_route goal')
  assert.strictEqual(goal.waypoints.length, 2, 'Goal should have waypoints')
})

test('Defense Command - defend command creates defend_position goal', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')
  member.setGroupTrustIn(leader, 0.5) // Trust required for command acceptance

  const accepted = member.receiveGroupCommand(
    { type: 'defend', targetLocation: { x: 150, y: 150 }, priority: 8 },
    leader
  )

  assert.strictEqual(accepted, true, 'Member should accept defend command')

  const goal = member.getNextGroupCommandGoal()
  assert.strictEqual(goal.type, 'defend_position', 'Defend command should produce defend_position goal')
  assert.strictEqual(goal.targetLocation.x, 150, 'Goal should have target location')
})

// Serialization
test('Serialization - Phase 1 state can be serialized and loaded', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  // Set up Phase 1 state
  leader.recordTacticalMemory('territory', { x: 100, y: 100 }, 'Landmark', 0.5)
  leader.assignPatrolRoute('route1', [{ x: 100, y: 100 }], leader)
  leader.assignDefensePosition('def1', { x: 150, y: 150 }, leader)
  leader.createSecurityContract('contract1', 'group2', 'patrol', {})

  // Serialize
  const state = leader.serializePhase1State()

  assert.ok(state.tacticalMemory.length >= 1, 'Tactical memory should be serialized')
  assert.ok(state.patrolRoutes['route1'], 'Patrol routes should be serialized')
  assert.ok(state.defenseAssignments['def1'], 'Defense assignments should be serialized')
  assert.ok(state.securityContracts['contract1'], 'Security contracts should be serialized')

  // Load into new pawn
  const newLeader = new Pawn('leader', 'Leader', 100, 100)
  newLeader.world = world
  newLeader.loadPhase1State(state)

  assert.ok(newLeader.tacticalMemory.length >= 1, 'Tactical memory should be loaded')
  assert.ok(newLeader.patrolRoutes['route1'], 'Patrol routes should be loaded')
  assert.ok(newLeader.defenseAssignments['def1'], 'Defense assignments should be loaded')
  assert.ok(newLeader.securityContracts['contract1'], 'Security contracts should be loaded')
})

test('Serialization - loading null Phase 1 state has no effect', () => {
  const pawn = new Pawn('p1', 'Alice', 100, 100)

  pawn.loadPhase1State(null)

  assert.strictEqual(pawn.tacticalMemory.length, 0, 'Tactical memory should remain empty')
  assert.strictEqual(Object.keys(pawn.patrolRoutes).length, 0, 'Patrol routes should remain empty')
})

// Integration: Territory memory influences patrol/defense decisions
test('Integration - territory memories influence patrol decisions', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  // Leader records territory memories
  leader.recordTacticalMemory('territory', { x: 100, y: 100 }, 'Important area', 0.8)
  leader.recordTacticalMemory('territory', { x: 200, y: 200 }, 'Another area', 0.6)

  const territoryMemories = leader.getTerritoryMemories()
  assert.strictEqual(territoryMemories.length, 2, 'Should have territory memories')

  // Leader assigns patrol based on territory memories
  const waypoints = territoryMemories.map(m => ({ x: m.location.x, y: m.location.y }))
  const assigned = leader.assignPatrolRoute('territory-patrol', waypoints, leader)

  assert.strictEqual(assigned, true, 'Patrol should be assigned based on territory memories')
  assert.strictEqual(member.patrolRoutes['territory-patrol'].waypoints.length, 2, 'Member should have patrol waypoints')
})

// Hunt party coordination updates
test('Hunt Party - updateHuntParty tracks target location', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const member = new Pawn('member', 'Member', 105, 105)
  const world = createWorldWith(leader, member)

  leader.createGroup('group1')
  member.joinGroup(leader, 'group1')

  const target = { id: 'prey1', x: 200, y: 200, type: 'deer' }
  leader.createHuntParty(target, ['member'])

  // Simulate target moving
  target.x = 210
  target.y = 210
  world.clock.currentTick = 100
  leader.updateHuntParty(100)

  assert.strictEqual(leader.huntParty.targetLocation.x, 210, 'Hunt party should track target location')
})

test('Hunt Party - expired hunt ends automatically', () => {
  const leader = new Pawn('leader', 'Leader', 100, 100)
  const world = createWorldWith(leader)

  leader.createGroup('group1')
  const target = { id: 'prey1', x: 200, y: 200, type: 'deer' }
  leader.createHuntParty(target, [])

  world.clock.currentTick = 601 // After max duration
  leader.updateHuntParty(601)

  assert.strictEqual(leader.huntParty, null, 'Expired hunt should end')
})
