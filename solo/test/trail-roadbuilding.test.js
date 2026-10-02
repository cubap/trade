import test from 'node:test'
import assert from 'node:assert/strict'

// #95 (2/2): roads stop being a primitive and become something the sim does on
// its own. Two events make a road here: a settlement being recognized, which
// paves the paths its people already walk, and a barter completed, which
// maintains the corridor the merchant just travelled and puts it in the route
// table with real geometry and a measured travel time. The promise running
// through all of it is that nothing gets paved on virgin ground unless the
// walker is a surveyor - a road is recognition of traffic, not a decoration.

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import {
    canonizeEncampment,
    openSettlementRoads
} from '../js/models/entities/mobile/PawnCivic.js'
import {
    trailFieldFor,
    TRAIL_CELL_SIZE,
    TRAIL_ROAD_MIN_COVERAGE,
    TRAIL_ROAD_WEAR,
    TRAIL_MAX_INTENSITY
} from '../js/core/TrailField.js'
import { canSurveyRoutes, TRAIL_SURVEY_SKILL } from '../js/models/entities/mobile/MovementPlan.js'
import { createRoute, findRoute, recordTrip } from '../js/core/TradeRoutes.js'

function makeWorld(tick = 0) {
    const world = new World(2000, 2000)
    world.clock.currentTick = tick
    const field = trailFieldFor(world)
    return { world, field }
}

/** A pawn with a home fire it remembers, which is what names a route. */
function makeWalker(world, name, x, y, skills = {}) {
    const pawn = new Pawn(name, name, x, y)
    world.addEntity(pawn)
    pawn.rememberLandmark({ x, y, type: 'shelter', significance: 5, name })
    for (const [skill, level] of Object.entries(skills)) {
        pawn.skills[skill] = Math.max(pawn.skills[skill] ?? 0, level)
    }
    return pawn
}

/** Traffic: wear the ground along the straight line from A to B. */
function wear(field, ax, ay, bx, by, { tick = 0, amount = TRAIL_MAX_INTENSITY * 0.5 } = {}) {
    const length = Math.hypot(bx - ax, by - ay)
    const steps = Math.max(1, Math.ceil(length / (TRAIL_CELL_SIZE * 0.5)))
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        field.deposit(ax + (bx - ax) * t, ay + (by - ay) * t, amount, tick, 'pawn')
    }
    return field
}

const kindOf = (field, kind) =>
    field.kindsInUse().find(k => k.kind === kind)?.intensity ?? 0

// ---------------------------------------------------------------- recognising

test('a pawn cannot pave ground nobody has walked', () => {
    const { world, field } = makeWorld()
    const pawn = makeWalker(world, 'Ada', 0, 0)

    const road = pawn.openRoadTo(300, 0)
    assert.equal(road.ok, false)
    assert.equal(road.reason, 'unworn')
    assert.equal(field.cells.size, 0, 'refusing wrote nothing')
})

test('a pawn recognises the road its own traffic wore', () => {
    const { world, field } = makeWorld()
    const pawn = makeWalker(world, 'Ada', 0, 0)
    wear(field, 0, 0, 200, 0)

    const road = pawn.openRoadTo(200, 0)
    assert.equal(road.ok, true)
    assert.equal(road.reason, 'worn')
    assert.ok(road.coverage >= TRAIL_ROAD_MIN_COVERAGE)

    assert.ok(kindOf(field, 'road') > 0, 'the road is its own kind of wear')
    assert.ok(kindOf(field, 'pawn') > 0, 'the footfall that made it is still readable')
})

test('opening a road pays the wayfinding it takes', () => {
    const { world, field } = makeWorld()
    const pawn = makeWalker(world, 'Ada', 0, 0)
    wear(field, 0, 0, 200, 0)
    const before = pawn.getSkill('orienteering')

    pawn.openRoadTo(200, 0)
    assert.ok(pawn.getSkill('orienteering') > before, 'recognising a road teaches something')
    assert.equal(pawn.roadsOpened, 1)
})

test('a road is written where it was worn, not under the walker', () => {
    const { world, field } = makeWorld()
    const pawn = makeWalker(world, 'Ada', 0, 400)
    wear(field, 0, 0, 200, 0)

    // The merchant arrives from somewhere else; the corridor its walking wore
    // is the one to pave, even though it is standing well off it now.
    const road = pawn.openRoadTo(200, 0, { fromX: 0, fromY: 0 })
    assert.equal(road.ok, true)
    assert.ok(field.intensityAt(100, 0) >= TRAIL_ROAD_WEAR)
})

// ------------------------------------------------------------------- surveying

test('surveying virgin ground is the craft, not the walk', () => {
    const { world, field } = makeWorld()
    const untrained = makeWalker(world, 'Ada', 0, 0)
    assert.equal(canSurveyRoutes(untrained), false)
    assert.equal(untrained.openRoadTo(300, 0, { surveyed: true }).ok, false)
    assert.equal(field.cells.size, 0, 'asking for a survey changed nothing')

    const surveyor = makeWalker(world, 'Bo', 0, 300, { cartography: TRAIL_SURVEY_SKILL })
    assert.equal(canSurveyRoutes(surveyor), true)
    const before = surveyor.getSkill('cartography')
    const line = surveyor.openRoadTo(300, 300, { surveyed: true })

    assert.equal(line.ok, true)
    assert.equal(line.reason, 'surveyed')
    assert.ok(line.coverage < TRAIL_ROAD_MIN_COVERAGE, 'it paved ground nobody walked')
    assert.ok(line.points.every(p => p.y === 300), 'and laid it straight')
    assert.ok(surveyor.getSkill('cartography') > before, 'surveying pays cartography')
    assert.ok(surveyor.roadsOpened === 1 && untrained.roadsOpened === undefined)
})

test('the bypass is earned, so tracking and orienteering do not buy it', () => {
    const { world } = makeWorld()
    const tracker = makeWalker(world, 'Ada', 0, 0, { tracking: 40, orienteering: 40 })
    assert.equal(canSurveyRoutes(tracker), false)
    assert.equal(tracker.openRoadTo(300, 0, { surveyed: true }).ok, false)
})

test('a world with no ground beneath it paves nothing and allocates nothing', () => {
    const world = new World(2000, 2000)
    world.clock.currentTick = 0
    const pawn = new Pawn('Ada', 'Ada', 0, 0)
    world.addEntity(pawn)

    const road = pawn.openRoadTo(200, 0)
    assert.equal(road.ok, false)
    assert.equal(road.reason, 'no ground')
    assert.equal(trailFieldFor(world, { create: false }), null)
})

// ----------------------------------------------------------------- trade trips

test('beginTradeTrip times the journey, once', () => {
    const { world } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    const bo = makeWalker(world, 'Bo', 200, 0)
    const cy = makeWalker(world, 'Cy', 400, 0)

    ada.beginTradeTrip(bo)
    const start = ada.tradeTrip
    ada.beginTradeTrip(cy)
    assert.equal(ada.tradeTrip, start, 'the departure is not re-timed mid-journey')
    assert.equal(start.partner, bo.id)
    assert.equal(start.fromX, 0)

    ada.tradeTrip = null
    ada.beginTradeTrip(null)
    assert.ok(!ada.tradeTrip, 'no partner, no trip')
})

test('a completed barter leaves a route with geometry', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    const bo = makeWalker(world, 'Bo', 240, 0)
    wear(field, 0, 0, 240, 0)

    ada.beginTradeTrip(bo)
    world.clock.currentTick = 30
    ada.x = 240
    const { road, route } = ada.noteTradeRoute(bo)

    assert.equal(road.ok, true, 'the way the merchant walked is now a road')
    assert.ok(route, 'and the world knows the route')
    assert.deepEqual([route.from, route.to], ['Ada', 'Bo'], 'named after both homes')
    assert.equal(route.trips, 1)
    assert.equal(route.averageTravelTime, 30, 'a measured time, not a guess')
    assert.ok(Array.isArray(route.geometry) && route.geometry.length > 1)
    assert.equal(route.distance, 240)
    assert.ok(route.coverage >= TRAIL_ROAD_MIN_COVERAGE)
    assert.equal(route.fromPoint.x, 0, 'the journey it timed, not the doorstep it ended on')
    assert.equal(world.tradeRoutes.list.length, 1)
})

test('the return trip maintains the same entry', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    const bo = makeWalker(world, 'Bo', 240, 0)
    wear(field, 0, 0, 240, 0)

    ada.beginTradeTrip(bo)
    world.clock.currentTick = 30
    ada.noteTradeRoute(bo)

    bo.beginTradeTrip(ada)
    world.clock.currentTick = 70
    const { route } = bo.noteTradeRoute(ada)

    assert.equal(world.tradeRoutes.list.length, 1, 'a road runs both ways')
    assert.equal(route.trips, 2)
    assert.equal(route.averageTravelTime, 35, 'averaged over both journeys')
})

test('traffic keeps a road that an abandoned corridor cannot hold', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    const bo = makeWalker(world, 'Bo', 240, 0)
    wear(field, 0, 0, 240, 0)

    ada.beginTradeTrip(bo)
    world.clock.currentTick = 30
    ada.noteTradeRoute(bo)
    const fresh = field.intensityAt(120, 0, 30)

    // Five half-lives with nobody on it. A road is not an improvement to the
    // map, it is a habit, so it goes the way a habit does.
    world.clock.currentTick = 3000
    const faded = field.intensityAt(120, 0, 3000)
    assert.ok(faded < fresh / 8, 'the road fades toward ordinary ground')

    bo.beginTradeTrip(ada)
    bo.noteTradeRoute(ada)
    assert.ok(field.intensityAt(120, 0, 3000) > faded, 'using it puts the wear back')
})

test('a journey to somebody else is not this route', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    const bo = makeWalker(world, 'Bo', 240, 0)
    const cy = makeWalker(world, 'Cy', 240, 240)
    wear(field, 0, 0, 240, 0)

    ada.beginTradeTrip(cy)
    world.clock.currentTick = 20
    const { road, route } = ada.noteTradeRoute(bo)
    assert.equal(route, null, 'the timing belongs to another journey')
    assert.equal(road.ok, true, 'the road it wore on the way is still a road')
    assert.equal(ada.tradeTrip, null, 'and the stale trip is cleared')
})

test('a journey that took absurdly long says nothing about travel time', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    const bo = makeWalker(world, 'Bo', 240, 0)

    ada.beginTradeTrip(bo)
    world.clock.currentTick = 100000
    // Worn now, so it is the walk that was long, not the ground that has gone.
    wear(field, 0, 0, 240, 0, { tick: 100000 })
    const { route } = ada.noteTradeRoute(bo)

    assert.equal(route.averageTravelTime, 0, 'the average is left alone')
    assert.ok(route.geometry, 'but the road and its shape are still recorded')
})

test('merchants with no settled homes still wear roads out', () => {
    const { world, field } = makeWorld()
    const ada = new Pawn('Ada', 'Ada', 0, 0)
    const bo = new Pawn('Bo', 'Bo', 240, 0)
    world.addEntity(ada)
    world.addEntity(bo)
    wear(field, 0, 0, 240, 0)

    ada.beginTradeTrip(bo)
    world.clock.currentTick = 12
    const { road, route } = ada.noteTradeRoute(bo)
    assert.equal(road.ok, true)
    assert.equal(route, null, 'a route needs two places to be between')
})

// ----------------------------------------------------------------------- civic

function settlement(pawn, { name = 'Our Hollow', members = [] } = {}) {
    pawn.encampmentLandmark = {
        x: pawn.x,
        y: pawn.y,
        name,
        type: 'encampment',
        significance: 5,
        canonized: false,
        groupMembers: members.map(m => m.id)
    }
    return pawn.encampmentLandmark
}

test('canonizing a settlement opens the roads its people walk', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 100, 100)
    const bo = makeWalker(world, 'Bo', 400, 0)
    const landmark = settlement(ada, { members: [ada, bo] })
    world.clock.currentTick = 5
    wear(field, 400, 0, 100, 100)

    const roads = canonizeEncampment(ada, { id: 'cache1' })
    assert.equal(roads, 1, 'Bo walked here; Ada never left home')
    assert.equal(landmark.canonized, true)
    assert.equal(ada.isSettlementDiscoverable, true)
    assert.ok(field.intensityAt(250, 50) >= TRAIL_ROAD_WEAR, 'the path is a road now')
    assert.deepEqual(ada.civicLedger.map(c => [c.type, c.amount]), [['build', 1]])
    assert.equal(bo.roadsOpened, 1)
})

test('a settlement nobody has walked out of gets no roads, and is still a settlement', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    const bo = makeWalker(world, 'Bo', 300, 300)
    const landmark = settlement(ada, { members: [ada, bo] })

    const roads = canonizeEncampment(ada, { id: 'cache1' })
    assert.equal(roads, 0)
    assert.equal(landmark.canonized, true)
    assert.equal(kindOf(field, 'road'), 0, 'no road was invented for it')
})

test('a surveyor canonizing a settlement lays roads rather than naming them', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 100, 100)
    const bo = makeWalker(world, 'Bo', 500, 100, { cartography: TRAIL_SURVEY_SKILL })
    settlement(ada, { members: [ada, bo] })
    world.clock.currentTick = 5

    // Bo has never worn this corridor at all; it reads the land instead.
    const roads = canonizeEncampment(ada, { id: 'cache1' })
    assert.equal(roads, 1)
    assert.ok(field.intensityAt(300, 100) >= TRAIL_ROAD_WEAR)
    assert.equal(kindOf(field, 'pawn'), 0, 'nobody walked here')
})

test('the pawn standing on the settlement does not count as having built a road', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 100, 100, { cartography: TRAIL_SURVEY_SKILL })
    settlement(ada)

    // A road of length zero is not a road, however good the surveyor.
    assert.equal(openSettlementRoads(ada), 0)
    assert.equal(field.cells.size, 0)
})

test('unknown group members are skipped rather than thrown at', () => {
    const { world, field } = makeWorld()
    const ada = makeWalker(world, 'Ada', 100, 0)
    ada.encampmentLandmark = {
        x: 0, y: 0, name: 'Our Hollow', groupMembers: ['nobody-here'], canonized: false
    }
    wear(field, 0, 0, 100, 0)

    assert.equal(openSettlementRoads(ada), 1)
})

test('opening roads does not need a settlement at all', () => {
    const { world } = makeWorld()
    const ada = makeWalker(world, 'Ada', 0, 0)
    assert.equal(openSettlementRoads(ada), 0, 'no encampment landmark, nothing to open')
    assert.equal(openSettlementRoads(null), 0)
})

// ------------------------------------------------------------ old shape intact

test('routes created from names alone look exactly as they did', () => {
    const routes = {}
    const route = createRoute(routes, 'Ada', 'Bo', 7)
    assert.equal(route.trips, 1)
    assert.equal(route.lastTrip, 7)
    assert.equal(route.totalValue, 0)
    assert.equal(route.averageTravelTime, 0)
    assert.equal(route.safetyScore, 1.0)
    assert.equal(route.geometry, null)
    assert.equal(route.fromPoint, null)
    assert.equal(route.distance, null)
    assert.equal(route.coverage, null)
    assert.ok(route.routeId.startsWith('route_Ada_Bo_'))
})

test('recordTrip still averages, and now finds either direction', () => {
    const routes = {}
    createRoute(routes, 'Ada', 'Bo', 0)
    recordTrip(routes, 'Ada', 'Bo', 12, 40, 40)
    const back = recordTrip(routes, 'Bo', 'Ada', 3, 20, 60)

    assert.equal(routes.list.length, 1)
    assert.equal(back.trips, 3)
    assert.equal(back.totalValue, 15)
    assert.equal(back.averageTravelTime, 20)
    assert.equal(findRoute(routes, 'Ada', 'Bo'), back)
    assert.equal(findRoute(routes, 'Ada', 'Cy'), null)
})

test('an untimed trip does not poison the average', () => {
    const routes = {}
    createRoute(routes, 'Ada', 'Bo', 0, { travelTime: 50 })
    recordTrip(routes, 'Ada', 'Bo', 0, null, 10)
    const route = recordTrip(routes, 'Ada', 'Bo', 0, undefined, 20)
    assert.equal(route.trips, 3)
    assert.equal(route.averageTravelTime, 50)
})
