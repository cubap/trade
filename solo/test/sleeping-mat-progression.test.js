import test from 'node:test'
import assert from 'node:assert/strict'

import World from '../js/core/World.js'
import GrassTile from '../js/core/GrassTile.js'
import { GRASS_PROFILE_IDS, GRASS_SOURCE_PROFILES } from '../js/core/GrassSourceProfiles.js'
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

test('seeded tile grass mixes repeat by location, vary between tiles, and reflect biome weights', () => {
  function harvest({ seed, biome, x = 100, y = 100, humidity = 50, shaded = false, roll }) {
    const world = new World(500, 500, { mapSeed: seed, chunkSize: 500 })
    const chunk = world.chunkManager.getChunkAtPosition(x, y)
    chunk.biome = biome
    chunk.humidity = humidity
    if (shaded) chunk.entities.add({ type: 'tree', stage: 'adult', x: x + 1, y })
    return withRandom(roll, () => world.harvestGrassAt(x, y, { use: 'material' }))
  }

  const firstTile = harvest({ seed: 42, biome: 'plains', roll: 0.2 })
  const sameTile = harvest({ seed: 42, biome: 'plains', roll: 0.2 })
  const nearbyTile = harvest({ seed: 42, biome: 'plains', x: 101, roll: 0.2 })
  const wetland = harvest({ seed: 42, biome: 'wetland', roll: 0.47 })
  const forest = harvest({ seed: 42, biome: 'forest', roll: 0.47 })
  const humid = harvest({ seed: 42, biome: 'plains', humidity: 100, roll: 0.63 })
  const arid = harvest({ seed: 42, biome: 'plains', humidity: 0, roll: 0.63 })
  const open = harvest({ seed: 42, biome: 'plains', roll: 0.63 })
  const shaded = harvest({ seed: 42, biome: 'plains', shaded: true, roll: 0.63 })

  assert.deepEqual(sameTile.properties, firstTile.properties)
  assert.notDeepEqual(nearbyTile.properties, firstTile.properties)
  assert.ok(wetland.properties.edibility > forest.properties.edibility)
  assert.ok(humid.properties.edibility > arid.properties.edibility)
  assert.ok(open.properties.edibility > shaded.properties.edibility)
  assert.equal(firstTile.type, 'grass')
  assert.equal(firstTile.composition, undefined)
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

test('sleeping mat quality reflects the grass bundle traits suited to a mat', () => {
  function craftMat(properties) {
    const { pawn } = makePawn('MatQuality')
    pawn.addItemToInventory({
      id: 'grass-input',
      type: 'grass',
      name: 'Grass Bundle',
      properties,
      weight: 1,
      size: 1
    })
    return withRandom(0.5, () => pawn.craft(getRecipe('sleeping_mat')))
  }

  const thatchMat = craftMat({ durability: 50, rotResistance: 60, length: 90 })
  const flowerMat = craftMat({ durability: 5, rotResistance: 8, length: 15 })
  const biomassMat = craftMat({ durability: 20, rotResistance: 25, length: 45 })

  assert.ok(thatchMat.quality > biomassMat.quality)
  assert.ok(biomassMat.quality > flowerMat.quality)
  assert.equal(thatchMat.composition, undefined)
})

test('grass-specific mat suitability does not affect unrelated craft quality', () => {
  function craftCordage(grassLikeProperties) {
    const { pawn } = makePawn('CordageQuality')
    pawn.inventorySlots = 4
    pawn.useSkill('weaving', 1)
    for (let index = 0; index < 3; index++) {
      pawn.addItemToInventory({
        id: `fiber-${index}`,
        type: 'fiber',
        ...(grassLikeProperties ? { properties: grassLikeProperties } : {})
      })
    }
    return withRandom(0.5, () => pawn.craft(getRecipe('cordage')))
  }

  const withProperties = craftCordage({ durability: 100, rotResistance: 100, length: 100 })
  const withoutProperties = craftCordage()

  assert.equal(withProperties.quality, withoutProperties.quality)
})

test('pawns accumulate grass trait evidence before recognizing a source profile', () => {
  const { pawn } = makePawn('Learner')
  const bundle = {
    type: 'grass',
    properties: { ...GRASS_SOURCE_PROFILES[GRASS_PROFILE_IDS.THATCH] }
  }

  assert.equal(pawn.recognizedGrassProfiles.has(GRASS_PROFILE_IDS.THATCH), false)
  pawn.examineItem(bundle)
  pawn.examineItem(bundle)
  assert.equal(pawn.grassProfileEvidence[GRASS_PROFILE_IDS.THATCH], 2)
  assert.equal(pawn.recognizedGrassProfiles.has(GRASS_PROFILE_IDS.THATCH), false)

  pawn.examineItem(bundle)
  assert.equal(pawn.grassProfileEvidence[GRASS_PROFILE_IDS.THATCH], 3)
  assert.equal(pawn.recognizedGrassProfiles.has(GRASS_PROFILE_IDS.THATCH), true)
  assert.equal(bundle.composition, undefined)
})

test('recognized grass targeting uses a curved skill bias without guaranteeing a pure bundle', () => {
  function harvest(skill, roll, recognized = true) {
    const world = new World(500, 500, { mapSeed: 42, chunkSize: 500 })
    const chunk = world.chunkManager.getChunkAtPosition(100, 100)
    chunk.biome = 'plains'
    chunk.humidity = 50
    return withRandom(roll, () => world.harvestGrassAt(100, 100, {
      use: 'material',
      targetProfile: GRASS_PROFILE_IDS.THATCH,
      recognizedProfiles: recognized ? new Set([GRASS_PROFILE_IDS.THATCH]) : new Set(),
      skill
    }))
  }

  const novice = harvest(0, 0.44)
  const practiced = harvest(5, 0.44)
  const expert = harvest(10, 0.44)
  const unrecognized = harvest(10, 0.44, false)
  const unlucky = harvest(10, 0.99)

  assert.ok(novice.properties.durability < practiced.properties.durability)
  assert.ok(practiced.properties.durability < expert.properties.durability)
  assert.ok(expert.properties.durability > unrecognized.properties.durability)
  assert.notEqual(unlucky.properties.durability, 50, 'skill biases the mixture but cannot guarantee purity')
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
