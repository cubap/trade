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

// ---------------------------------------------------------------------------
// #109: the exchange itself. acceptBarter took the goods out of both packs,
// attempted the placements, ignored the answers and returned true - so anything
// a full pack refused had already left its owner and simply stopped existing,
// while both pawns were paid the practice for a trade that had not happened.
// The fix is the mirror of initiateBarter's "do you still have it" checks: decide
// before anything moves, and undo the whole exchange if a placement fails anyway.

function totalItems(...pawns) {
  return pawns.reduce((sum, p) => sum + p.inventory.length, 0)
}

function types(pawn) {
  return pawn.inventory.map(item => item.type).sort()
}

function handOffer(fields) {
  // Bypasses initiateBarter, which now screens the same room itself, so these
  // tests can put a doomed offer in front of acceptBarter on purpose.
  return {
    id: 'offer_test',
    initiator: fields.initiator,
    target: fields.target ?? null,
    offerType: fields.offerType,
    offerAmount: fields.offerAmount,
    wantType: fields.wantType,
    wantAmount: fields.wantAmount,
    ratio: fields.offerAmount / fields.wantAmount,
    timestamp: 0
  }
}

test('a completed barter moves goods around, it does not clone or consume them', () => {
  const { ada, bo } = tradingPair()
  const before = totalItems(ada, bo)
  const offer = PawnMercantile.initiateBarter(ada, bo, 'stick', 2, 'rock', 1)

  assert.strictEqual(PawnMercantile.acceptBarter(bo, offer), true)
  assert.strictEqual(totalItems(ada, bo), before, 'the world is no poorer for the trade')
  assert.deepStrictEqual(types(ada), ['rock', 'stick', 'stick', 'stick'])
  assert.deepStrictEqual(types(bo), ['rock', 'rock', 'rock', 'stick', 'stick'])
  assert.ok(
    [...ada.inventory, ...bo.inventory].every(item => item.id),
    'the items that changed hands are the same items, not fresh copies'
  )
})

test('a pack with no room refuses the trade instead of eating the goods', () => {
  const { ada, bo } = tradingPair()
  // Bo hands over one rock and would need two free slots for the sticks. Three
  // slots holds his remaining three rocks or the two sticks, never both.
  bo.inventorySlots = 3
  const before = totalItems(ada, bo)
  const offer = handOffer({
    initiator: ada.id,
    offerType: 'stick',
    offerAmount: 2,
    wantType: 'rock',
    wantAmount: 1
  })

  assert.strictEqual(PawnMercantile.acceptBarter(bo, offer), false)
  assert.deepStrictEqual(types(ada), ['stick', 'stick', 'stick', 'stick', 'stick'], 'Ada kept her sticks')
  assert.deepStrictEqual(types(bo), ['rock', 'rock', 'rock', 'rock'], 'Bo kept his rocks')
  assert.strictEqual(totalItems(ada, bo), before, 'nothing was deleted to find out')
  assert.strictEqual(ada.getSkill('bartering'), 1, 'a trade that did not happen pays nobody')
  assert.strictEqual(bo.getSkill('bartering'), 1)
})

test('room is counted after the goods a pack is giving up', () => {
  // Bo empties one rock to take two sticks, so five slots is enough and four is
  // not. Refusing the four-slot trade is right; refusing the five-slot one would
  // quietly starve every pawn whose hands are nearly full.
  const tight = tradingPair()
  tight.bo.inventorySlots = 4
  assert.strictEqual(PawnMercantile.initiateBarter(tight.ada, tight.bo, 'stick', 2, 'rock', 1), null)

  const roomy = tradingPair()
  roomy.bo.inventorySlots = 5
  assert.ok(PawnMercantile.initiateBarter(roomy.ada, roomy.bo, 'stick', 2, 'rock', 1), 'one more slot makes it a trade')
})

test('a pawn does not ask for goods it cannot carry home', () => {
  const { ada, bo } = tradingPair()
  ada.inventorySlots = 3 // five sticks less two is three, and the rock would be the fourth
  assert.strictEqual(PawnMercantile.initiateBarter(ada, bo, 'stick', 2, 'rock', 1), null)
})

test('water nobody can hold is not traded for', () => {
  const { ada, bo } = tradingPair()
  ada.inventory.push({ id: 'w1', type: 'water', name: 'water', weight: 1, size: 1 })
  ada.inventory.push({ id: 'w2', type: 'water', name: 'water', weight: 1, size: 1 })
  const before = totalItems(ada, bo)
  const offer = handOffer({
    initiator: ada.id,
    offerType: 'water',
    offerAmount: 2,
    wantType: 'rock',
    wantAmount: 1
  })

  assert.strictEqual(PawnMercantile.acceptBarter(bo, offer), false, 'Bo has no container')
  assert.strictEqual(countOf(ada, 'water'), 2, 'so the water stayed with Ada')
  assert.strictEqual(totalItems(ada, bo), before)

  // The same offer, one bowl later, is a trade: the refusal is about the
  // container, not a blanket veto on water.
  const withBowl = tradingPair()
  withBowl.bo.inventory.push({ id: 'c1', type: 'bowl', name: 'bowl', slotType: 'container', weight: 1, size: 1 })
  withBowl.ada.inventory.push({ id: 'w3', type: 'water', name: 'water', weight: 1, size: 1 })
  withBowl.ada.inventory.push({ id: 'w4', type: 'water', name: 'water', weight: 1, size: 1 })
  const bowlOffer = handOffer({
    initiator: withBowl.ada.id,
    offerType: 'water',
    offerAmount: 2,
    wantType: 'rock',
    wantAmount: 1
  })
  assert.strictEqual(PawnMercantile.acceptBarter(withBowl.bo, bowlOffer), true)
  assert.strictEqual(countOf(withBowl.bo, 'water'), 2, 'Bo carries the water now')
  assert.strictEqual(countOf(withBowl.ada, 'water'), 0)
})

test('takeItems gives up the whole amount it was asked for', () => {
  const { ada } = tradingPair()
  // It used to walk the live array while splicing it, so the cursor skipped every
  // other item and three sticks could not be had from a pack of five.
  assert.strictEqual(PawnMercantile.takeItems(ada, 'stick', 3).length, 3)
  assert.strictEqual(countOf(ada, 'stick'), 2)
  assert.strictEqual(PawnMercantile.takeItems(ada, 'stick', 5).length, 2, 'and no more than the pack holds')
})

test('a barter goal gives up when the other pawn has no room', () => {
  const { world, ada, bo } = tradingPair()
  bo.inventorySlots = 1 // he cannot carry Ada's sticks, nor spare a rock for them
  ada.goals.currentGoal = { type: 'barter', description: 'Trade sticks for rocks' }

  const before = totalItems(ada, bo)
  for (let i = 0; i < 6; i++) {
    world.clock.currentTick = i + 1
    if (!ada.goals.currentGoal) break
    ada.goals.updateGoalSpecificLogic()
  }

  // A refusal used to be impossible here: acceptBarter always said true. Ending
  // the goal is the difference between a pawn that shrugs and a pawn that walks
  // into the same full pack for the rest of the simulation.
  assert.strictEqual(ada.goals.currentGoal, null, 'a refused trade ends the goal instead of hanging the pawn on it')
  assert.strictEqual(totalItems(ada, bo), before, 'and it ends with every item still in somebody hands')
  assert.strictEqual(ada.getSkill('bartering'), 1, 'no practice for a trade nobody made')
})

test('the placement is a net under the pre-check, not a second way to lose goods', () => {
  const { ada, bo } = tradingPair()
  // canHold() is the doorkeeper; the rollback only runs when the two disagree, so
  // blind the doorkeeper and make Bo unable to hold anything at all.
  bo.canHold = undefined
  bo.inventorySlots = 0
  const before = totalItems(ada, bo)
  const offer = handOffer({
    initiator: ada.id,
    offerType: 'stick',
    offerAmount: 2,
    wantType: 'rock',
    wantAmount: 1
  })

  assert.strictEqual(PawnMercantile.acceptBarter(bo, offer), false)
  assert.strictEqual(totalItems(ada, bo), before, 'two packs and nine items, however they are split')
  assert.strictEqual(countOf(bo, 'rock'), 3, 'the rock Bo gave up is still in the world')
  assert.strictEqual(ada.getSkill('bartering'), 1)
})

