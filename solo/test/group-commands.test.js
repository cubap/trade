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
