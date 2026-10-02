import test from 'node:test'
import assert from 'node:assert/strict'

// #99: "Trade needs a journey: merchants should travel to a market".
//
// Before this, every trade in the game was chosen by proximity. `establish_trade`
// drew a random pawn out of the entity map, the generic completion test was
// "standing next to the target", and the goal therefore finished as a greeting:
// +0.3 convincing, both packs unchanged, no road. Meanwhile #94 had learned what
// a walk costs, #95 had started timing walks, #105 had made the walk wear the
// ground, #110 was booking the prices trades pay, and #118 could rank the roads
// out of a pawn's home by profit - all of it, with no caller.
//
// The tests below are the two halves of the journey: deciding to go (a profit
// *rate*, priced by the traffic on the road rather than by the crow line) and
// actually going (a walk that ends in goods changing hands, timed from the real
// departure, and abandoned when it outlasts a trading day).

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import * as PawnMercantile from '../js/models/entities/mobile/PawnMercantile.js'
import { recordTrade } from '../js/core/PriceRegistry.js'
import { createRoute, TRADE_DAY_TICKS } from '../js/core/TradeRoutes.js'

// The seed is pinned, not for looks: ChunkManager defaults to Math.random(), so an
// unpinned map moves the ground under a merchant's feet differently in every
// process. That is how the walk below came to fail one run in five (#89). Seed 7
// is one where the road from Hill to Valley happens to be dry - a movement plan
// stops at the bank of water it cannot cross, so a soaked map tests the fording
// that does not exist yet rather than the journey.
const MAP_SEED = 7

function makeWorld(tick = 0) {
    const world = new World(2000, 2000, { mapSeed: MAP_SEED })
    world.clock.currentTick = tick
    world.tradeRoutes ??= { list: [] }
    return world
}

function makeItem(type, id) {
    return { id, type, name: type, weight: 1, size: 1 }
}

/** A trader with a home fire it remembers and a pack of named goods. */
function trader(world, name, x, y, home, holdingTypes) {
    const pawn = new Pawn(name, name, x, y)
    pawn.inventorySlots = 30
    pawn.inventory = holdingTypes.map((type, i) => makeItem(type, `${name}${i}`))
    pawn.skills.bartering = 1
    world.addEntity(pawn)
    pawn.memoryMap.push({ type: 'shelter', name: home, x, y, significance: 8 })
    return pawn
}

/** A market Ada's tables know about: a road out of Hill, prices at both ends. */
function market(world, ada, name, { x, y, price, routeOptions = {} }) {
    ada.memoryMap.push({ type: 'shelter', name, x, y, significance: 6 })
    createRoute(world.tradeRoutes, 'Hill', name, world.clock.currentTick, routeOptions)
    recordTrade(world.priceRegistry, 'stick', 'Hill', 1, world.clock.currentTick)
    recordTrade(world.priceRegistry, 'stick', name, price, world.clock.currentTick)
}

/** Walk a pawn toward wherever it has decided to go, one tick at a time. */
function step(pawn) {
    const dx = pawn.nextTargetX - pawn.x
    const dy = pawn.nextTargetY - pawn.y
    const dist = Math.hypot(dx, dy)
    const stride = pawn.speed
    if (dist > stride) {
        pawn.x += (dx / dist) * stride
        pawn.y += (dy / dist) * stride
    } else {
        pawn.x = pawn.nextTargetX
        pawn.y = pawn.nextTargetY
    }
    pawn.world.clock.currentTick++
}

/** Run the goal until it ends, or until the pawn has had its whole life to. */
function walkUntil(pawn, limit = 4000) {
    let ticks = 0
    while (pawn.goals.currentGoal && ticks < limit) {
        pawn.goals.updateGoalSpecificLogic()
        step(pawn)
        ticks++
    }
    return ticks
}

// ------------------------------------------------------------------- deciding

test('a market is worth crossing the map for in proportion to what it pays', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    market(world, ada, 'Valley', { x: 600, y: 0, price: 6 })

    const journey = PawnMercantile.findTradeJourney(ada)

    assert.ok(journey, 'a spread of six against a walk of eight hundred ticks is money')
    assert.equal(journey.kind, 'market')
    assert.equal(journey.market, 'Valley')
    assert.equal(journey.type, 'stick')
    assert.equal(journey.gain, 6)
    assert.equal(journey.destination.x, 600, 'and memory says where the place is')
    assert.equal(journey.destination.y, 0)
})

test('the walk is priced by the traffic on the road, not by the crow line', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    market(world, ada, 'Valley', { x: 600, y: 0, price: 6 })

    const bushwhack = PawnMercantile.findTradeJourney(ada)
    // 600 units at Ada's 0.7 per tick, because #94 has nothing better to say
    // about ground no merchant has ever worn into a road.
    assert.equal(bushwhack.ticks, Math.round(600 / ada.speed))

    const route = world.tradeRoutes.list[0]
    route.averageTravelTime = 240
    const worn = PawnMercantile.findTradeJourney(ada)
    assert.equal(worn.ticks, 240, 'a road people walk is measured, not guessed')
    assert.ok(worn.rate > bushwhack.rate, 'and the measurement makes the trip look better')
})

test('a thin spread over a long walk is not a journey', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    // 30% on a four-hour walk: the goods would be worth less than the hunger
    // spent carrying them.
    market(world, ada, 'Valley', { x: 3000, y: 0, price: 1.3 })

    assert.equal(PawnMercantile.findTradeJourney(ada), null)
})

test('the same spread is worth going for once there is a road', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    market(world, ada, 'Valley', { x: 3000, y: 0, price: 1.3 })

    // The question "is it worth the walk" cannot be answered by distance, which
    // is why #99 ranks by rate: the road is the same road, cheaper to travel.
    world.tradeRoutes.list[0].averageTravelTime = 200
    const journey = PawnMercantile.findTradeJourney(ada)

    assert.ok(journey, 'the market is now worth setting out for')
    assert.equal(journey.ticks, 200)
})

test('a market that is already at hand is an errand, not a journey', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    market(world, ada, 'Valley', { x: 8, y: 0, price: 6 })

    assert.equal(PawnMercantile.findTradeJourney(ada), null, 'nothing to decide: trade from home')
})

test('a neighbour with an empty pack is a greeting, not a market', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    const bo = trader(world, 'Bo', 40, 0, 'Valley', [])
    recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
    recordTrade(world.priceRegistry, 'stick', 'Valley', 9, 0)

    // Bo's town pays nine, and Bo has nothing Ada wants to swap for.
    assert.equal(PawnMercantile.findTradeJourney(ada, { candidates: [bo] }), null)
})

test('a partner whose home pays well is a journey too', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    const bo = trader(world, 'Bo', 400, 0, 'Valley', ['rock', 'rock'])
    recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
    recordTrade(world.priceRegistry, 'stick', 'Valley', 7, 0)

    const journey = PawnMercantile.findTradeJourney(ada)

    assert.equal(journey.kind, 'partner', 'the road table never named Valley; Bo did')
    assert.equal(journey.partner, bo)
    assert.equal(journey.destination.x, 400)
})

// -------------------------------------------------------------------- walking

test('a merchant walks to the market and trades there', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    const bo = trader(world, 'Bo', 240, 0, 'Valley', ['rock', 'rock', 'rock', 'rock'])
    recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
    recordTrade(world.priceRegistry, 'stick', 'Valley', 7, 0)

    const goal = { type: 'establish_trade', priority: 1, description: 'trade at market' }
    ada.goals.currentGoal = goal

    const journey = PawnMercantile.findTradeJourney(ada)
    assert.ok(ada.goals.beginTradeJourney(goal, journey), 'the decision becomes a walk')
    assert.equal(goal.type, 'travel_route')
    assert.equal(goal.target, null, 'and stops being a person to touch')
    assert.equal(ada.nextTargetX, 240, 'the merchant is seen to start walking')
    assert.ok(ada.tradeTrip, 'the clock runs from the real departure')

    walkUntil(ada)

    assert.equal(ada.goals.currentGoal, null, 'the goal ended by itself')
    assert.ok(PawnMercantile.countItem(ada, 'rock') > 0, 'goods moved')
    assert.equal(ada.tradeTrip, null, 'the trip was closed')

    const route = world.tradeRoutes.list.find(r => r.from === 'Hill' || r.to === 'Hill')
    assert.ok(route, 'and the road the walk used is in the table')
    assert.ok(route.averageTravelTime > 200, 'timed as the whole journey, not the last few steps')
    assert.ok(route.averageTravelTime <= TRADE_DAY_TICKS, 'and short enough to be believed')
})

test('an empty market closes the clock and says nothing about the road', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    trader(world, 'Bo', 1200, 1200, 'Valley', ['rock'])
    recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 0)
    recordTrade(world.priceRegistry, 'stick', 'Valley', 7, 0)

    const goal = { type: 'travel_route', priority: 1, description: 'go to market' }
    ada.goals.currentGoal = goal
    ada.goals.beginTradeJourney(goal, {
        kind: 'market',
        market: 'Valley',
        type: 'stick',
        gain: 7,
        destination: { x: 200, y: 0, name: 'Valley' }
    })
    // The far end is empty: whoever the prices came from has moved on.
    const before = world.tradeRoutes.list.length

    walkUntil(ada)

    assert.equal(ada.goals.currentGoal, null, 'arriving at nothing still ends the goal')
    assert.equal(ada.tradeTrip, null, 'a clock left running would time the next journey wrongly')
    assert.equal(world.tradeRoutes.list.length, before, 'no goods moved, so no travel time claimed')
})

test('a walk that outlasts a trading day is given up', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    const goal = { type: 'travel_route', priority: 1, description: 'go to market' }
    ada.goals.currentGoal = goal
    ada.goals.beginTradeJourney(goal, {
        kind: 'market',
        market: 'Nowhere',
        type: 'stick',
        gain: 4,
        destination: { x: 1800, y: 0, name: 'Nowhere' }
    })

    // Something ate the afternoon - a predator, a river, a conversation.
    world.clock.currentTick = TRADE_DAY_TICKS + 1
    ada.goals.updateGoalSpecificLogic()

    assert.equal(ada.goals.currentGoal, null, 'the merchant admits the market was not worth it')
    assert.equal(ada.tradeTrip, null, 'and stops timing a journey nobody is walking')
})

test('a journey to a place is closed by whoever you actually trade with', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    const bo = trader(world, 'Bo', 240, 0, 'Valley', ['rock', 'rock'])

    // Ada set out for Valley without knowing Bo would be standing there.
    ada.beginTradeTrip(null, { name: 'Valley' })
    world.clock.currentTick = 90
    const { route } = ada.noteTradeRoute(bo)

    assert.ok(route, 'the place-trip belongs to the road, not to a person')
    assert.equal(route.averageTravelTime, 90)
    assert.equal(ada.tradeTrip, null)
})

test('a trip with neither a partner nor a place never started', () => {
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick'])
    const bo = trader(world, 'Bo', 10, 10, 'Valley', ['rock'])

    ada.beginTradeTrip(null, null)
    assert.ok(!ada.tradeTrip, 'a merchant loitering is not a merchant travelling')
    assert.equal(ada.endTradeTrip(), null, 'and there is nothing to return')

    ada.beginTradeTrip(null, { name: 'Valley' })
    ada.beginTradeTrip(bo, null)
    assert.equal(ada.tradeTrip.place, 'Valley', 'the clock is not re-started mid-journey')
    assert.equal(ada.tradeTrip.partner, null)

    world.clock.currentTick = 55
    assert.equal(ada.tradeTripAge(), 55)
    assert.equal(ada.endTradeTrip(), 55)
    assert.equal(ada.tradeTripAge(), 0)
})

test('a day is one number, shared by the walk and by the ledger', () => {
    // The figure that stops a journey and the figure above which a travel time
    // is not believed have to be the same figure, or a merchant can complete a
    // walk the road table refuses to remember.
    const world = makeWorld()
    const ada = trader(world, 'Ada', 0, 0, 'Hill', ['stick'])
    const bo = trader(world, 'Bo', 240, 0, 'Valley', ['rock'])

    ada.beginTradeTrip(bo)
    world.clock.currentTick = TRADE_DAY_TICKS + 500
    ada.noteTradeRoute(bo)

    const route = world.tradeRoutes.list.find(r => r.from === 'Hill' || r.to === 'Hill')
    assert.ok(route, 'the road is still a road')
    assert.equal(route.averageTravelTime, 0, 'but an implausible walk times nothing')
})

// ------------------------------------------------------------ walking unseen
// Most of a market road is off-screen, and the dormant simulation only knew how
// to fake a haggle. A merchant set loose on the road therefore stopped dead in
// the middle of it and waited for the goal commitment to expire, which meant
// the journey only worked while the player happened to be watching. #99

function advanceDormant(world, ticks) {
    for (let i = 1; i <= ticks; i++) {
        world.clock.currentTick = i
        world.chunkManager.advanceDormantSimulation(world, i)
    }
}

function offscreenWorld() {
    const world = new World(1600, 1600, { chunkSize: 200, activeChunkRadius: 1, mapSeed: 4242 })
    world.clock.currentTick = 1
    world.tradeRoutes ??= { list: [] }
    return world
}

test('the road keeps being walked after the player stops watching it', () => {
    const world = offscreenWorld()
    const ada = trader(world, 'Ada', 120, 120, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    const bo = trader(world, 'Bo', 370, 120, 'Valley', ['rock', 'rock', 'rock', 'rock'])
    bo.applyIdlePlanner = () => {}
    recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 1)
    recordTrade(world.priceRegistry, 'stick', 'Valley', 7, 1)

    const goal = { type: 'travel_route', priority: 1, description: 'go to market' }
    ada.goals.currentGoal = goal
    ada.goals.beginTradeJourney(goal, {
        kind: 'partner',
        partner: bo,
        type: 'stick',
        gain: 7,
        destination: { x: 370, y: 120, name: 'Valley' }
    })

    // The market stays in view; the merchant's home does not. (A pawn the world
    // has unloaded is nobody's trading partner - `findTradePartner` reads the
    // entity map - so the far end has to be a place the game is still simulating
    // for the arrival to mean anything.)
    world.setActiveChunkWindow(120, 120, 1)
    world.setActiveChunkWindow(370, 120, 0)
    assert.ok(!world.entitiesMap.has(ada.id), 'the merchant is off-screen')

    advanceDormant(world, 900)

    // Asserted on the pawn object rather than on a reload: the chunk an entity
    // is filed under is decided when it goes dormant, and a merchant who has
    // walked a few hundred units since then is a separate piece of bookkeeping.
    assert.notEqual(ada.goals.currentGoal, goal, 'the journey is over')
    assert.ok(Math.hypot(ada.x - 370, ada.y - 120) <= 10, 'and she got there')
    assert.ok(PawnMercantile.countItem(ada, 'rock') > 0, 'and it ended in goods, not in a shrug')
    assert.ok(!ada.tradeTrip, 'the clock stopped with the walk')

    const route = world.tradeRoutes.list.find(r => r.from === 'Hill' || r.to === 'Hill')
    assert.ok(route, 'an unseen walk still makes a road')
    assert.ok(route.averageTravelTime > 200 && route.averageTravelTime <= TRADE_DAY_TICKS,
        `timed like the journey it was, not the last few steps (${route.averageTravelTime})`)
})

test('a journey that runs out of day off-screen is stopped off-screen', () => {
    const world = offscreenWorld()
    const ada = trader(world, 'Ada', 120, 120, 'Hill', ['stick', 'stick', 'stick', 'stick', 'stick'])
    trader(world, 'Bo', 1500, 1500, 'Far Market', ['rock'])
    recordTrade(world.priceRegistry, 'stick', 'Hill', 1, 1)
    recordTrade(world.priceRegistry, 'stick', 'Far Market', 9, 1)

    const goal = { type: 'travel_route', priority: 1, description: 'go to market' }
    ada.goals.currentGoal = goal
    ada.goals.beginTradeJourney(goal, {
        kind: 'market',
        market: 'Far Market',
        type: 'stick',
        gain: 9,
        destination: { x: 1500, y: 1500, name: 'Far Market' }
    })

    world.setActiveChunkWindow(120, 120, 1)
    world.setActiveChunkWindow(1500, 1500, 1)
    assert.ok(!world.entitiesMap.has(ada.id), 'the merchant set out unseen')

    // Further than a trading day of walking, so the dormant sim has to be the
    // one to notice and say so.
    advanceDormant(world, TRADE_DAY_TICKS + 200)

    assert.notEqual(ada.goals.currentGoal, goal, 'the walk was given up while nobody was looking')
    assert.ok(!ada.tradeTrip, 'and the clock was cleared with it')
    assert.ok(Math.hypot(ada.x - 1500, ada.y - 1500) > 10, 'without ever getting there')
})
