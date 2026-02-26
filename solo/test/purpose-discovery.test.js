import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

function setNeed(pawn, key, value) {
  pawn.needs.needs[key] = value
}

test('Purpose pressure and challenge contexts raise pondering chance components', () => {
  const world = new World(300, 300)
  const pawn = new Pawn('p1', 'Thinker', 120, 120)
  world.addEntity(pawn)

  setNeed(pawn, 'purpose', 70)
  pawn.purposeStrainTicks = 900
  pawn.behaviorState = 'idle'

  pawn.recordChallengeContext('manual_cutting_hardship', 0.08, { durationTicks: 400 })

  const purposeBonus = pawn.getPurposePressureBonus()
  const challengeBonus = pawn.getChallengeContextBonus('need_better_tools')
  const windowBonus = pawn.getPonderWindowBonus()

  assert.ok(purposeBonus > 0)
  assert.ok(challengeBonus > 0)
  assert.ok(windowBonus > 0)
})

test('Resting exposed can trigger shelter pondering and thought logging', () => {
  const world = new World(300, 300)
  const pawn = new Pawn('p2', 'Sleeper', 100, 100)
  world.addEntity(pawn)

  pawn.registerRestOutcome({ duration: 12 })
  pawn.registerRestOutcome({ duration: 12 })

  const queuedTypes = pawn.ponderingQueue.map(item => item.type)
  const thought = pawn.getLatestThought()?.text ?? ''

  assert.ok(queuedTypes.includes('need_shelter'))
  assert.ok(pawn.exposedNights >= 2)
  assert.ok(thought.length > 0)
})

test('Manual fiber gathering without cutting tools creates better-tools pressure', () => {
  const world = new World(300, 300)
  const pawn = new Pawn('p3', 'Forager', 90, 90)
  world.addEntity(pawn)

  const mockFiberPlant = {
    type: 'resource',
    subtype: 'fiber_plant',
    tags: ['resource', 'fiber'],
    x: pawn.x,
    y: pawn.y,
    size: 5,
    canGather: () => true,
    gather: () => ({ id: 'fiber_1', type: 'fiber', quantity: 1, weight: 1, size: 1 })
  }

  const before = pawn.challengeContexts.length
  pawn.gatherFromResource(mockFiberPlant, { completionReward: {} })
  const after = pawn.challengeContexts.length

  const hasToolPressure = pawn.challengeContexts.some(ctx => ctx.type === 'manual_cutting_hardship')

  assert.ok(after > before)
  assert.ok(hasToolPressure)
})
