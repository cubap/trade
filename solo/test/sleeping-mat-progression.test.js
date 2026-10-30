import test from 'node:test'
import assert from 'node:assert/strict'

import World from '../js/core/World.js'
import GrassTile from '../js/core/GrassTile.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import Animal from '../js/models/entities/mobile/Animal.js'
import { decomposeGoal, injectRecipes } from '../js/models/entities/mobile/GoalPlanner.js'
import { canCraftRecipe, getAvailableRecipes, getRecipe, RECIPES } from '../js/models/crafting/Recipes.js'
import { setUnlockListener } from '../js/models/skills/UnlockEvents.js'

function makePawn(name = 'Sleeper') {
  const world = new World(300, 300, { mapSeed: 11, chunkSize: 300 })
  const pawn = new Pawn(`pawn-${name}`, name, 100, 100)
  world.addEntity(pawn)
  const chunk = world.chunkManager.getChunkAtPosition(pawn.x, pawn.y)
  chunk.biome = 'plains'
  chunk.humidity = 50
  return { world, pawn }
}

function withRandom(value, run) {
  const originalRandom = Math.random
  try {
    Math.random = () => value
    return run()
  } finally {
    Math.random = originalRandom
  }
}

test('rest dreams can turn poor sleep or unmet comfort into a sleeping-mat idea', () => {
  const { pawn: exposedPawn } = makePawn('Exposed')
  const recipe = getRecipe('sleeping_mat')
  assert.equal(getAvailableRecipes(exposedPawn).includes(recipe), false)
  exposedPawn.registerRestOutcome({ duration: 12 })
  const poorSleepDream = exposedPawn.ponderingQueue.find(problem => problem.type === 'dream_reflection')

  assert.equal(poorSleepDream?.context.poorSleep, true)
  assert.equal(exposedPawn.discoverSolution('dream_reflection', poorSleepDream.context)?.id, 'sleeping_mat_concept')

  const { world, pawn } = makePawn()
  pawn.needs.needs.comfort = 25
  world.entitiesMap.set('nearby-cover', {
    id: 'nearby-cover',
    x: pawn.x,
    y: pawn.y,
    tags: new Set(['cover'])
  })
  pawn.registerRestOutcome({ duration: 12 })

  const comfortDream = pawn.ponderingQueue.find(problem => problem.type === 'dream_reflection')
  assert.equal(comfortDream?.context.poorSleep, false)
  assert.equal(comfortDream?.context.unresolvedNeeds.comfort, 25)

  let unlockPayload = null
  let solution
  try {
    setUnlockListener(payload => { unlockPayload = payload })
    solution = withRandom(0, () => pawn.processPonderingQueue())
  } finally {
    setUnlockListener(null)
  }

  assert.equal(solution?.id, 'sleeping_mat_concept')
  assert.ok(pawn.unlocked.recipes.has('sleeping_mat'))
  assert.deepEqual(unlockPayload?.recipes, ['sleeping_mat'])
  assert.ok(pawn.goals.goalQueue.some(goal => goal.type === 'craft_sleeping_mat'))
})

test('tile grass yields mixed material properties, with skill biasing a targeted harvest', () => {
  const novice = makePawn('Novice')
  const practiced = makePawn('Practiced')
  injectRecipes(RECIPES)

  const randomRoll = 0.3
  const unskilledBundle = withRandom(randomRoll, () =>
    novice.world.harvestGrassAt(novice.pawn.x, novice.pawn.y, {
      use: 'material',
      targetType: 'fiber',
      skill: 0
    })
  )
  const skilledBundle = withRandom(randomRoll, () =>
    practiced.world.harvestGrassAt(practiced.pawn.x, practiced.pawn.y, {
      use: 'material',
      targetType: 'fiber',
      skill: 10
    })
  )

  assert.equal(novice.world.entitiesMap.size, 1, 'grass belongs to tile state, not the entity list')
  assert.equal(unskilledBundle?.type, 'grass')
  assert.ok(unskilledBundle.properties.durability < skilledBundle.properties.durability)
  assert.ok(unskilledBundle.properties.edibility > 0)
  assert.ok(unskilledBundle.properties.mass > 0)
  assert.equal(unskilledBundle.composition, undefined, 'the bundle carries consolidated properties, not separate grass species')
})

test('a grass bundle combines shared material properties across an equal mixture', () => {
  const { world, pawn } = makePawn('Mixer')
  const chunk = world.chunkManager.getChunkAtPosition(pawn.x, pawn.y)
  chunk.grassTiles.set('100,100', new GrassTile({
    id: 'balanced-grass',
    capacity: 90,
    biome: 'plains',
    stocks: { thatch: 30, flowers: 30, biomass: 30 }
  }))

  const rolls = [0.1, 0.5, 0.9]
  let rollIndex = 0
  const originalRandom = Math.random
  let bundle
  try {
    Math.random = () => rolls[rollIndex++ % rolls.length]
    bundle = world.harvestGrassAt(pawn.x, pawn.y, {
      use: 'material',
      targetType: 'thatch',
      skill: 0
    })
  } finally {
    Math.random = originalRandom
  }

  assert.equal(bundle.properties.durability, 25)
  assert.equal(bundle.properties.flexibility, 25)
  assert.equal(bundle.properties.edibility, 28.333333333333332)
  assert.equal(bundle.properties.medicine, 10)
  assert.equal(bundle.properties.length, 50)
  assert.equal(bundle.properties.mass, 40)
  assert.equal(bundle.properties.fiber, undefined, 'fiber is a crafted material, not a raw grass property')
})

test('foraging uses tile grass without consuming the fiber and biomass stocks', () => {
  const { world, pawn } = makePawn('Grazer')
  const animal = new Animal('forager', 'Forager', pawn.x, pawn.y)
  world.addEntity(animal)
  animal.drives.hunger = 20

  withRandom(0.3, () => animal.forage())
  const fiberBundle = withRandom(0.3, () =>
    world.harvestGrassAt(pawn.x, pawn.y, {
      use: 'material',
      targetType: 'fiber',
      skill: 10
    })
  )
  const biomassBundle = withRandom(0.3, () =>
    world.harvestGrassAt(pawn.x, pawn.y, {
      use: 'material',
      targetType: 'biomass',
      skill: 10
    })
  )

  assert.ok(animal.drives.hunger < 20)
  assert.ok(fiberBundle?.properties.length > 0)
  assert.ok(biomassBundle?.properties.mass > 0)
})

test('animals can try low-edibility thatch, while pawns do not mistake it for food', () => {
  const { world, pawn } = makePawn('GrazerAndPawn')
  const chunk = world.chunkManager.getChunkAtPosition(pawn.x, pawn.y)
  chunk.grassTiles.set('100,100', new GrassTile({
    id: 'thatch-only',
    capacity: 30,
    biome: 'plains',
    stocks: { thatch: 30, flowers: 0, biomass: 0 }
  }))
  const animal = new Animal('forager', 'Forager', pawn.x, pawn.y)
  world.addEntity(animal)
  animal.drives.hunger = 20

  withRandom(0.3, () => animal.forage())
  assert.ok(animal.drives.hunger < 20, 'a hungry animal tries low-edibility grass')

  pawn.needs.needs.hunger = 60
  const foodGoal = pawn.goals.generateGoalsForNeed('hunger', 2)[0]
  pawn.goals.currentGoal = foodGoal
  pawn.goals.startGoal(foodGoal)
  const hungerBefore = pawn.needs.needs.hunger

  withRandom(0.3, () => pawn.goals.updateGoalProgress())

  assert.equal(pawn.needs.needs.hunger, hungerBefore)
  assert.equal(pawn.goals.currentGoal, foodGoal, 'the pawn keeps seeking food after a nutritionally negligible forage')
})

test('a hungry pawn can satisfy its food goal by foraging tile grass', () => {
  const { world, pawn } = makePawn('Hungry')
  pawn.needs.needs.hunger = 60
  const foodGoal = pawn.goals.generateGoalsForNeed('hunger', 2)[0]
  pawn.goals.currentGoal = foodGoal
  pawn.goals.startGoal(foodGoal)

  withRandom(0.3, () => pawn.goals.updateGoalProgress())

  assert.ok(pawn.needs.needs.hunger < 60)
  assert.equal(pawn.goals.currentGoal, null)
})

test('a known mat idea leads to a tile-targeted grass gather, crafting, and more comfortable rest', () => {
  const { world, pawn } = makePawn('Weaver')
  pawn.unlocked.recipes.add('sleeping_mat')
  injectRecipes(RECIPES)

  const prerequisites = decomposeGoal(pawn, { type: 'craft_sleeping_mat', priority: 2 })
  assert.equal(prerequisites[0]?.type, 'gather_grass')
  assert.deepEqual(prerequisites[0]?.targetLocation, { x: pawn.x, y: pawn.y })
  assert.equal(prerequisites[0]?.targetGrassType, 'fiber')

  pawn.goals.currentGoal = prerequisites[0]
  pawn.goals.startGoal(prerequisites[0])
  withRandom(0.3, () => pawn.goals.updateGoalProgress())
  assert.ok(pawn.inventory.some(item => item.type === 'grass'))

  const recipe = getRecipe('sleeping_mat')
  assert.ok(getAvailableRecipes(pawn).includes(recipe))
  assert.ok(canCraftRecipe(pawn, recipe))
  const mat = pawn.craft(recipe)
  assert.equal(mat?.type, 'sleeping_mat')
  assert.ok(mat.tags.includes('rest_surface'))
  assert.equal(mat.tags.includes('cover'), false)
  assert.equal(pawn.addItemToInventory(mat), true)

  pawn.goals.currentGoal = { type: 'rest', startTime: 1 }
  pawn.needs.needs.energy = 50
  pawn.needs.needs.comfort = 30
  pawn.needs.needs.safety = 30
  pawn.needs.updateNeeds(5)

  assert.ok(pawn.needs.needs.energy < 50)
  assert.ok(pawn.needs.needs.comfort < 30)
  assert.ok(pawn.needs.needs.safety > 30)
  assert.equal(pawn.needs.situations.has('in_shelter'), false)
})
