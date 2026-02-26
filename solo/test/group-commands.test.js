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

test('Group Commands - trust-gated follow command dispatch', () => {
  const leader = new Pawn('p1', 'Leader', 0, 0)
  const member = new Pawn('p2', 'Member', 20, 10)

  createWorldWith(leader, member)

  const groupId = leader.createGroup('group-alpha')
  const joined = member.joinGroup(leader, groupId)

  assert.strictEqual(joined, true)

  member.setGroupTrustIn(leader, 0.8)
  const accepted = leader.issueGroupCommand({ type: 'follow', duration: 90 })

  assert.strictEqual(accepted, 1)
  assert.strictEqual(member.groupCommandQueue.length, 1)

  const goal = member.getNextGroupCommandGoal()

  assert.ok(goal)
  assert.strictEqual(goal.type, 'follow_leader')
  assert.strictEqual(goal.targetId, leader.id)
  assert.strictEqual(goal.duration, 90)
})

test('Group Commands - reject command when trust is too low', () => {
  const leader = new Pawn('p1', 'Leader', 0, 0)
  const member = new Pawn('p2', 'Member', 20, 10)

  createWorldWith(leader, member)

  const groupId = leader.createGroup('group-beta')
  member.joinGroup(leader, groupId)
  member.setGroupTrustIn(leader, -0.2)

  const accepted = leader.issueGroupCommand({ type: 'protect', target: leader, minTrust: 0.1 })

  assert.strictEqual(accepted, 0)
  assert.strictEqual(member.groupCommandQueue.length, 0)
})

test('Group Commands - mark command maps to mark_target goal', () => {
  const leader = new Pawn('p1', 'Leader', 0, 0)
  const member = new Pawn('p2', 'Member', 15, 15)
  const target = { id: 'r1', subtype: 'resource', type: 'rock', x: 120, y: 80 }

  const world = createWorldWith(leader, member)
  world.entitiesMap.set(target.id, target)

  const groupId = leader.createGroup('group-gamma')
  member.joinGroup(leader, groupId)
  member.setGroupTrustIn(leader, 0.5)

  const accepted = leader.issueGroupCommand({ type: 'mark', target })

  assert.strictEqual(accepted, 1)

  const goal = member.getNextGroupCommandGoal()

  assert.ok(goal)
  assert.strictEqual(goal.type, 'mark_target')
  assert.strictEqual(goal.targetId, target.id)
  assert.deepStrictEqual(goal.targetLocation, { x: target.x, y: target.y })
})

test('Group Commands - obey command maps to obey_leader goal', () => {
  const leader = new Pawn('p1', 'Leader', 0, 0)
  const member = new Pawn('p2', 'Member', 10, 10)
  const promoted = new Pawn('p3', 'Promoted', 15, 12)

  createWorldWith(leader, member, promoted)

  const groupId = leader.createGroup('group-delta')
  member.joinGroup(leader, groupId)
  promoted.joinGroup(leader, groupId)

  member.setGroupTrustIn(leader, 0.8)
  promoted.setGroupTrustIn(leader, 0.8)
  const accepted = leader.issueGroupCommand({ type: 'obey', target: promoted })
  assert.strictEqual(accepted, 2)

  const goal = member.getNextGroupCommandGoal()
  assert.ok(goal)
  assert.strictEqual(goal.type, 'obey_leader')
  assert.strictEqual(goal.targetId, promoted.id)
})

test('Group Dynamics - member leaves group when cohesion collapses', () => {
  const leader = new Pawn('p1', 'Leader', 0, 0)
  const member = new Pawn('p2', 'Member', 500, 500)
  const world = createWorldWith(leader, member)

  const groupId = leader.createGroup('group-epsilon')
  member.joinGroup(leader, groupId)
  member.groupState.cohesion = 0.02

  world.clock.currentTick = 50
  member.updateGroupDynamics(world.clock.currentTick)

  assert.strictEqual(member.groupState.id, null)
  assert.strictEqual(member.groupState.role, 'none')
})

test('Group Dynamics - high trust/cohesion marks member as leader candidate', () => {
  const leader = new Pawn('p1', 'Leader', 0, 0)
  const member = new Pawn('p2', 'Member', 20, 20)
  const world = createWorldWith(leader, member)

  const groupId = leader.createGroup('group-zeta')
  member.joinGroup(leader, groupId)
  member.groupState.cohesion = 0.9
  member.setGroupTrustIn(leader, 0.9)
  member.skills.planning = 8
  member.skills.cooperation = 8

  world.clock.currentTick = 50
  member.updateGroupDynamics(world.clock.currentTick)

  assert.strictEqual(member.groupState.role, 'leader-candidate')
})

test('Group Commands - leader-issued obey reassigns group leadership', () => {
  const leader = new Pawn('p1', 'Leader', 0, 0)
  const member = new Pawn('p2', 'Member', 10, 10)
  const promoted = new Pawn('p3', 'Promoted', 15, 10)

  createWorldWith(leader, member, promoted)

  const groupId = leader.createGroup('group-theta')
  member.joinGroup(leader, groupId)
  promoted.joinGroup(leader, groupId)

  member.setGroupTrustIn(leader, 0.7)
  promoted.setGroupTrustIn(leader, 0.7)

  const reassigned = leader.issueGroupCommand({ type: 'obey', target: promoted })

  assert.strictEqual(reassigned, 2)
  assert.strictEqual(promoted.groupState.role, 'leader')
  assert.strictEqual(promoted.groupState.leaderId, promoted.id)
  assert.strictEqual(member.groupState.leaderId, promoted.id)
  assert.strictEqual(leader.groupState.leaderId, promoted.id)
  assert.strictEqual(leader.groupState.role, 'member')
})
