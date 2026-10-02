import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import { RECIPES, getRecipe, getAvailableRecipes, canCraftRecipe } from '../js/models/crafting/Recipes.js'
import { SKILL_UNLOCKS } from '../js/models/skills/SkillUnlocks.js'
import { hasSurplus } from '../js/models/entities/mobile/PawnMercantile.js'

// #112: everything that *reads* carrying capacity was already written. hasContainer()
// gated water, carryRejection() summed increasesCapacity, the barter code asked for a
// surplus of more than three of a kind, and the pondering queue named 'basket' as the
// answer to a full pack. Nothing produced an item with that metadata, so a pawn could
// never satisfy any of it: with two slots it could not hold the four fibres a surplus
// needs, could not carry the three a craft bill wants, and could not carry water at all
// because the only thing that makes water carryable was not in the game.
//
// The arithmetic was worse than merely stuck. addItemToInventory() added a container's
// bonus to inventorySlots and removeItemFromInventory() never took it back, so the
// moment a container did exist the pack's size became a rumour it repeated about
// itself - handed over in a barter, dead, or lost in a transfer that failed at the far
// end, and the slots stayed.

function makeItem(type, id, extra = {}) {
  return { id, type, name: type, weight: 1, size: 1, ...extra }
}

function weavingGround(label = 'ada') {
  const world = new World(300, 300)
  const pawn = new Pawn(label, label === 'ada' ? 'Ada' : 'Bo', 100, 100)
  world.addEntity(pawn)
  return { world, pawn }
}

// A fibre patch: the recipe asks the world for material, so a two-slot pawn can weave
// without first carrying what it needs room for.
function fiberPatch(world, x, y, quantity = 6) {
  const patch = {
    id: 'patch1',
    type: 'resource',
    subtype: 'fiber',
    x,
    y,
    quantity,
    tags: ['fiber'],
    consume(amount = 1) {
      const taken = Math.min(this.quantity, amount)
      this.quantity -= taken
      return taken
    }
  }
  world.addEntity(patch)
  return patch
}

test('every recipe the unlock table grants names a recipe that exists', () => {
  // This is how #112 stayed invisible for so long: the table promised 'poultice' while
  // the recipe was filed under 'simple_poultice', and unlocking a name that matches
  // nothing is silent. The ids have to agree because getAvailableRecipes filters on
  // unlocked.recipes.has(recipe.id), and the goal planner turns craft_<x> into <x>.
  const ids = new Set(RECIPES.map(recipe => recipe.id))
  for (const unlock of SKILL_UNLOCKS) {
    for (const recipeId of unlock.unlocks?.recipes ?? []) {
      assert.ok(ids.has(recipeId), `${unlock.id} unlocks "${recipeId}", which is not a recipe id`)
    }
  }
})

test('the basket is the producer the carrying system was missing', () => {
  const basket = getRecipe('basket')
  assert.ok(basket, 'a basket recipe exists')
  assert.strictEqual(basket.output.slotType, 'container', 'hasContainer() looks for this')
  assert.ok((basket.output.increasesCapacity?.slots ?? 0) > 0, 'carryRejection() adds this up')
})

test('weaving a basket opens the pack and, with it, the water gate', () => {
  const { world, pawn } = weavingGround()
  fiberPatch(world, 102, 100)

  pawn.itemExposure = { fiber: 4 }
  pawn.evaluateSkillUnlocks()
  assert.ok(pawn.unlocked.recipes.has('basket'), 'handling fibre is enough to think of the basket')

  const offered = getAvailableRecipes(pawn).filter(recipe => canCraftRecipe(pawn, recipe))
  assert.ok(offered.some(recipe => recipe.id === 'basket'), 'and the planner offers it to her')

  assert.strictEqual(pawn.inventorySlots, 2, 'hands-only before the weave')
  const crafted = pawn.craft(getRecipe('basket'))
  assert.ok(crafted, 'the weave succeeds with an empty pack and a patch underfoot')
  assert.strictEqual(crafted.slotType, 'container', 'craft() carried the metadata through')
  assert.ok(pawn.addItemToInventory(crafted), 'she can pick it up')
  assert.strictEqual(pawn.inventorySlots, 6, 'and the pack really did widen')
  assert.ok(pawn.hasContainer(), 'the container count is no longer zero')
  assert.strictEqual(pawn.addItemToInventory(makeItem('water', 'w1')), true, 'water is carryable now')
})

test('the room leaves with the basket', () => {
  const { pawn } = weavingGround()
  const basket = makeItem('basket', 'k1', { slotType: 'container', increasesCapacity: { slots: 4, weight: 20, size: 15 } })

  pawn.addItemToInventory(basket)
  assert.strictEqual(pawn.inventorySlots, 6)

  pawn.removeItemFromInventory('k1')
  assert.strictEqual(pawn.inventorySlots, 2, 'the bonus was borrowed, not owned')
  assert.strictEqual(pawn.hasContainer(), false)
  assert.strictEqual(pawn.addItemToInventory(makeItem('water', 'w1')), false, 'and water is heavy-handed again')
})

test('putting an item back after a failed hand-over cannot count twice', () => {
  // transferItems() rolls a failed move back by re-adding the very same object. If the
  // bonus were applied per call rather than per carrier, every retry would widen the
  // pack again until a pawn could carry the world.
  const { pawn } = weavingGround()
  const basket = makeItem('basket', 'k1', { slotType: 'container', increasesCapacity: { slots: 4 } })

  pawn.addItemToInventory(basket)
  assert.strictEqual(pawn.inventorySlots, 6)

  pawn.addItemToInventory(basket)
  pawn.addItemToInventory(basket)
  assert.strictEqual(pawn.inventorySlots, 6, 'the same basket in the same pack lends its room once')

  pawn.removeItemFromInventory('k1')
  pawn.removeItemFromInventory('k1')
  assert.strictEqual(pawn.inventorySlots, 2, 'and leaving releases it once')
})

test('goods given away in trade close the room they were lending', () => {
  const { pawn } = weavingGround()
  const basket = makeItem('basket', 'k1', { slotType: 'container', increasesCapacity: { slots: 4 } })
  pawn.addItemToInventory(basket)
  for (const id of ['f1', 'f2', 'f3', 'f4']) pawn.addItemToInventory(makeItem('fiber', id))

  assert.strictEqual(pawn.canHold('rock', 1), true, 'six slots, five goods, room for one more')
  assert.strictEqual(
    pawn.canHold('rock', 1, [basket]),
    false,
    'but if she hands the basket over first, she is four goods in a two-slot pack'
  )
})

test('full hands pick the craft that makes room', () => {
  const { pawn } = weavingGround()
  const cordage = getRecipe('cordage')
  const basket = getRecipe('basket')

  pawn.inventory = [makeItem('rock', 'r1'), makeItem('rock', 'r2')]
  assert.strictEqual(pawn.chooseCraft([cordage, basket]).id, 'basket', 'she is out of hands, so she weaves hands')

  pawn.inventory = [makeItem('rock', 'r1')]
  assert.strictEqual(pawn.chooseCraft([cordage, basket]).id, 'cordage', 'with room to spare she just gets on with the list')
})

test('a craft that comes up short at the source gives the pack back', () => {
  // The pre-check asks the world how much fibre is around; the weave then asks the
  // plants to hand it over. When those two disagree - a patch that looks gatherable but
  // will not yield - craft() used to return null having already eaten the fibres it
  // took out of the pack, so a failed attempt was punished twice (#112).
  const { world, pawn } = weavingGround()
  pawn.addItemToInventory(makeItem('fiber', 'f1'))
  pawn.addItemToInventory(makeItem('fiber', 'f2'))
  const stub = {
    id: 'patch2',
    type: 'resource',
    subtype: 'fiber',
    x: 103,
    y: 100,
    quantity: 0,
    tags: ['fiber'],
    canConsume: () => true,
    consume: () => 0
  }
  world.addEntity(stub)

  assert.strictEqual(pawn.craft(getRecipe('basket')), null, 'the third fibre never arrives')
  assert.deepStrictEqual(
    pawn.inventory.map(item => item.id).sort(),
    ['f1', 'f2'],
    'and the two that had left are back, in whatever order they were handed over'
  )
})

test('capacity is what made a surplus impossible', () => {
  const { pawn } = weavingGround()
  // hasSurplus wants more than three of a kind, which a two-slot pack cannot hold:
  // the merchant code had nothing to sell because the pawn was built too small to own
  // anything twice over.
  pawn.addItemToInventory(makeItem('basket', 'k1', { slotType: 'container', increasesCapacity: { slots: 4 } }))
  for (const id of ['f1', 'f2', 'f3', 'f4']) {
    assert.ok(pawn.addItemToInventory(makeItem('fiber', id)), `${id} fits once the pack is wide`)
  }
  assert.strictEqual(hasSurplus(pawn, 'fiber'), true)

  const bare = weavingGround('bo').pawn
  assert.ok(bare.addItemToInventory(makeItem('fiber', 'g1')))
  assert.ok(bare.addItemToInventory(makeItem('fiber', 'g2')))
  assert.strictEqual(bare.addItemToInventory(makeItem('fiber', 'g3')), false, 'two hands, two fibres')
  assert.strictEqual(hasSurplus(bare, 'fiber'), false, 'and no amount of gathering changes that')
})
