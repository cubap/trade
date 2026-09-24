import test from 'node:test'
import assert from 'node:assert'
import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

function advanceDormant(world, ticks = 240) {
  for (let i = 1; i <= ticks; i++) {
    world.clock.currentTick = i
    world.chunkManager.advanceDormantSimulation(world, i)
  }
}

function collectItemTypes(pawn) {
  const inventoryTypes = (pawn.inventory ?? []).map(item => item?.type).filter(Boolean)
  const hiddenTypes = (pawn.hiddenInventory ?? []).map(item => item?.type).filter(Boolean)
  return [...inventoryTypes, ...hiddenTypes]
}

// The dormant rolls come from ChunkManager.noise2D, which is keyed off the map
// seed, and ChunkManager defaults that seed to Math.random(). Without pinning
// `mapSeed` the number of ticks a hunt needs varies per process, which made
// this file fail roughly one run in five (#89).
const MAP_SEED = 4242

test('Dormant simulation progresses hunting-like goals and yields food resources', () => {
  const world = new World(1200, 1200, { chunkSize: 200, activeChunkRadius: 1, mapSeed: MAP_SEED })
  const hunter = new Pawn('hunter_1', 'Hunter', 120, 120)

  hunter.skills.hunting = 8
  hunter.skills.gathering = 6
  hunter.skills.tracking = 5
  const huntingGoal = {
    type: 'find_food',
    description: 'Hunt for game',
    targetTags: ['food'],
    action: 'consume'
  }
  hunter.goals.currentGoal = huntingGoal

  world.addEntity(hunter)
  world.setActiveChunkWindow(120, 120, 1)
  world.setActiveChunkWindow(1050, 1050, 1)

  assert.ok(!world.entitiesMap.has(hunter.id), 'Hunter should be unloaded before dormant simulation')

  advanceDormant(world, 260)

  world.setActiveChunkWindow(120, 120, 1)
  const returnedHunter = world.entitiesMap.get(hunter.id)
  const itemTypes = collectItemTypes(returnedHunter)

  assert.ok(itemTypes.some(type => type === 'meat' || type === 'berries' || type === 'forage'))
  assert.ok((huntingGoal.offscreenYieldCount ?? 0) >= 2,
    `Offscreen hunt should record its yields (mapSeed ${MAP_SEED})`)
  // Assert on the goal object, not its type: a pawn that finishes hunting is
  // free to immediately pick another find_food goal, which is what made the old
  // `currentGoal.type !== 'find_food'` check flaky.
  assert.notStrictEqual(returnedHunter.goals.currentGoal, huntingGoal,
    `Offscreen hunting goal should be retired on completion (mapSeed ${MAP_SEED})`)
})

test('Dormant simulation progresses establish_trade goals with probabilistic returns', () => {
  const world = new World(1200, 1200, { chunkSize: 200, activeChunkRadius: 1, mapSeed: MAP_SEED })
  const trader = new Pawn('trader_1', 'Trader', 120, 120)

  trader.skills.convincing = 10
  trader.skills.storytelling = 8
  trader.skills.planning = 6
  const tradeGoal = {
    type: 'establish_trade',
    description: 'Travel and establish distant trade',
    action: 'trade'
  }
  trader.goals.currentGoal = tradeGoal

  world.addEntity(trader)
  world.setActiveChunkWindow(120, 120, 1)
  world.setActiveChunkWindow(1050, 1050, 1)

  advanceDormant(world, 300)

  world.setActiveChunkWindow(120, 120, 1)
  const returnedTrader = world.entitiesMap.get(trader.id)
  const itemTypes = collectItemTypes(returnedTrader)

  assert.ok(itemTypes.includes('trade_bundle'), 'Trader should return with offscreen trade goods')
  assert.notStrictEqual(returnedTrader.goals.currentGoal, tradeGoal,
    `Offscreen trade goal should be retired on completion (mapSeed ${MAP_SEED})`)
})
