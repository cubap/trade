import test from 'node:test'
import assert from 'node:assert/strict'

// #105: a route a pawn has walked is supposed to change what it does next.
// Before this, `plan.trailSavings` was measured, copied into the HUD, and read
// by no decision - `sortByRouteCost()` re-sampled the field for every
// candidate and threw the stored figure away. These cover the memory itself,
// the discount it buys, and the promise that a pawn with nothing remembered
// sorts exactly the way it sorted before #105.

import TrailField, {
    trailFieldFor,
    TRAIL_CELL_SIZE,
    TRAIL_MAX_INTENSITY,
    TRAIL_COST_DISCOUNT
} from '../js/core/TrailField.js'

import {
    createMovementPlan,
    recordRouteRecall,
    rememberRouteSavings,
    routeRecall,
    routeCostTo,
    sortByRouteCost,
    TRAIL_PLANNING_SKILL_MASTERY,
    ROUTE_MEMORY_MAX,
    ROUTE_MEMORY_TOLERANCE,
    ROUTE_MEMORY_TTL,
    ROUTE_MEMORY_MIN_SAVINGS,
    ROUTE_MEMORY_MAX_DISCOUNT
} from '../js/models/entities/mobile/MovementPlan.js'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

/** A worn road along y = 0 from x = 0 to x = length, saturated. */
function road(length = 400, { tick = 0, y = 0, amount = TRAIL_MAX_INTENSITY } = {}) {
    const field = new TrailField({ tick })
    for (let x = 0; x <= length; x += TRAIL_CELL_SIZE) {
        field.deposit(x, y, amount, tick, 'pawn')
    }
    return field
}

function walker({ orienteering = 0, planning = 0.5, field = null, x = 0, y = 0, consistency = null } = {}) {
    const pawn = {
        x, y,
        speed: 0.7,
        // A real Pawn declares this empty (Pawn.js); a stub should not pretend
        // the field is absent.
        routeMemory: [],
        world: field ? { trailField: field } : null,
        getSkill: (name) => ({ orienteering, planning })[name] || 0
    }
    if (consistency !== null) pawn.progressionMetrics = { routeRecallConsistency: consistency }
    return pawn
}

// --- the memory itself -----------------------------------------------------

test('rememberRouteSavings: only a saving worth walking for gets filed', () => {
    const pawn = walker()
    assert.equal(rememberRouteSavings(pawn, 100, 0, 0), null, 'nothing saved is nothing learned')
    assert.equal(rememberRouteSavings(pawn, 100, 0, ROUTE_MEMORY_MIN_SAVINGS - 0.01), null, 'noise is not a reason to return')
    assert.equal(rememberRouteSavings(pawn, 100, 0, NaN), null)
    assert.equal(rememberRouteSavings(pawn, 'nowhere', 0, 12), null)
    assert.equal(pawn.routeMemory.length, 0, 'a rejected figure leaves no trace')

    const entry = rememberRouteSavings(pawn, 100, 0, 12, { tick: 5, legs: 3 })
    assert.equal(entry.savings, 12)
    assert.equal(entry.trips, 1)
    assert.equal(entry.legs, 3)
    assert.deepEqual({ x: entry.x, y: entry.y, tick: entry.tick }, { x: 100, y: 0, tick: 5 })
})

test('rememberRouteSavings: the same destination is one memory, averaged', () => {
    const pawn = walker()
    rememberRouteSavings(pawn, 200, 0, 20, { tick: 0 })
    const second = rememberRouteSavings(pawn, 200 + ROUTE_MEMORY_TOLERANCE / 2, 4, 4, { tick: 10, legs: 2 })

    assert.equal(pawn.routeMemory.length, 1, 'a nearby revisit is the same road, not a new one')
    assert.equal(second.trips, 2)
    assert.equal(second.savings, 12, 'cheap once and dear twice is not worth steering for')
    assert.equal(second.tick, 10, 'the memory is as fresh as the last walk')
    assert.equal(second.legs, 2)

    // Outside the tolerance it genuinely is somewhere else.
    rememberRouteSavings(pawn, 200 + ROUTE_MEMORY_TOLERANCE * 4, 0, 9, { tick: 11 })
    assert.equal(pawn.routeMemory.length, 2)
})

test('rememberRouteSavings: a pawn only remembers so many places', () => {
    const pawn = walker()
    const lastX = (ROUTE_MEMORY_MAX + 6) * 500
    for (let i = 0; i < ROUTE_MEMORY_MAX + 6; i++) {
        rememberRouteSavings(pawn, (i + 1) * 500, 0, 5, { tick: i })
    }
    assert.equal(pawn.routeMemory.length, ROUTE_MEMORY_MAX)
    assert.equal(pawn.routeMemory.some(e => e.x === 500), false, 'the stalest single-visit memory goes first')

    // A place it has been twice earns its keep against a brand new one.
    const twice = rememberRouteSavings(pawn, lastX, 0, 5, { tick: 900 })
    assert.equal(twice.trips, 2)
    rememberRouteSavings(pawn, 987654, 0, 5, { tick: 901 })
    assert.equal(pawn.routeMemory.length, ROUTE_MEMORY_MAX)
    assert.ok(pawn.routeMemory.some(e => e.x === lastX), 'a twice-walked road outlives a fresh one')
})

test('routeRecall: remembering is credited by how well the pawn reads country', () => {
    const pawn = walker()
    rememberRouteSavings(pawn, 300, 0, 20, { tick: 0 })

    assert.equal(routeRecall(pawn, 100, 100, { tick: 0 }), null, 'never walked, nothing to say')
    assert.equal(routeRecall(walker(), 300, 0, { tick: 0 }), null, 'a pawn with no memory at all')

    // No record of calling its routes: it has been there, which counts, but
    // only half as much as it would for a pawn whose estimates hold up.
    const unproven = routeRecall(pawn, 300, 0, { tick: 0 })
    assert.equal(unproven.credit, 0.5)
    assert.equal(unproven.savings, 10)

    pawn.progressionMetrics = { routeRecallConsistency: 1 }
    assert.equal(routeRecall(pawn, 300, 0, { tick: 0 }).savings, 20, 'a reliable reader gets full weight')

    pawn.progressionMetrics = { routeRecallConsistency: 0 }
    assert.equal(routeRecall(pawn, 300, 0, { tick: ROUTE_MEMORY_TTL / 2 }).savings, 5, 'and the memory fades either way')
    assert.equal(routeRecall(pawn, 300, 0, { tick: ROUTE_MEMORY_TTL }), null, 'gone is gone')
})

test('routeRecall: junk coordinates and empty memories are not errors', () => {
    assert.equal(routeRecall(null, 0, 0), null)
    assert.equal(routeRecall(walker(), NaN, 4), null)
    const pawn = walker()
    pawn.routeMemory = [{ x: 10, y: 10, savings: 40, trips: 1, tick: 0 }]
    assert.equal(routeRecall(pawn, 10 + ROUTE_MEMORY_TOLERANCE * 2, 10, { tick: 0 }), null)
    assert.equal(routeRecall(pawn, 12, 11, { tick: 0 }).entry.savings, 40)
})

// --- the decision it feeds -------------------------------------------------

test('sortByRouteCost: a pawn that remembers nothing orders exactly as before', () => {
    const pawn = walker({ orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    const list = [{ x: 300, y: 0, name: 'far' }, { x: 40, y: 30, name: 'near' }, { x: 120, y: 0, name: 'mid' }]
    assert.deepEqual(
        sortByRouteCost(pawn, list).map(i => i.name),
        sortByRouteCost(pawn, list, { memory: false }).map(i => i.name),
        'no memory, no difference'
    )
    assert.deepEqual(sortByRouteCost(pawn, list).map(i => i.name), ['near', 'mid', 'far'])
})

test('sortByRouteCost: the route it walked is the route it picks', () => {
    // Both destinations are 200 units of plain walking, and the ground has
    // forgotten either way - the field is empty, so the live reading is a tie.
    const pawn = walker({ orienteering: TRAIL_PLANNING_SKILL_MASTERY, field: new TrailField() })
    const remembered = { x: 0, y: 200, name: 'been_there' }
    const stranger = { x: 200, y: 0, name: 'never_walked' }
    assert.deepEqual(
        sortByRouteCost(pawn, [remembered, stranger], { memory: false }).map(i => i.name),
        ['been_there', 'never_walked'],
        'equidistant and unworn: the input order stands'
    )

    rememberRouteSavings(pawn, remembered.x, remembered.y, 60, { tick: 0 })
    assert.equal(routeCostTo(pawn, 0, 0, remembered.x, remembered.y, { tick: 0 }), 200, 'the field itself says nothing now')
    assert.deepEqual(
        sortByRouteCost(pawn, [stranger, remembered]).map(i => i.name),
        ['been_there', 'never_walked'],
        'having been there is the only reason left'
    )
})

test('sortByRouteCost: memory is a tie-breaker, not a teleport', () => {
    const pawn = walker({ consistency: 1 })
    // A 1000-unit walk it remembers as enormously cheap...
    rememberRouteSavings(pawn, 1000, 0, 900, { tick: 0 })
    const cheap = { x: 400, y: 0, name: 'nearer' }
    const dear = { x: 600, y: 0, name: 'further_but_still_closer' }
    const remembered = { x: 1000, y: 0, name: 'remembered_but_far' }
    // ...may cost at most half of what it costs. Past that line distance wins.
    assert.deepEqual(
        sortByRouteCost(pawn, [remembered, cheap]).map(i => i.name),
        ['nearer', 'remembered_but_far']
    )
    assert.deepEqual(
        sortByRouteCost(pawn, [remembered, dear]).map(i => i.name),
        ['remembered_but_far', 'further_but_still_closer']
    )
    assert.equal(1000 * (1 - ROUTE_MEMORY_MAX_DISCOUNT), 500, 'the cap is the whole of that boundary')
})

// --- the producers ---------------------------------------------------------

test('recordRouteRecall files the plan savings where a decision can read them', () => {
    const field = road(400)
    const pawn = walker({ orienteering: TRAIL_PLANNING_SKILL_MASTERY, field })
    const plan = createMovementPlan(pawn, 400, 0, { type: 'explore' }, 0)
    assert.ok(plan.trailSavings > 0, 'the walk was on a road')
    assert.equal(pawn.routeMemory.length, 0, 'nothing is remembered until the walk is over')

    recordRouteRecall(pawn, plan, 300)
    const memory = pawn.routeMemory
    assert.equal(memory.length, 1)
    assert.deepEqual({ x: memory[0].x, y: memory[0].y }, plan.destination)
    assert.equal(memory[0].savings, plan.trailSavings, 'delete trailSavings from the plan and this test fails')
    assert.equal(memory[0].legs, plan.trailLegs)
    assert.equal(memory[0].tick, 300)

    // And the remembered number is what the sort now spends.
    assert.ok(routeRecall(pawn, 400, 0, { tick: 300 }).savings > 0)
})

test('an untrained walker has no saving to remember, on a road or off it', () => {
    const field = road(400)
    const pawn = walker({ field })
    const plan = createMovementPlan(pawn, 400, 0, { type: 'explore' }, 0)
    assert.equal(plan.trailSavings, 0)
    recordRouteRecall(pawn, plan, 300)
    assert.equal((pawn.routeMemory || []).length, 0, 'it cannot remember a discount it was never able to read')
})

// --- a real pawn's errands -------------------------------------------------

function makePawn(name, { orienteering = 0, x = 1000, y = 1000 } = {}) {
    const world = new World(2000, 2000)
    const pawn = new Pawn(name, name, x, y)
    world.addEntity(pawn)
    pawn.useSkill('planning', 1)
    if (orienteering) pawn.useSkill('orienteering', orienteering)
    return pawn
}

/** A saturated path running east out of the pawn's feet. */
function roadFrom(pawn, length = 400) {
    const field = trailFieldFor(pawn.world)
    for (let x = pawn.x; x <= pawn.x + length; x += TRAIL_CELL_SIZE) {
        field.deposit(x, pawn.y, TRAIL_MAX_INTENSITY, 0, 'pawn')
    }
    return field
}

test('a completed errand across a road is remembered, and starts from where the pawn set out', () => {
    const pawn = makePawn('p-carrier', { orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    roadFrom(pawn)

    const goal = { type: 'gather_materials', description: 'gather rock', priority: 2 }
    pawn.goals.startGoal(goal)
    assert.deepEqual({ x: goal.tripStart.x, y: goal.tripStart.y }, { x: pawn.x, y: pawn.y })

    pawn.x = pawn.x + 120
    pawn.goals.startGoal(goal)
    assert.equal(goal.tripStart.x, 1000, 'a resumed goal does not move its own departure point')

    goal.target = { x: pawn.x + 280, y: pawn.y }
    pawn.goals.rememberGoalCorridor(goal)
    assert.equal(pawn.routeMemory.length, 1, 'the corridor it just walked is on record')
    assert.ok(pawn.routeMemory[0].savings > 0, 'the road paid for itself')
    assert.equal(goal.tripRecorded, true)

    const saving = pawn.routeMemory[0].savings
    pawn.goals.rememberGoalCorridor(goal)
    assert.equal(pawn.routeMemory[0].savings, saving, 'one walk, one filing')
})

test('an errand that never left camp teaches the pawn nothing', () => {
    const pawn = makePawn('p-nearby', { orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    roadFrom(pawn)
    const goal = { type: 'gather_materials', description: 'gather stick', priority: 2 }
    pawn.goals.startGoal(goal)
    goal.target = { x: pawn.x + 12, y: pawn.y + 4 }
    pawn.goals.rememberGoalCorridor(goal)
    assert.equal(pawn.routeMemory.length, 0, 'a stroll is not a route')

    goal.target = null
    goal.tripStart = { x: pawn.x, y: pawn.y }
    pawn.goals.rememberGoalCorridor(goal)
    assert.equal(pawn.routeMemory.length, 0, 'no target, no corridor')
})

test('a naive pawn walks the same road and learns exactly as much: nothing', () => {
    const pawn = makePawn('p-blunt', {})
    roadFrom(pawn)
    const goal = { type: 'gather_materials', description: 'gather rock', priority: 2 }
    pawn.goals.startGoal(goal)
    goal.target = { x: pawn.x + 400, y: pawn.y }
    pawn.goals.rememberGoalCorridor(goal)
    assert.ok(!pawn.routeMemory || pawn.routeMemory.length === 0, 'a discount it could not feel is not remembered')
})

test('two errands to the same patch make one remembered road, not two', () => {
    const pawn = makePawn('p-repeat', { orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    roadFrom(pawn)
    const patch = { x: pawn.x + 300, y: pawn.y }

    const first = { type: 'gather_materials', description: 'gather rock', priority: 2 }
    pawn.goals.startGoal(first)
    first.target = patch
    pawn.goals.rememberGoalCorridor(first)
    const firstSaving = pawn.routeMemory[0].savings

    pawn.x = pawn.x + 40
    const second = { type: 'gather_materials', description: 'gather rock', priority: 2 }
    pawn.goals.startGoal(second)
    const nearPatch = { x: patch.x + 3, y: patch.y + 2 }
    second.target = nearPatch
    pawn.goals.rememberGoalCorridor(second)

    const straight = Math.hypot(nearPatch.x - second.tripStart.x, nearPatch.y - second.tripStart.y)
    const cost = routeCostTo(pawn, second.tripStart.x, second.tripStart.y, nearPatch.x, nearPatch.y, { tick: pawn.goals.currentTick() })
    assert.equal(pawn.routeMemory.length, 1)
    assert.equal(pawn.routeMemory[0].trips, 2)
    assert.equal(
        pawn.routeMemory[0].savings,
        (firstSaving + (straight - cost)) / 2,
        'the shorter second trip is averaged in, not stacked on top'
    )
})
