import test from 'node:test'
import assert from 'node:assert/strict'

// #98: worn ground changes the walk, not only the plan.
//
// Two promises are checked here.
//
//   1. The body. A traveller who reads paths gets a longer step out of trodden
//      ground, by exactly the fraction the planner already charged for the leg.
//      An untrained traveller is bit-for-bit unaffected.
//   2. The estimate. `travelTimeTicks` used to be computed and read by nobody.
//      It is now quoted at the walker's own pace and scored against the walk it
//      predicted, so a plan that lies shows up in the pawn's record.

import TrailField, {
    trailFieldFor,
    TRAIL_CELL_SIZE,
    TRAIL_COST_DISCOUNT,
    TRAIL_MAX_INTENSITY,
    TRAIL_FOLLOW_THRESHOLD
} from '../js/core/TrailField.js'

import MobileEntity from '../js/models/entities/mobile/MobileEntity.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import {
    createMovementPlan,
    recordRouteRecall,
    routeRecallScore,
    trailPlanningBias,
    TRAIL_PLANNING_SKILL_MASTERY
} from '../js/models/entities/mobile/MovementPlan.js'

/** A saturated road along y = 0 from x = 0 to x = length. */
function road(length = 400, { tick = 0, y = 0, amount = TRAIL_MAX_INTENSITY } = {}) {
    const field = new TrailField({ tick })
    for (let x = 0; x <= length; x += TRAIL_CELL_SIZE) {
        field.deposit(x, y, amount, tick, 'pawn')
    }
    return field
}

/** Flat world with no chunk manager: terrain factor is exactly 1. */
function flatWorld(field = null) {
    return { width: 2000, height: 2000, tick: 0, trailField: field }
}

function walker({ affinity = 0, field = null, x = 0, y = 0, speed = 2 } = {}) {
    const w = new MobileEntity('w', 'w', x, y)
    w.speed = speed
    w.trailAffinity = affinity
    w.world = flatWorld(field)
    return w
}

function makePawn({ orienteering = 0, planning = 1, x = 100, y = 0, field = null } = {}) {
    const pawn = new Pawn('p', 'p', x, y)
    pawn.world = flatWorld(field)
    pawn.useSkill('planning', planning)
    if (orienteering) pawn.useSkill('orienteering', orienteering)
    return pawn
}

// --- the field's say -------------------------------------------------------

test('stepCost: untrodden ground gives back nothing', () => {
    const fresh = new TrailField({ tick: 0 })
    assert.equal(fresh.stepCost(0, 0, { discount: TRAIL_COST_DISCOUNT }), 1)
    assert.equal(road(100).stepCost(0, 100, { discount: TRAIL_COST_DISCOUNT }), 1, 'off the road')
})

test('stepCost: trodden ground is cheaper by exactly the discount it can carry', () => {
    const field = road(100)
    const on = field.stepCost(0, 0, { tick: 0, discount: TRAIL_COST_DISCOUNT })
    assert.ok(Math.abs(on - (1 - TRAIL_COST_DISCOUNT)) < 1e-9, `saturated ground should give the whole discount, got ${on}`)
    // Half-worn ground gives half of it, so relief scales with the wear a
    // player can see.
    const half = new TrailField({ tick: 0 })
    half.deposit(40, 0, TRAIL_MAX_INTENSITY / 2, 0, 'pawn')
    const mid = half.stepCost(40, 0, { tick: 0, discount: TRAIL_COST_DISCOUNT })
    assert.ok(Math.abs(mid - (1 - TRAIL_COST_DISCOUNT / 2)) < 1e-9, `got ${mid}`)
})

test('stepCost: below the follow threshold there is no path to stand on', () => {
    const field = new TrailField({ tick: 0 })
    field.deposit(10, 10, TRAIL_FOLLOW_THRESHOLD - 0.01, 0, 'pawn')
    assert.equal(field.stepCost(10, 10, { tick: 0, discount: TRAIL_COST_DISCOUNT }), 1)
    field.deposit(10, 10, 0.02, 0, 'pawn')
    assert.ok(field.stepCost(10, 10, { tick: 0, discount: TRAIL_COST_DISCOUNT }) < 1, 'past the threshold it begins')
})

test('stepCost: a worn road stops paying for itself as it ages', () => {
    const field = road(100, { tick: 0 })
    const fresh = field.stepCost(0, 0, { tick: 0, discount: TRAIL_COST_DISCOUNT })
    const old = field.stepCost(0, 0, { tick: 480, discount: TRAIL_COST_DISCOUNT })
    assert.ok(old > fresh, `relief should fade with the wear: ${fresh} -> ${old}`)
    assert.ok(old < 1, 'but a half-life later the road still helps')
    const gone = field.stepCost(0, 0, { tick: 480 * 40, discount: TRAIL_COST_DISCOUNT })
    assert.equal(gone, 1, 'grass recovers')
})

test('stepCost: a discount of zero switches the relief off', () => {
    const field = road(100)
    assert.equal(field.stepCost(0, 0, { tick: 0, discount: 0 }), 1)
    // Never free, never negative, however greedy the caller is.
    assert.ok(field.stepCost(0, 0, { tick: 0, discount: 10 }) > 0)
    assert.ok(field.stepCost(0, 0, { tick: 0, discount: 10 }) >= 1 - 0.9)
})

test('stepCost agrees with the number the planner charged for the same ground', () => {
    // The reason the estimate can be trusted at all: pathCost is the sum of
    // these local discounts over the leg, so a uniform road has to reconcile.
    const field = road(200)
    const step = field.stepCost(100, 0, { tick: 0, discount: TRAIL_COST_DISCOUNT })
    const cost = field.pathCost(0, 0, 200, 0, { tick: 0, discount: TRAIL_COST_DISCOUNT })
    assert.ok(Math.abs(cost - 200 * step) < 1e-6, `cost ${cost} vs ${200 * step}`)
})

// --- the body --------------------------------------------------------------

test('a traveller who cannot read paths steps exactly as before', () => {
    const field = road(400)
    const blind = walker({ affinity: 0, field })
    const nowhere = walker({ affinity: 0, field: null })
    blind.setValidatedTarget(200, 0)
    nowhere.setValidatedTarget(200, 0)
    assert.equal(blind.move(), true)
    assert.equal(nowhere.move(), true)
    assert.equal(blind.x, nowhere.x, 'the road changed nothing for them')
    assert.equal(blind.lastStepCost, 1)
})

test('treading on a path pays the walker in stride', () => {
    const field = road(400)
    const reader = walker({ affinity: 1, field })
    const control = walker({ affinity: 1, field: null })
    control.trailAffinity = 1
    reader.setValidatedTarget(200, 0)
    control.setValidatedTarget(200, 0)
    reader.move()
    control.move()
    const plain = control.x
    const onRoad = reader.x
    assert.ok(onRoad > plain, `road stride ${onRoad} should beat plain stride ${plain}`)
    // The stride gain is the reciprocal of the step cost, so the two halves of
    // the change cannot drift apart.
    assert.ok(Math.abs(onRoad - plain / reader.lastStepCost) < 1e-9)
    assert.ok(Math.abs(reader.lastStepCost - (1 - TRAIL_COST_DISCOUNT)) < 1e-9)
    assert.ok(plain < 2.0001 && plain > 1.9999, `a plain step is one speed, got ${plain}`)
})

test('a pawn with no trail skill is unaffected by the road under its feet', () => {
    // #98's degeneracy clause. A pawn's base trailAffinity is not zero (it is
    // 0.35 so that steering works at all), so the *gate* has to be the same
    // reading of the land the planner uses, not the raw affinity.
    const field = road(400)
    const untrained = makePawn({ field })
    untrained._steerAlongTrails(1, 0)
    assert.equal(trailPlanningBias(untrained), 0)
    assert.ok(untrained.trailAffinity > 0, 'affinity alone is not the gate')
    assert.equal(untrained.trailStepCost(), 1)
    // And it walks exactly as far as the same pawn on untrodden ground.
    const onRoad = makePawn({ field })
    const offRoad = makePawn({ field: null })
    onRoad.setValidatedTarget(300, 0)
    offRoad.setValidatedTarget(300, 0)
    onRoad.move()
    offRoad.move()
    assert.equal(onRoad.x, offRoad.x)
})

test('a pawn that can read the land walks faster on it, by how much it can read', () => {
    const field = road(400)
    const novice = makePawn({ field, orienteering: TRAIL_PLANNING_SKILL_MASTERY / 2 })
    const master = makePawn({ field, orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    assert.ok(Math.abs(novice.trailStepCost() - (1 - TRAIL_COST_DISCOUNT / 2)) < 1e-9)
    assert.ok(Math.abs(master.trailStepCost() - (1 - TRAIL_COST_DISCOUNT)) < 1e-9)

    const control = makePawn({ field: null, orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    const start = 100
    for (const p of [master, control]) p.x = start
    master.setValidatedTarget(300, 0)
    control.setValidatedTarget(300, 0)
    master.move()
    control.move()
    const gained = master.x - start
    const plain = control.x - start
    assert.ok(gained > plain, `${gained} should beat ${plain}`)
    assert.ok(Math.abs(gained - plain / master.trailStepCost()) < 1e-6)
})

test('faster legs still wear every cell they cross', () => {
    // The relief must not punch holes in the wear field: depositFootfall
    // sub-samples along the stride, so a long step leaves the same scrape a
    // short one would.
    const field = new TrailField({ tick: 0 })
    const fast = walker({ affinity: 1, field })
    fast.speed = 8
    for (let i = 0; i < 10; i++) {
        fast.setValidatedTarget(400, 0)
        fast.move()
    }
    assert.ok(fast.x > 60, `the road should have carried it, x=${fast.x}`)
    // The cell a walker starts in never gets scraped (TrailField's rule since
    // #77, unrelated to this), so the sweep begins one cell in.
    for (let x = TRAIL_CELL_SIZE * 1.5; x < fast.x - 2; x += TRAIL_CELL_SIZE) {
        assert.ok(field.intensityAt(x, 0, 0) > 0, `cell at ${x} was skipped`)
    }
})

// --- the estimate ----------------------------------------------------------

test('travelTimeTicks is quoted at the walker\'s own pace', () => {
    const pawn = makePawn({ field: null })
    pawn.x = 0
    pawn.y = 500
    const plan = createMovementPlan(pawn, 200, 500, { type: 'explore' }, 0)
    assert.equal(plan.travelTimeTicks, Math.round(200 / pawn.speed))
    assert.notEqual(plan.travelTimeTicks, Math.round(200 / 1.5), 'the generic pace made every pawn plan lie')
})

test('a plan over trodden ground predicts the walk it is about to take', () => {
    const field = road(200)
    const pawn = makePawn({ field, orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    pawn.x = 0
    pawn.y = 500
    const offRoad = createMovementPlan(pawn, 200, 500, { type: 'explore' }, 0)

    pawn.y = 0
    const onRoad = createMovementPlan(pawn, 200, 0, { type: 'explore' }, 0)
    assert.ok(onRoad.travelTimeTicks < offRoad.travelTimeTicks, 'the road should shorten the estimate')
    // And the body agrees: at speed/stepCost per tick, the walk lasts exactly
    // what the plan said.
    const pace = pawn.speed / pawn.trailStepCost()
    assert.ok(Math.abs(200 / pace - onRoad.travelTimeTicks) <= 1,
        `plan said ${onRoad.travelTimeTicks}, the legs say ${200 / pace}`)
})

test('routeRecallScore measures the lie in a plan', () => {
    assert.equal(routeRecallScore(100, 100), 1)
    assert.ok(Math.abs(routeRecallScore(100, 150) - 0.5) < 1e-9)
    assert.equal(routeRecallScore(100, 300), 0)
    assert.equal(routeRecallScore(100, 40), 0, 'over-optimistic and over-cautious cost the same')
    assert.ok(Math.abs(routeRecallScore(100, 50) - routeRecallScore(100, 200)) < 1e-9, 'symmetric')
    assert.equal(routeRecallScore(0, 10), 0)
    assert.equal(routeRecallScore(10, NaN), 0)
    assert.equal(routeRecallScore(undefined, undefined), 0)
})

test('recordRouteRecall gives travelTimeTicks somewhere to be spent', () => {
    const pawn = makePawn({})
    assert.equal(pawn.progressionMetrics.routeRecallConsistency, 0, 'declared up front')
    const plan = { travelTimeTicks: 100, createdTick: 0, trailSavings: 12, trailLegs: 2 }

    const good = recordRouteRecall(pawn, plan, 100)
    assert.equal(good.score, 1)
    assert.equal(pawn.progressionMetrics.routeRecallAttempts, 1)
    assert.equal(pawn.progressionMetrics.routeRecallConsistency, 1)
    assert.deepEqual(pawn.lastRouteRecall.estimated, 100)
    assert.equal(pawn.lastRouteRecall.savings, 12)

    // One bad read among many good ones moves the average a little, not a lot.
    recordRouteRecall(pawn, { travelTimeTicks: 100, createdTick: 0 }, 400)
    assert.equal(pawn.progressionMetrics.routeRecallAttempts, 2)
    assert.ok(pawn.progressionMetrics.routeRecallConsistency > 0.4)
    assert.ok(pawn.progressionMetrics.routeRecallConsistency < 1)

    // Steady accuracy converges to the gate the progression controller wants.
    const careful = makePawn({})
    for (let i = 0; i < 40; i++) {
        recordRouteRecall(careful, { travelTimeTicks: 100, createdTick: 0 }, i % 20 === 0 ? 110 : 100)
    }
    assert.ok(careful.progressionMetrics.routeRecallConsistency > 0.9,
        `should be a reliable planner, got ${careful.progressionMetrics.routeRecallConsistency}`)
    assert.ok(careful.progressionMetrics.routeRecallConsistency <= 1)
})

test('recordRouteRecall survives a plan with nothing to compare', () => {
    const pawn = makePawn({})
    const res = recordRouteRecall(pawn, { travelTimeTicks: 0, createdTick: 5 }, 9)
    assert.equal(res.score, 0)
    assert.equal(pawn.progressionMetrics.routeRecallConsistency, 0)
    assert.equal(recordRouteRecall(null, null, 0), null)
})

test('finishing a route scores it', () => {
    const pawn = makePawn({ planning: 1, field: null })
    const goal = { type: 'explore', description: 'see what is out there', priority: 1 }
    pawn.currentGoal = goal
    pawn.movementPlan = {
        goal,
        createdTick: pawn.world.tick,
        index: 0,
        replanAt: Infinity,
        travelTimeTicks: 30,
        trailBias: 0,
        trailSavings: 0,
        trailLegs: 0,
        waypoints: [],
        destination: { x: Math.round(pawn.x), y: Math.round(pawn.y) }
    }
    pawn.goals.advanceExplorationTarget()
    assert.equal(pawn.progressionMetrics.routeRecallAttempts, 1, 'the walk was graded against its plan')
    assert.equal(pawn.lastRouteRecall.actual, 0)
    assert.ok(pawn.lastRouteRecall.estimated === 30)
})

// --- the telling -----------------------------------------------------------

test('the readout says what the ground is doing for the pawn', () => {
    const field = road(400)
    const untrained = makePawn({ field })
    untrained.trail.followed = 12
    assert.doesNotMatch(untrained.trailReport(), /underfoot/, 'nothing to report on ground they cannot read')

    const master = makePawn({ field, orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    master.trail.followed = 12
    assert.match(master.trailReport(), /12 trodden steps/)
    assert.match(master.trailReport(), /road underfoot -35%/)
})

test('a world with no paths at all costs the same as it did before #98', () => {
    const plain = walker({ affinity: 1, field: null })
    const blind = walker({ affinity: 0, field: null })
    plain.setValidatedTarget(100, 0)
    blind.setValidatedTarget(100, 0)
    plain.move()
    blind.move()
    assert.equal(plain.x, blind.x)
    assert.equal(plain.lastStepCost, 1)
    // And a field that exists but has nothing worth following.
    const sparse = new TrailField({ tick: 0 })
    sparse.deposit(4, 4, 0.1, 0, 'pawn')
    assert.equal(walker({ affinity: 1, field: sparse }).trailStepCost(), 1)
})

test('animals feel the ground too, through their own affinity', () => {
    const field = road(400)
    const deer = walker({ affinity: 0.5, field })
    const wolf = walker({ affinity: 1, field })
    const halfway = 1 - TRAIL_COST_DISCOUNT * 0.5
    assert.ok(Math.abs(deer.trailStepCost() - halfway) < 1e-9, `got ${deer.trailStepCost()}`)
    assert.ok(wolf.trailStepCost() < deer.trailStepCost(), 'a path-hugging predator is using it harder')
    assert.ok(wolf.trailStepCost() >= 1 - TRAIL_COST_DISCOUNT)
})

test('stepCost needs no options at all to answer', () => {
    const field = road(100)
    // Defaults mirror pathCost: the standard discount, at the field's own clock.
    assert.ok(Math.abs(field.stepCost(0, 0) - (1 - TRAIL_COST_DISCOUNT)) < 1e-9)
    assert.equal(field.stepCost(0, 500, { tick: 0, discount: 0.5 }), 1, 'grass, not a road')
    assert.equal(field.stepCost(0, 0, { tick: 0, discount: -1 }), 1)
})
