import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

test('Critical thirst preempts long-term goal with survival goal', () => {
  const world = new World(300, 300)
  const pawn = new Pawn('p-preempt', 'Preemptor', 140, 140)
  world.addEntity(pawn)

  pawn.goals.currentGoal = {
    type: 'map_territory',
    priority: 1,
    description: 'Map out the surrounding territory',
    targetType: 'activity',
    action: 'survey'
  }

  pawn.needs.needs.thirst = 95
  pawn.needs.needs.hunger = 40
  pawn.needs.needs.energy = 20

  pawn.goals.evaluateAndSetGoals()

  assert.ok(pawn.goals.currentGoal)
  assert.strictEqual(pawn.goals.currentGoal.type, 'find_water')
  assert.ok(pawn.goals.deferredGoals.some(goal => goal.type === 'map_territory'))
})
