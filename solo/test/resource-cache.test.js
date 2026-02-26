import test from 'node:test'
import assert from 'node:assert'
import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

function addBasicItem(type, id) {
  return {
    id,
    type,
    name: type,
    weight: 1,
    size: 1
  }
}

test('Resource cache supports shared stash and retrieval between pawns', () => {
  const world = new World(400, 400)
  const pawnA = new Pawn('p1', 'Stockpiler', 100, 100)
  const pawnB = new Pawn('p2', 'Builder', 105, 105)

  world.addEntity(pawnA)
  world.addEntity(pawnB)

  pawnA.inventory = [
    addBasicItem('food', 'food_1'),
    addBasicItem('food', 'food_2')
  ]

  const stash = pawnA.stashInventoryInCache({
    purpose: 'food_stockpile',
    itemTypes: ['food'],
    maxItems: 2
  })

  assert.ok(stash.cache)
  assert.strictEqual(stash.stashed, 2)
  assert.strictEqual(pawnA.inventory.length, 0)
  assert.strictEqual(stash.cache.countByType('food'), 2)

  const fetched = pawnB.retrieveFromCache({
    cache: stash.cache,
    itemType: 'food',
    count: 1
  })

  assert.strictEqual(fetched, 1)
  assert.strictEqual(stash.cache.countByType('food'), 1)
  assert.strictEqual(pawnB.inventory.filter(item => item.type === 'food').length, 1)

  const knownByB = pawnB.memoryMap.filter(lm => lm.type === 'resource_cache')
  assert.ok(knownByB.length > 0)
})

test('Fiber soak jobs in cache complete after one game day', () => {
  const world = new World(400, 400)
  const pawn = new Pawn('p3', 'Crafter', 120, 120)
  world.addEntity(pawn)

  pawn.inventory = [
    addBasicItem('fiber', 'fiber_1'),
    addBasicItem('fiber', 'fiber_2')
  ]

  const started = pawn.startFiberSoakAtCache({ fiberCount: 2 })
  assert.strictEqual(started, true)

  const cache = Array.from(world.entitiesMap.values()).find(entity => entity.subtype === 'cache')
  assert.ok(cache)
  assert.strictEqual(cache.countByType('fiber'), 0)

  const dayTicks = pawn.getDayTicks()
  for (let tick = 1; tick <= dayTicks; tick++) {
    cache.update(tick)
  }

  assert.strictEqual(cache.countByType('soaked_fiber'), 2)
  assert.strictEqual(cache.soakJobs.length, 0)
  assert.strictEqual(pawn.recentAction, 'Started fiber soak (1 day)')
})

test('Stashing materials marks cache as a remembered landmark', () => {
  const world = new World(400, 400)
  const pawn = new Pawn('p4', 'Planner', 160, 160)
  world.addEntity(pawn)

  pawn.inventory = [
    addBasicItem('stick', 'stick_1'),
    addBasicItem('stick', 'stick_2')
  ]

  const result = pawn.stashInventoryInCache({
    purpose: 'build_site',
    itemTypes: ['stick'],
    maxItems: 2,
    location: { x: 180, y: 170 }
  })

  assert.ok(result.cache)
  const landmarks = pawn.memoryMap.filter(lm => lm.type === 'resource_cache')
  assert.ok(landmarks.length > 0)
  assert.ok(landmarks.some(lm => lm.event === 'stashed'))
})
