import test from 'node:test'
import assert from 'node:assert'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import WaterSource from '../js/models/entities/resources/WaterSource.js'
import { canCraftRecipe, getRecipe } from '../js/models/crafting/Recipes.js'

class MockWaterResource {
  constructor() {
    this.x = 0
    this.y = 0
    this.size = 4
    this.subtype = 'water'
    this.tags = ['resource', 'water']
  }

  canGather() {
    return true
  }

  gather(amount) {
    return {
      type: 'water',
      quantity: amount,
      source: 'mock_water'
    }
  }
}

class MockFoodResource {
  constructor() {
    this.x = 0
    this.y = 0
    this.size = 4
    this.subtype = 'food'
    this.tags = ['resource', 'food']
  }

  canGather() {
    return true
  }

  gather(amount) {
    return {
      type: 'food',
      quantity: amount,
      source: 'mock_food'
    }
  }
}

test('Water gathering without container becomes drinking fallback', () => {
  const pawn = new Pawn('p1', 'Tester', 0, 0)
  pawn.goals.completeCurrentGoal = () => {}
  pawn.needs.needs.thirst = 70

  const resource = new MockWaterResource()
  const goal = { completionReward: {} }

  pawn.gatherFromResource(resource, goal)

  assert.strictEqual(pawn.inventory.length, 0)
  assert.ok(pawn.needs.needs.thirst < 70)
  assert.strictEqual(pawn.recentAction, 'Drinking from source (no container)')
})

test('Food gathering with full hands becomes eating fallback', () => {
  const pawn = new Pawn('p2', 'Forager', 0, 0)
  pawn.goals.completeCurrentGoal = () => {}
  pawn.needs.needs.hunger = 70
  pawn.inventory = [
    { id: 'carry-1', type: 'rock', weight: 1, size: 1 },
    { id: 'carry-2', type: 'stick', weight: 1, size: 1 }
  ]

  const resource = new MockFoodResource()
  const goal = { completionReward: {} }

  pawn.gatherFromResource(resource, goal)

  assert.strictEqual(pawn.inventory.length, pawn.inventorySlots)
  assert.ok(pawn.needs.needs.hunger < 70)
  assert.strictEqual(pawn.recentAction, 'Eating at source (no free hands)')
})

test('Herb mash recipe can use nearby water source without carrying water', () => {
  const pawn = new Pawn('p3', 'Crafter', 0, 0)
  pawn.skills.herbalism = 2
  pawn.world = {
    clock: { currentTick: 10 },
    entitiesMap: new Map()
  }

  const water = new WaterSource('w1', 'Spring', 0, 0)
  pawn.world.entitiesMap.set(water.id, water)

  pawn.inventory = [
    { id: 'h1', type: 'herb', weight: 1, size: 1 },
    { id: 'h2', type: 'herb', weight: 1, size: 1 }
  ]
  pawn.inventorySlots = 8

  const recipe = getRecipe('herb_mash')
  assert.ok(recipe)
  assert.ok(canCraftRecipe(pawn, recipe))

  const crafted = pawn.craft(recipe)

  assert.ok(crafted)
  assert.strictEqual(crafted.type, 'herb_mash')
  assert.ok(water.quantity < water.maxQuantity)
  assert.strictEqual(pawn.recentAction, 'Crafted Herb Mash')
})
