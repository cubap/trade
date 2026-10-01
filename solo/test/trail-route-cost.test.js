import test from 'node:test'
import assert from 'node:assert/strict'

// #94: planning pays the ground its due. These cover the three pieces the
// ticket asked for - costing a leg by wear instead of by length, putting
// waypoints on known paths, and choosing destinations by walking cost - plus
// the promise the whole change rests on: with nothing worn underfoot, or with
// a traveller who cannot read the land, every number here is the plain
// Euclidean one it was before #94.

import TrailField, {
    trailFieldFor,
    TRAIL_CELL_SIZE,
    TRAIL_COST_DISCOUNT,
    TRAIL_MAX_INTENSITY,
    TRAIL_FOLLOW_THRESHOLD
} from '../js/core/TrailField.js'

import {
    buildWaypoints,
    createMovementPlan,
    measureRoute,
    replanIfNeeded,
    sortByRouteCost,
    trailPlanningBias,
    TRAIL_PLANNING_SKILL_MASTERY,
    TRAIL_WAYPOINT_SNAP,
    TRAIL_WAYPOINT_SNAP_RATIO
} from '../js/models/entities/mobile/MovementPlan.js'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

/** A worn road along y = 0 from x = 0 to x = length, saturated. */
function road(length = 200, { tick = 0, y = 0, amount = TRAIL_MAX_INTENSITY } = {}) {
    const field = new TrailField({ tick })
    for (let x = 0; x <= length; x += TRAIL_CELL_SIZE) {
        field.deposit(x, y, amount, tick, 'pawn')
    }
    return field
}

function walker({ orienteering = 0, tracking = 0, cartography = 0, planning = 0.5, field = null, x = 0, y = 0 } = {}) {
    return {
        x, y,
        world: field ? { trailField: field } : null,
        getSkill: (name) => ({ orienteering, tracking, cartography, planning })[name] || 0
    }
}

// --- costing a leg ---------------------------------------------------------

test('pathCost: unworn ground costs exactly what it measures', () => {
    const field = road(200)
    // A leg a hundred units off the road never touches it.
    const distance = Math.hypot(300 - 0, 400 - 100)
    assert.equal(field.pathCost(0, 100, 300, 400, { discount: 1 }), distance)
    assert.equal(new TrailField().pathCost(0, 0, 123, 45, { discount: 0.5 }), Math.hypot(123, 45))
})

test('pathCost: a leg that sits on a road is cheaper by up to the discount', () => {
    const field = road(200)
    const distance = 200
    const cost = field.pathCost(0, 0, distance, 0, { discount: TRAIL_COST_DISCOUNT })
    assert.ok(cost < distance, `expected a saving, got ${cost}`)
    // Fully saturated ground under every sample takes the whole discount.
    assert.ok(Math.abs(cost - distance * (1 - TRAIL_COST_DISCOUNT)) < 1e-9)
})

test('pathCost: the discount is a floor, never a negative cost', () => {
    const field = road(200)
    assert.ok(field.pathCost(0, 0, 200, 0, { discount: 0.9 }) > 0)
    // discount 0 switches the estimate off entirely.
    assert.equal(field.pathCost(0, 0, 200, 0, { discount: 0 }), 200)
})

test('pathCost: fresher wear reads stronger than wear that is fading out', () => {
    const field = road(200, { tick: 0 })
    const then = field.pathCost(0, 0, 200, 0, { discount: 0.5, tick: 0 })
    const later = field.pathCost(0, 0, 200, 0, { discount: 0.5, tick: 480 })
    assert.ok(later > then, 'a season of no traffic puts the cost back toward distance')
})

test('routeCost: cost, distance and savings stay consistent', () => {
    const field = road(200)
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]
    const route = field.routeCost(points, { discount: TRAIL_COST_DISCOUNT })
    assert.equal(route.distance, 200)
    assert.equal(route.cost, route.distance - route.savings)
    assert.ok(route.savings > 0)
    // Garbage in the polyline is dropped rather than thrown.
    assert.equal(field.routeCost(null).cost, 0)
    assert.equal(field.routeCost([{ x: 0, y: 0 }, { x: NaN, y: 1 }]).cost, 0)
})

test('wearNear: the strongest worn ground inside the radius, or nothing', () => {
    const field = new TrailField()
    field.deposit(40, 0, 6, 0, 'pawn')
    field.deposit(120, 0, TRAIL_MAX_INTENSITY, 0, 'pawn')

    const faint = field.wearNear(60, 0, { radius: 40 })
    assert.ok(faint, 'the only wear in reach is worth steering for')
    assert.ok(Math.abs(faint.x - 44) < TRAIL_CELL_SIZE, 'answers with a cell centre')
    assert.equal(faint.kind, 'pawn')

    const heavy = field.wearNear(110, 0, { radius: 40 })
    assert.ok(Math.abs(heavy.x - 124) < TRAIL_CELL_SIZE && heavy.intensity > faint.intensity)

    assert.equal(field.wearNear(0, 400, { radius: 20 }), null, 'unworn ground is cheap to ask about')
    assert.equal(field.wearNear(40, 0, { radius: 40, threshold: 20 }), null, 'scrub is not a path')
    assert.equal(field.wearNear(0, 0, { radius: 0 }), null)
})

// --- skill gate ------------------------------------------------------------

test('trailPlanningBias: reading the land is a skill, not a given', () => {
    assert.equal(trailPlanningBias(walker()), 0, 'an untrained traveller plans as before')
    assert.equal(trailPlanningBias(walker({ orienteering: TRAIL_PLANNING_SKILL_MASTERY })), 1)
    assert.equal(trailPlanningBias(walker({ orienteering: TRAIL_PLANNING_SKILL_MASTERY * 4 })), 1, 'capped')
    assert.ok(Math.abs(trailPlanningBias(walker({ tracking: 10 })) - 0.5) < 1e-12)
    // Any of the three trail skills counts; the best one wins.
    assert.ok(trailPlanningBias(walker({ orienteering: 2, cartography: 8 })) > trailPlanningBias(walker({ orienteering: 2 })))
    assert.equal(trailPlanningBias({}), 0, 'no skills, no opinions')
    assert.equal(trailPlanningBias(null), 0)
})

// --- waypoints -------------------------------------------------------------

test('buildWaypoints: still a straight line when there is no ground to read', () => {
    const plain = buildWaypoints(0, 0, 300, 0, 100)
    assert.deepEqual(plain, [{ x: 100, y: 0 }, { x: 200, y: 0 }])
    const field = road(300, { y: -12 })
    // No bias, no snapping - the pre-#94 planner, untouched.
    assert.deepEqual(buildWaypoints(0, 0, 300, 0, 100, { field, bias: 0 }), plain)
    assert.deepEqual(buildWaypoints(0, 0, 300, 0, 100, {}), plain)
})

test('buildWaypoints: a nearby road pulls the legs onto it', () => {
    const field = road(300, { y: -12 })
    const wps = buildWaypoints(0, 0, 300, 0, 100, { field, bias: 1 })
    assert.equal(wps.length, 2)
    for (const wp of wps) {
        assert.equal(wp.onTrail, true)
        assert.ok(wp.y < 0, 'moved toward the worn ground')
        assert.ok(wp.wear >= TRAIL_FOLLOW_THRESHOLD)
        assert.equal(wp.kind, 'pawn')
    }
})

test('buildWaypoints: the snap is bounded, so paths are used and not chased', () => {
    const field = road(300, { y: -12 })
    const leg = 100
    const wps = buildWaypoints(0, 0, 300, 0, leg, { field, bias: 1 })
    const maxSnap = Math.min(TRAIL_WAYPOINT_SNAP, leg * TRAIL_WAYPOINT_SNAP_RATIO)
    wps.forEach((wp, i) => {
        const nominal = { x: (i + 1) * leg, y: 0 }
        assert.ok(Math.hypot(wp.x - nominal.x, wp.y - nominal.y) <= maxSnap + 1e-9, 'detour stays inside the radius')
        assert.ok(wp.x > i * leg, 'and the leg still travels toward the destination')
    })
    // A road nobody can see stays nobody's route.
    assert.equal(buildWaypoints(0, 0, 300, 0, leg, { field, bias: 0.01 }).every(wp => !wp.onTrail), true)
})

test('measureRoute: cost falls back to distance without a field or a bias', () => {
    const wps = buildWaypoints(0, 0, 300, 0, 100)
    const plain = measureRoute(0, 0, wps, 300, 0, {})
    assert.equal(plain.cost, plain.distance)
    assert.equal(plain.distance, 300)
    assert.equal(plain.savings, 0)
    assert.equal(measureRoute(0, 0, null, 10, 0).distance, 10)
})

test('measureRoute: the discount scales with the skill that reads the land', () => {
    const field = road(300)
    const wps = buildWaypoints(0, 0, 300, 0, 100)
    const half = measureRoute(0, 0, wps, 300, 0, { field, bias: 0.5 }).savings
    const full = measureRoute(0, 0, wps, 300, 0, { field, bias: 1 }).savings
    assert.ok(half > 0 && full > half, 'a better traveller budgets a better walk')
})

// --- plans -----------------------------------------------------------------

test('createMovementPlan: a pawn with no world plans exactly as it did before #94', () => {
    const pawn = walker({ planning: 1 })
    const plan = createMovementPlan(pawn, 400, 0, { type: 'explore' }, 100)
    assert.equal(plan.trailBias, 0)
    assert.equal(plan.trailSavings, 0)
    assert.equal(plan.trailLegs, 0)
    // distance 400 at the 1.5 unit/tick estimate
    assert.equal(plan.travelTimeTicks, Math.round(400 / 1.5))
    // planning 1 means 200-unit legs, so one intermediate waypoint on a 400 walk
    assert.deepEqual(plan.waypoints.map(w => w.x), [200])
})

test('createMovementPlan: a trained walker on a road expects a shorter trip', () => {
    const field = road(400)
    const skilled = walker({ planning: 1, orienteering: TRAIL_PLANNING_SKILL_MASTERY, field })
    const naive = walker({ planning: 1, field })
    const a = createMovementPlan(skilled, 400, 0, { type: 'explore' }, 0)
    const b = createMovementPlan(naive, 400, 0, { type: 'explore' }, 0)
    assert.equal(b.trailSavings, 0, 'an untrained walker budgets the whole walk')
    assert.ok(a.travelTimeTicks < b.travelTimeTicks, `${a.travelTimeTicks} should beat ${b.travelTimeTicks}`)
    assert.ok(a.trailSavings > 0)
    assert.equal(a.trailBias, 1)
    assert.ok(a.trailLegs > 0, 'some legs were placed on the road')
})

test('replanIfNeeded: a route keeps using the ground it learned to read', () => {
    const field = road(400, { y: -12 })
    const pawn = walker({ planning: 1, orienteering: TRAIL_PLANNING_SKILL_MASTERY, field })
    const plan = createMovementPlan(pawn, 400, 0, { type: 'explore' }, 0)
    const before = plan.replanAt
    assert.equal(replanIfNeeded(plan, pawn, before - 1), false)
    assert.equal(replanIfNeeded(plan, pawn, before), true)
    assert.equal(plan.trailBias, 1)
    assert.ok(plan.waypoints.some(wp => wp.onTrail), 'replanned legs are still trail legs')
})

// --- destination choice ----------------------------------------------------

test('sortByRouteCost: with nothing worn it is exactly the old distance sort', () => {
    const pawn = walker({ orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    const list = [{ x: 300, y: 0, name: 'far' }, { x: 40, y: 30, name: 'near' }, { x: 120, y: 0, name: 'mid' }]
    const order = list.map(i => i.name)
    assert.deepEqual(sortByRouteCost(pawn, list).map(i => i.name), ['near', 'mid', 'far'])
    assert.deepEqual(list.map(i => i.name), order, 'the caller keeps its own list untouched')
    assert.deepEqual(sortByRouteCost(pawn, []).map(i => i.name), [])
    assert.equal(sortByRouteCost(pawn, [{ x: 5, y: 5 }]).length, 1)
})

test('sortByRouteCost: two equal berries, the one down the path wins', () => {
    const field = road(200)
    const onRoad = { x: 200, y: 0, name: 'on_the_road' }
    const across = { x: 0, y: 200, name: 'across_the_field' }
    const skilled = walker({ orienteering: TRAIL_PLANNING_SKILL_MASTERY, field })
    assert.deepEqual(sortByRouteCost(skilled, [across, onRoad]).map(i => i.name), ['on_the_road', 'across_the_field'])
    // Equidistant, untrained: pure distance, and ties keep the input order.
    const naive = walker({ field })
    assert.deepEqual(sortByRouteCost(naive, [across, onRoad]).map(i => i.name), ['across_the_field', 'on_the_road'])
})

test('sortByRouteCost: reads the pawn world when the caller does not say otherwise', () => {
    const field = road(200)
    const world = { trailField: field }
    const pawn = { x: 0, y: 0, world, getSkill: (s) => (s === 'orienteering' ? TRAIL_PLANNING_SKILL_MASTERY : 0) }
    const list = [{ x: 0, y: 190, name: 'close_but_cross-country' }, { x: 190, y: 0, name: 'same_length_down_the_road' }]
    assert.deepEqual(sortByRouteCost(pawn, list).map(i => i.name), ['same_length_down_the_road', 'close_but_cross-country'])
})

// --- the real game objects -------------------------------------------------

function makePawn(name, { planning = 1, orienteering = 0, x = 1000, y = 1000 } = {}) {
    const world = new World(2000, 2000)
    const pawn = new Pawn(name, name, x, y)
    world.addEntity(pawn)
    pawn.useSkill('planning', planning)
    if (orienteering) pawn.useSkill('orienteering', orienteering)
    return pawn
}

test('a real pawn wears its own road and then plans with it', () => {
    const pawn = makePawn('p-road-builder', { orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    const field = trailFieldFor(pawn.world)
    assert.ok(field, 'the world carries one shared ground')
    // Somebody walked north. Repeatedly, which is the only way a path happens.
    for (let y = pawn.y; y <= pawn.y + 400; y += TRAIL_CELL_SIZE) {
        field.deposit(pawn.x, y, TRAIL_MAX_INTENSITY, 0, 'pawn')
    }
    const naive = makePawn('p-visitor', {})
    naive.x = pawn.x
    naive.y = pawn.y
    naive.world = pawn.world

    const local = createMovementPlan(pawn, pawn.x, pawn.y + 400, { type: 'explore' }, 0)
    const stranger = createMovementPlan(naive, pawn.x, pawn.y + 400, { type: 'explore' }, 0)
    assert.equal(stranger.trailSavings, 0, 'a pawn with no trail skill gets no benefit from it')
    assert.ok(local.trailSavings > 0)
    assert.ok(local.travelTimeTicks < stranger.travelTimeTicks)
})

test('a world nobody has walked still has no trails to plan around', () => {
    const pawn = makePawn('p-first-farmer', { orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    assert.equal(trailFieldFor(pawn.world, { create: false }), null)
    const plan = createMovementPlan(pawn, 1200, 1400, { type: 'explore' }, 0)
    assert.equal(plan.trailBias, 0)
    assert.equal(plan.trailSavings, 0)
    assert.ok(Number.isFinite(plan.travelTimeTicks) && plan.travelTimeTicks > 0)
})
