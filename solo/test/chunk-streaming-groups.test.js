import test from 'node:test'
import assert from 'node:assert'
import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

test('Chunk streaming unloads distant pawns and restores group interactions on reload', () => {
  const world = new World(1200, 1200, { chunkSize: 200, activeChunkRadius: 1 })

  const leader = new Pawn('leader', 'Leader', 120, 120)
  const member = new Pawn('member', 'Member', 135, 120)

  world.addEntity(leader)
  world.addEntity(member)

  const groupId = leader.createGroup('civic-stream-test')
  member.joinGroup(leader, groupId)
  member.setGroupTrustIn(leader, 0.9)

  world.setActiveChunkWindow(120, 120, 1)
  assert.ok(world.entitiesMap.has(leader.id))
  assert.ok(world.entitiesMap.has(member.id))

  world.setActiveChunkWindow(1050, 1050, 1)
  assert.ok(!world.entitiesMap.has(leader.id), 'Leader should unload when outside active chunk window')
  assert.ok(!world.entitiesMap.has(member.id), 'Member should unload when outside active chunk window')

  world.setActiveChunkWindow(120, 120, 1)

  const reloadedLeader = world.entitiesMap.get(leader.id)
  const reloadedMember = world.entitiesMap.get(member.id)

  assert.strictEqual(reloadedLeader, leader, 'Leader object should persist across unload/reload')
  assert.strictEqual(reloadedMember, member, 'Member object should persist across unload/reload')
  assert.ok(reloadedMember.groupMemberships[groupId], 'Group membership should persist across unload/reload')
  assert.strictEqual(reloadedMember.groupAffiliationsByType.civic, groupId)

  const accepted = reloadedLeader.issueGroupCommand({ type: 'follow', duration: 60 })
  assert.strictEqual(accepted, 1, 'Member should still obey group command after reload')
})
