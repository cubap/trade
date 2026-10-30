import test from 'node:test'
import assert from 'node:assert/strict'

import World from '../js/core/World.js'
import FiberPlant from '../js/models/entities/resources/FiberPlant.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import { canCraftRecipe, getAvailableRecipes, getRecipe } from '../js/models/crafting/Recipes.js'

test('a pawn can learn to handle fiber, unlock weaving, and craft cordage by harvesting', () => {
  const world = new World(300, 300, { mapSeed: 7 })
  const pawn = new Pawn('p1', 'Ryla', 100, 100)
  pawn.inventorySlots = 6
  pawn.maxSize = 100
  pawn.maxWeight = 100
  const patch = new FiberPlant('fiber-1', 100, 100)

  world.addEntity(pawn)
  world.addEntity(patch)

  for (let harvest = 0; harvest < 3; harvest++) {
    pawn.gatherFromResource(patch, {})
  }

  assert.strictEqual(patch.amount, 0, 'harvested fiber comes out of the world resource')
  assert.strictEqual(pawn.itemExposure.fiber, 3, 'handling the harvest teaches the material')
  assert.ok(pawn.getSkill('manipulation') >= 1, 'repeated harvesting practices fine-motor skill')
  assert.strictEqual(pawn.getSkill('weaving'), 1, 'the fiber discovery qualifies the next skill')

  const cordage = getRecipe('cordage')
  assert.ok(pawn.unlocked.recipes.has('cordage'), 'the pawn discovers the cordage recipe')
  assert.ok(getAvailableRecipes(pawn).includes(cordage), 'the discovered recipe is available')
  assert.ok(canCraftRecipe(pawn, cordage), 'the harvested fiber supplies the recipe')

  const crafted = pawn.craft(cordage)
  assert.strictEqual(crafted?.type, 'cordage')
  assert.strictEqual(pawn.inventory.filter(item => item.type === 'fiber').length, 0)
  assert.strictEqual(pawn.craftedCounts.cordage, 1)
  assert.ok(pawn.getSkill('weaving') > 1, 'crafting cordage practices weaving')
})
