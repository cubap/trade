import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import * as PawnMercantile from '../js/models/entities/mobile/PawnMercantile.js'
import {
  recordTrade,
  getPrice,
  isPriceStale,
  detectArbitrage,
  pruneOldPrices,
  PRICE_MAX_AGE,
  PRICE_PRUNE_INTERVAL
} from '../js/core/PriceRegistry.js'
import { createRoute } from '../js/core/TradeRoutes.js'

// #110 taught a completed barter to write down what it paid, and #114 is the
// other half of that: a price nobody reads is a number in a drawer, and a price
// nobody throws away is a lie that never dies. Before this, four functions in
// PriceRegistry (isPriceStale, pruneOldPrices, detectArbitrage and, through an
// empty table, findBestRoute) had no caller in the sim, and shouldSeekTrade()
// decided to go trading from surplus, skill and hunger alone - never from what
// anything was worth.
//
// These are behaviour tests on purpose. The mercantile module's shape is already
// pinned by source-string assertions in phase3-mercantile-trade.test.js; what
// matters here is that the merchant's choices actually move when the numbers do.

function makeItem(type, id) {
  return { id, type, name: type, weight: 1, size: 1 }
}

/** A pawn with a home, so its trades - and its prices - belong to a market. */
function trader(name, label, x, y, market, holding, count) {
  const pawn = new Pawn(name, label, x, y)
  pawn.inventorySlots = 30
  pawn.inventory = Array.from({ length: count }, (_, i) => makeItem(holding, `${name}${i}`))
  pawn.memoryMap.push({ type: 'shelter', name: market, x, y, significance: 8 })
  return pawn
}

/** Ada at Hill with sticks, Bo at Lake and Cy at Valley, both worth trading with. */
function threeMarkets() {
  const world = new World(400, 400)
  const ada = trader('ada', 'Ada', 100, 100, 'Hill', 'stick', 5)
  const bo = trader('bo', 'Bo', 110, 100, 'Lake', 'rock', 4)
  const cy = trader('cy', 'Cy', 130, 100, 'Valley', 'shell', 4)
  for (const pawn of [ada, bo, cy]) {
    pawn.skills.bartering = 1
    world.addEntity(pawn)
  }

  return { world, ada, bo, cy }
}

// ---------------------------------------------------------------------------
// A market that has gone quiet stops quoting

test('pruning forgets a market whose every observation has aged out', () => {
  const registry = { prices: {} }
  recordTrade(registry, 'stick', 'Lake', 3, 0)
  recordTrade(registry, 'stick', 'Hill', 1, 900)

  const forgotten = pruneOldPrices(registry, 1200)

  assert.strictEqual(forgotten, 1, 'Lake has nothing young left to say')
  assert.strictEqual(getPrice(registry, 'stick', 'Lake'), null, 'a dead market quotes nothing')
  assert.strictEqual(isPriceStale(registry, 'stick', 'Lake', 1200), true, 'and the two readers agree')
  assert.strictEqual(getPrice(registry, 'stick', 'Hill'), 1, 'the young market is untouched')
})

test('the ghost price that arbitrage used to shop by is gone', () => {
  const registry = { prices: {} }
  recordTrade(registry, 'stick', 'Lake', 9, 0)
  recordTrade(registry, 'stick', 'Hill', 1, 1190)

  // The old pruneOldPrices() recomputed inside `if (observations.length > 0)`
  // with no else: Lake's array emptied, its `average` stayed at 9, isPriceStale
  // called it dead, and detectArbitrage - which reads averages only - filed a
  // nine-fold spread to a market that had not traded in a thousand ticks.
  pruneOldPrices(registry, 1200)

  assert.strictEqual(detectArbitrage(registry, 'stick', 1.5), null, 'one live market is not a spread')
  assert.deepStrictEqual(Object.keys(registry.prices.stick), ['Hill'])
})

test('pruning keeps the average weighted toward what is left', () => {
  const registry = { prices: {} }
  recordTrade(registry, 'rock', 'Lake', 10, 0)
  recordTrade(registry, 'rock', 'Lake', 1, 1000)
  assert.strictEqual(getPrice(registry, 'rock', 'Lake'), 4, 'the old trade still drags the mean up')

  pruneOldPrices(registry, 1200)

  assert.strictEqual(getPrice(registry, 'rock', 'Lake'), 1, 'once it is gone the price is the recent trade')
  assert.strictEqual(registry.prices.rock.Lake.observations.length, 1)
})

test('the world sweeps its own price table', () => {
  const world = new World(300, 300)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 3, 0)

  // Nothing in the sim called pruneOldPrices, so a busy market grew one
  // observation per trade for the rest of the run - and every trade recomputed
  // a weighted average across all of it.
  //
  // The clock only ticks once per update() and needs a timestamp to measure
  // against, so walk it to a multiple of the sweep interval rather than
  // assigning currentTick behind its back.
  const ticks = PRICE_MAX_AGE + PRICE_PRUNE_INTERVAL
  const log = console.log
  console.log = () => {}
  world.update(1)
  for (let t = 2; t <= ticks + 1; t++) world.update(t * world.clock.msPerTick)
  console.log = log

  assert.strictEqual(world.tick, ticks, 'the run really got that far')
  assert.strictEqual(getPrice(world.priceRegistry, 'stick', 'Lake'), null, 'the sweep ran by itself')
})

// ---------------------------------------------------------------------------
// The merchant shops by the numbers it has

test('a pawn with no recorded prices has no advantage to trade on', () => {
  const { ada, bo } = threeMarkets()

  assert.strictEqual(PawnMercantile.priceAdvantage(ada, bo), null)
})

test('price advantage is what the surplus is worth there over here', () => {
  const { world, ada, bo } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 3, 0)

  const signal = PawnMercantile.priceAdvantage(ada, bo)

  assert.ok(signal)
  assert.strictEqual(signal.type, 'stick')
  assert.strictEqual(signal.gain, 3)
  assert.strictEqual(signal.market, 'Lake')
})

test('a stale price at either end is no price at all', () => {
  const { world, ada, bo } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 9, 0)
  world.clock.currentTick = 4000

  assert.strictEqual(PawnMercantile.priceAdvantage(ada, bo), null)
})

test('a neighbour whose market pays better beats the nearest one', () => {
  const { world, ada, bo, cy } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Valley', 4, 0)

  // findTradePartner() returned the first pawn carrying anything we lacked, so
  // Ada walked up to Bo in a market that pays the same as her own while Cy stood
  // a few steps further off paying four times as much.
  assert.strictEqual(PawnMercantile.findTradePartner(ada, 50), cy)
})

test('a thin spread is not worth a second thought', () => {
  const { world, ada, bo, cy } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Valley', 1.1, 0)

  assert.strictEqual(
    PawnMercantile.findTradePartner(ada, 50),
    bo,
    'below the margin the old proximity answer stands'
  )
})

test('an unpriced world still trades with whoever is there', () => {
  const { ada, bo, cy } = threeMarkets()

  assert.strictEqual(PawnMercantile.findTradePartner(ada, 50), bo)
})

// ---------------------------------------------------------------------------
// Going out to trade is a decision the numbers get a vote in

test('a hungry merchant goes out for need', () => {
  const { world, ada } = threeMarkets()
  // Needs are 0-100 urgency that grow, so a rumbling stomach is a high number.
  ada.needs.needs.hunger = 70
  recordTrade(world.priceRegistry, 'stick', 'Hill', 2, 0)

  assert.deepStrictEqual(PawnMercantile.tradeMotivation(ada), { seek: true, reason: 'need' })
  assert.strictEqual(PawnMercantile.shouldSeekTrade(ada), true)
})

test('a merchant in real trouble is not a merchant out trading', () => {
  const { world, ada } = threeMarkets()
  ada.needs.needs.hunger = 95
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Valley', 9, 0)

  // The clause that was supposed to say this read pawn.needs.food.value, which
  // has never existed, so starvation never once grounded a trader.
  assert.strictEqual(PawnMercantile.tradeMotivation(ada).seek, false)
})

test('a fed merchant goes out for profit', () => {
  const { world, ada } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Valley', 4, 0)

  const motive = PawnMercantile.tradeMotivation(ada)
  assert.strictEqual(motive.seek, true)
  assert.strictEqual(motive.reason, 'profit')
  assert.strictEqual(motive.opportunity.sellAt, 'Valley')
})

test('a fed merchant stays home when the table says nothing is dearer anywhere', () => {
  const { world, ada } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 2, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 2, 0)

  assert.strictEqual(PawnMercantile.tradeMotivation(ada).seek, false)
  assert.strictEqual(PawnMercantile.shouldSeekTrade(ada), false)
})

test('a young world with no prices at all still trades', () => {
  const { ada } = threeMarkets()

  // An empty table is not "worthless", it is "too early to tell" - and the trades
  // are what fill the table, so a blank ledger must not ground the merchants.
  assert.deepStrictEqual(PawnMercantile.tradeMotivation(ada), { seek: true, reason: 'instinct' })
})

test('being stood in the dear market is not a reason to travel', () => {
  const { world, ada } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 9, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 1, 0)

  // Hill is where Ada already is; the profit is realised by trading with whoever
  // walks up, not by going out.
  assert.strictEqual(PawnMercantile.profitableMarket(ada), null)
})

test('dead prices are not an opportunity either', () => {
  const { world, ada } = threeMarkets()
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Valley', 9, 0)
  world.clock.currentTick = 3000

  assert.strictEqual(PawnMercantile.profitableMarket(ada), null)
})

test('a trader with nobody to swap with walks towards the dear market', () => {
  const { world, ada, bo, cy } = threeMarkets()
  // Empty their packs so findTradePartner() has no one to offer.
  bo.inventory = []
  cy.inventory = []

  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Valley', 4, 0)
  createRoute(world.tradeRoutes ?? (world.tradeRoutes = { list: [] }), 'Hill', 'Valley', 0)
  ada.memoryMap.push({ type: 'shelter', name: 'Valley', x: 900, y: 900, significance: 5 })

  const before = { x: ada.x, y: ada.y }
  ada.goals.currentGoal = { type: 'seek_trade', priority: 5, description: 'seek trade' }
  ada.goals.updateGoalSpecificLogic()

  assert.notStrictEqual(ada.nextTargetX, before.x, 'the wander is no longer a coin flip')
  assert.strictEqual(ada.nextTargetX, 900, 'it is the market the tables named')
  assert.strictEqual(ada.nextTargetY, 900)
})

test('a dear market nobody remembers is still a wander', () => {
  const { world, ada, bo, cy } = threeMarkets()
  bo.inventory = []
  cy.inventory = []

  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Valley', 4, 0)
  createRoute(world.tradeRoutes ?? (world.tradeRoutes = { list: [] }), 'Hill', 'Valley', 0)

  // A place cannot be walked to from memory alone: the price table knows the
  // name, memory knows the coordinates. Without the second, the old behaviour
  // has to stand - and it must still stand inside the map, not at a guess.
  ada.goals.currentGoal = { type: 'seek_trade', priority: 5, description: 'seek trade' }
  ada.goals.updateGoalSpecificLogic()

  assert.ok(Math.abs(ada.nextTargetX - ada.x) <= 50, 'wandered from home, not teleported')
  assert.ok(!ada.memoryMap.some(e => e.x === ada.nextTargetX && e.y === ada.nextTargetY))
})

// ---------------------------------------------------------------------------
// The road table and the price table finally speak to each other

test('a road to a dear market is worth walking', () => {
  const { world, ada } = threeMarkets()
  createRoute(world.tradeRoutes ?? (world.tradeRoutes = { list: [] }), 'Hill', 'Lake', 0)
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 3, 0)

  const sought = PawnMercantile.bestMarketToSell(ada)

  assert.ok(sought, 'findBestRoute() had no caller in the sim at all')
  assert.strictEqual(sought.market, 'Lake')
  assert.strictEqual(sought.gain, 3)
  assert.strictEqual(sought.type, 'stick')
})

test('a road that starts somewhere else is not ours to walk', () => {
  const { world, ada } = threeMarkets()
  world.tradeRoutes = { list: [{ from: 'River', to: 'Lake', trips: 1, safetyScore: 1 }] }
  recordTrade(world.priceRegistry, 'stick', 'River', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 8, 0)

  assert.strictEqual(PawnMercantile.bestMarketToSell(ada), null)
})

test('a road back from a dear market still leads to the dear end', () => {
  const { world, ada } = threeMarkets()
  // Written Lake -> Hill, but Ada stands at Hill and Lake is where sticks sell.
  world.tradeRoutes = { list: [{ from: 'Lake', to: 'Hill', trips: 1, safetyScore: 1 }] }
  recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
  recordTrade(world.priceRegistry, 'stick', 'Lake', 5, 0)

  assert.strictEqual(PawnMercantile.bestMarketToSell(ada).market, 'Lake')
})

test('a route with no prices on it goes nowhere', () => {
  const { world, ada } = threeMarkets()
  world.tradeRoutes = { list: [{ from: 'Hill', to: 'Lake', trips: 1, safetyScore: 1 }] }

  assert.strictEqual(PawnMercantile.bestMarketToSell(ada), null)
})
