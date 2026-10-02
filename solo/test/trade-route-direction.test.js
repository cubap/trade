import test from 'node:test'
import assert from 'node:assert'

import { recordTrade } from '../js/core/PriceRegistry.js'
import {
  createRoute,
  findRoute,
  findBestRoute,
  updateRouteSafety,
  isRouteActive,
  getRoutesFrom,
  ROUTE_TRADE_MARGIN,
  ROUTE_SAFETY_FLOOR
} from '../js/core/TradeRoutes.js'
import * as PawnMercantile from '../js/models/entities/mobile/PawnMercantile.js'

// #118. `findBestRoute` priced every road in the direction the table happened to
// have written it, and accepted any spread above zero. Together those two faults
// meant its answer could not be trusted rather than merely being rough: with one
// road in the world whose far end was four fifths cheaper, it returned that road
// as "the best route", spread 0.2 and all, and there was no way for a caller to
// tell that apart from a real opportunity - "no route" was `null` and "a route
// that loses four fifths of your cargo" was an object. Meanwhile a merchant
// standing at the *dear* end of a road recorded from the other side could not be
// told about the profitable direction at all, because `spread` was a property of
// the stored pair.
//
// The stored direction is not a meaningful thing to rank on. `Pawn.noteTradeRoute`
// normalises the pair so both traders maintain one entry (`const [a, b] = here <
// there ? ...`), so the order a road is written in is alphabetical - which is at
// least deterministic, unlike the "whoever initiated the barter" this issue
// assumed, but no more related to economics than a coin flip is.
//
// A road now has two legs, the walker decides which one is walkable, and a spread
// that does not clear the margin is not a route.

/** Two markets and a road, priced by hand. */
function registry(...quotes) {
  const reg = { prices: {} }
  for (const [type, market, price] of quotes) recordTrade(reg, type, market, price, 0)
  return reg
}

function road(from, to, tweaks = {}) {
  return { from, to, trips: 1, lastTrip: 0, safetyScore: 1, distance: null, ...tweaks }
}

test('a road is walked from the end the merchant is standing at', () => {
  const routes = { list: [road('Lake', 'Hill')] }
  const prices = registry(['stick', 'Hill', 1], ['stick', 'Lake', 5])

  const best = findBestRoute(routes, prices, 'stick', 'Hill')

  assert.ok(best, 'the road is usable from the Hill end')
  assert.strictEqual(best.leaveAt, 'Hill')
  assert.strictEqual(best.sellAt, 'Lake', 'Lake is where sticks are worth five')
  assert.strictEqual(best.spread, 5)
  assert.strictEqual(best.from, 'Lake', 'from/to stay as stored; the leg is the new information')
})

test('the same road, from the other end, is not a route at all', () => {
  const routes = { list: [road('Lake', 'Hill')] }
  const prices = registry(['stick', 'Hill', 1], ['stick', 'Lake', 5])

  // Walking Hill-ward sells into the cheap market. This is the direction the old
  // ranking preferred - it was the one written down.
  assert.strictEqual(findBestRoute(routes, prices, 'stick', 'Lake'), null)
})

test('a losing walk used to come back as the best route', () => {
  const routes = { list: [road('Lake', 'Hill')] }
  const prices = registry(['stick', 'Hill', 0.2], ['stick', 'Lake', 1])

  // One road, a positive spread in the stored direction (1 -> 0.2 is a spread of
  // 0.2, which beat the initial `bestSpread = 0`), and no margin anywhere in the
  // function. Four fifths of the cargo gone, presented as an opportunity.
  const best = findBestRoute(routes, prices, 'stick', 'Lake')
  assert.strictEqual(best, null, 'a spread under 1 is a loss, not a route')
})

test('with no walker named, the better direction wins, not the written one', () => {
  const routes = { list: [road('Hill', 'Lake')] }
  const prices = registry(['stick', 'Hill', 5], ['stick', 'Lake', 1])

  const best = findBestRoute(routes, prices, 'stick')

  assert.strictEqual(best.leaveAt, 'Lake', 'the entry says Hill first; the money says start at Lake')
  assert.strictEqual(best.sellAt, 'Hill')
  assert.strictEqual(best.spread, 5)
})

test('the margin is what a spread has to clear, and clearing it exactly is not clearing it', () => {
  const routes = { list: [road('Hill', 'Lake')] }
  const prices = registry(['stick', 'Hill', 1], ['stick', 'Lake', ROUTE_TRADE_MARGIN])

  assert.strictEqual(findBestRoute(routes, prices, 'stick'), null, '1.2 exactly is the floor, not above it')
  assert.strictEqual(
    findBestRoute(routes, prices, 'stick', null, { margin: 1 }).spread,
    ROUTE_TRADE_MARGIN,
    'a caller who wants every positive spread can still ask for them'
  )
})

test('a road the walker is not standing on is not theirs to walk yet', () => {
  const routes = { list: [road('Hill', 'Lake')] }
  const prices = registry(['stick', 'Hill', 1], ['stick', 'Lake', 5])

  assert.strictEqual(findBestRoute(routes, prices, 'stick', 'River'), null)
  assert.ok(findBestRoute(routes, prices, 'stick'), 'the road is fine; the walker is elsewhere')
  // Getting to the near end is a journey, which is #99's problem, not this function's.
})

test('an unsafe road is unsafe in both directions', () => {
  const atFloor = { list: [road('Lake', 'Hill', { safetyScore: ROUTE_SAFETY_FLOOR })] }
  const above = { list: [road('Lake', 'Hill', { safetyScore: ROUTE_SAFETY_FLOOR + 0.01 })] }
  const prices = registry(['stick', 'Hill', 1], ['stick', 'Lake', 5])

  assert.strictEqual(findBestRoute(atFloor, prices, 'stick'), null, 'the old exclusive comparison is kept')
  assert.ok(findBestRoute(above, prices, 'stick'), 'and only the truly abandoned road is dropped')
})

test('ties break on the road, not on the order the table was built', () => {
  const prices = registry(['stick', 'Hill', 1], ['stick', 'Lake', 5], ['stick', 'River', 1])
  const shortThenLong = { list: [road('Hill', 'Lake', { distance: 40 }), road('River', 'Lake', { distance: 400 })] }
  assert.strictEqual(findBestRoute(shortThenLong, prices, 'stick', null, { margin: 1 }).from, 'Hill')
  assert.strictEqual(
    findBestRoute({ list: shortThenLong.list.slice().reverse() }, prices, 'stick', null, { margin: 1 }).from,
    'Hill',
    'the same two roads listed the other way round give the same answer'
  )

  const equalDistance = {
    list: [road('Hill', 'Lake', { distance: 40, trips: 2 }), road('River', 'Lake', { distance: 40, trips: 9 })]
  }
  assert.strictEqual(
    findBestRoute(equalDistance, prices, 'stick', null, { margin: 1 }).from,
    'River',
    'a road walked nine times beats one walked twice, ties and all'
  )

  const noDistances = { list: [road('Hill', 'Lake'), road('River', 'Lake')] }
  assert.strictEqual(
    findBestRoute(noDistances, prices, 'stick', null, { margin: 1 }).from,
    'Hill',
    'with nothing to distinguish them, the first one stands - deterministically'
  )
})

test('an incident on the way home degrades the road', () => {
  const routes = { list: [road('Lake', 'Hill')] }

  // The return trip reports the walk it took, Hill -> Lake. The table only holds
  // the Lake -> Hill entry, because a road runs both ways; the old directional
  // lookup found nothing and the road stayed spotless.
  updateRouteSafety(routes, 'Hill', 'Lake', 1)
  assert.ok(Math.abs(routes.list[0].safetyScore - 0.8) < 1e-9, `first incident leaves ${routes.list[0].safetyScore}`)

  updateRouteSafety(routes, 'Lake', 'Hill', 1)
  assert.ok(Math.abs(routes.list[0].safetyScore - 0.6) < 1e-9, 'and the outbound direction still works')

  assert.strictEqual(isRouteActive(routes, 'Hill', 'Lake', 100), true, 'a road recorded the other way is still recent')
  assert.strictEqual(isRouteActive(routes, 'Hill', 'Lake', 10000), false, 'but it does go stale')
  assert.strictEqual(getRoutesFrom(routes, 'Lake').length, 1)
  assert.strictEqual(getRoutesFrom(routes, 'Hill').length, 1, 'either end counts as touching this place')
  assert.strictEqual(findRoute(routes, 'Hill', 'Lake'), routes.list[0])
})

test('the road table and the merchant share one idea of "worth the trip"', () => {
  assert.strictEqual(
    PawnMercantile.PRICE_TRADE_MARGIN,
    ROUTE_TRADE_MARGIN,
    '#114 invented a margin in the merchant and #118 needed the same one in the road; two numbers would drift'
  )
})

test('a road made the way the sim makes it can be sold down in either direction', () => {
  const routes = { list: [] }
  // noteTradeRoute normalises alphabetically, so this is what the world actually stores.
  createRoute(routes, 'Hill', 'Lake', 0, { distance: 120 })
  const prices = registry(['stick', 'Hill', 1], ['stick', 'Lake', 4])

  const fromHill = findBestRoute(routes, prices, 'stick', 'Hill')
  assert.strictEqual(fromHill.sellAt, 'Lake')
  assert.strictEqual(fromHill.spread, 4)
  assert.strictEqual(fromHill.distance, 120, 'the #95 measurements ride along with the leg')

  assert.strictEqual(findBestRoute(routes, prices, 'stick', 'Lake'), null, 'and back is a loss')
})
