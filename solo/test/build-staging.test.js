import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import RECIPES from '../js/models/crafting/Recipes.js'
import { injectRecipes, decomposeGoal } from '../js/models/entities/mobile/GoalPlanner.js'

injectRecipes(RECIPES)

function makeItem(type, id) {
  return {
    id,
    type,
    name: type,
    weight: 1,
    size: 1
  }
}

test('Build structure goal decomposes into stage_build_materials subgoal', () => {
  const pawn = new Pawn('p1', 'Builder', 100, 100)
  const buildGoal = {
    type: 'build_structure',
    priority: 2,
    description: 'Build a shelter'
  }

  const subgoals = decomposeGoal(pawn, buildGoal)
  const stageGoal = subgoals.find(goal => goal.type === 'stage_build_materials')

  assert.ok(stageGoal)
  assert.ok(Array.isArray(stageGoal.requirements))
  assert.ok(stageGoal.requirements.length > 0)
})

test('Stage build materials goal creates cache and stocks requirements', () => {
  const world = new World(300, 300)
  const pawn = new Pawn('p2', 'Builder', 120, 120)
  world.addEntity(pawn)

  pawn.inventory = [
    makeItem('stick', 'stick_1'),
    makeItem('stick', 'stick_2'),
    makeItem('fiber', 'fiber_1')
  ]

  const goal = {
    type: 'stage_build_materials',
    description: 'Stage build materials',
    requirements: [
      { type: 'stick', count: 2 },
      { type: 'fiber', count: 1 }
    ],
    targetLocation: { x: 120, y: 120 }
  }

  pawn.goals.currentGoal = goal

  for (let i = 0; i < 12; i++) {
    world.clock.currentTick = i + 1
    if (!pawn.goals.currentGoal) break
    pawn.goals.updateGoalSpecificLogic()
  }

  const cache = Array.from(world.entitiesMap.values()).find(entity => entity.subtype === 'cache')

  assert.ok(cache)
  assert.strictEqual(cache.countByType('stick'), 2)
  assert.strictEqual(cache.countByType('fiber'), 1)
  assert.strictEqual(pawn.goals.currentGoal, null)
})

test('Build structure goal consumes staged cache and spawns shelter', () => {
  const world = new World(300, 300)
  const pawn = new Pawn('p3', 'Builder', 150, 150)
  world.addEntity(pawn)

  const cache = pawn.createResourceCache({
    x: 150,
    y: 150,
    purpose: 'build_site',
    name: 'Build Cache'
  })

  cache.addItem(makeItem('stick', 'stick_a'), 1)
  cache.addItem(makeItem('stick', 'stick_b'), 1)
  cache.addItem(makeItem('fiber', 'fiber_a'), 1)

  const goal = {
    type: 'build_structure',
    description: 'Build shelter from cache',
    priority: 2,
    duration: 3,
    buildSite: { x: 150, y: 150 },
    cacheId: cache.id,
    materialRequirements: [
      { type: 'stick', count: 2 },
      { type: 'fiber', count: 1 }
    ]
  }

  pawn.goals.currentGoal = goal

  for (let i = 0; i < 8; i++) {
    world.clock.currentTick = i + 1
    if (!pawn.goals.currentGoal) break
    pawn.goals.updateGoalSpecificLogic()
  }

  const shelter = Array.from(world.entitiesMap.values()).find(entity => entity.subtype === 'structure' && entity.tags?.has?.('shelter'))

  assert.ok(shelter)
  assert.strictEqual(cache.countByType('stick'), 0)
  assert.strictEqual(cache.countByType('fiber'), 0)
  assert.strictEqual(pawn.goals.currentGoal, null)
})
