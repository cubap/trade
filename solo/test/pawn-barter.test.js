import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import * as PawnMercantile from '../js/models/entities/mobile/PawnMercantile.js'

// Bartering is the one skill a pawn can earn from somebody else's decision, so
// who gets paid for it matters. acceptBarter already pays both sides of a
// completed exchange, but the barter goal paid its initiator again on top: asking
// for a trade was worth twice the practice of answering one (#107).
//
// Fixing that meant repairing the road to it, which had never been driven on. The
// goal asked the partner for partner.countItem() - counting is a function in
// PawnMercantile and PawnInventory, never a method on Pawn - so any pawn with a
// surplus that met another pawn threw a TypeError before an offer was written.
// The type it wanted next came out of Object.keys(partner.inventory), and an
// inventory is an array of item objects, so that returned indices, not types. And
// the goal traded at up to 10 units while acceptBarter only recognised a partner
// within 1, so even a repaired lookup would have "completed" trades nobody agreed
// to.

function makeItem(type, id) {
  return { id, type, name: type, weight: 1, size: 1 }
}

function countOf(pawn, type) {
  return pawn.inventory.filter(item => item.type === type).length
}

function tradingPair(partnerDistance = 2) {
  const world = new World(300, 300)
  const ada = new Pawn('ada', 'Ada', 100, 100)
  const bo = new Pawn('bo', 'Bo', 100 + partnerDistance, 100)
  world.addEntity(ada)
  world.addEntity(bo)

  ada.inventorySlots = 20
  bo.inventorySlots = 20
  // Ada drowns in sticks, Bo in rocks.
  ada.inventory = ['a1', 'a2', 'a3', 'a4', 'a5'].map(id => makeItem('stick', id))
  bo.inventory = ['b1', 'b2', 'b3', 'b4'].map(id => makeItem('rock', id))
  // A stranger cannot open a barter without some standing in the craft.
  ada.skills.bartering = 1
  bo.skills.bartering = 1

  return { world, ada, bo }
}

test('a pawn with surplus finds the other pawn instead of throwing', () => {
  const { ada, bo } = tradingPair()

  assert.strictEqual(PawnMercantile.findTradePartner(ada, 50), bo)
})

test('a completed barter pays both sides the same amount of practice', () => {
  const { ada, bo } = tradingPair()
  const offer = PawnMercantile.initiateBarter(ada, bo, 'stick', 2, 'rock', 1)
  assert.ok(offer, 'Ada can offer sticks she has a surplus of for a rock')

  assert.strictEqual(PawnMercantile.acceptBarter(bo, offer), true)
  assert.strictEqual(ada.getSkill('bartering'), 2, 'the initiator earns one point')
  assert.strictEqual(bo.getSkill('bartering'), 2, 'and so does the pawn who answered')
})

test('pawns further apart than one unit can still change hands', () => {
  const { ada, bo } = tradingPair(3)
  const offer = PawnMercantile.initiateBarter(ada, bo, 'stick', 2, 'rock', 1)

  // The old reach of 1 unit matched nothing in the goal that called it, so trades
  // three units apart failed silently.
  assert.strictEqual(PawnMercantile.acceptBarter(bo, offer), true)

  const far = tradingPair(PawnMercantile.TRADE_REACH + 5)
  const distantOffer = PawnMercantile.initiateBarter(far.ada, far.bo, 'stick', 2, 'rock', 1)
  assert.strictEqual(
    PawnMercantile.acceptBarter(far.bo, distantOffer),
    false,
    'the reach is one agreed number, not no number'
  )
})

test('the barter goal trades once and pays its initiator once', () => {
  const { world, ada, bo } = tradingPair()

  ada.goals.currentGoal = { type: 'barter', description: 'Trade sticks for rocks' }

  for (let i = 0; i < 6; i++) {
    world.clock.currentTick = i + 1
    if (!ada.goals.currentGoal) break
    ada.goals.updateGoalSpecificLogic()
  }

  assert.strictEqual(ada.goals.currentGoal, null, 'the barter goal should have completed')
  assert.strictEqual(countOf(ada, 'rock'), 1, 'Ada came away with a rock')
  assert.strictEqual(countOf(bo, 'stick'), 2, 'Bo came away with two sticks')
  assert.strictEqual(countOf(ada, 'stick'), 3, 'Ada gave up the surplus she offered')

  // Both sit at 2: the seeded point plus one for this trade. Before #107 the
  // initiator was pushed to 3 by the goal's own award.
  assert.strictEqual(ada.getSkill('bartering'), 2, 'the initiator is not paid twice')
  assert.strictEqual(bo.getSkill('bartering'), 2, 'the answerer is paid once')
})
