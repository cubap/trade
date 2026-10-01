import test from 'node:test'
import assert from 'node:assert/strict'

import {
    PLANNING_MIN_FOR_ROUTES,
    planningParams,
    buildWaypoints,
    createMovementPlan,
    currentWaypoint,
    advanceWaypoint,
    planComplete,
    replanIfNeeded
} from '../js/models/entities/mobile/MovementPlan.js'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

function fakePawn(planning, x = 0, y = 0) {
    return {
        x, y,
        world: null,
        getSkill: (s) => (s === 'planning' ? planning : 0)
    }
}

test('planningParams: higher planning means longer legs and rarer re-checks', () => {
    const low = planningParams(0.3)
    const high = planningParams(1)
    assert.ok(high.legLength > low.legLength)
    assert.ok(high.replanInterval > low.replanInterval)
})

test('buildWaypoints: intermediate legs only, destination excluded', () => {
    const wps = buildWaypoints(0, 0, 300, 0, 100)
    assert.equal(wps.length, 2)
    assert.deepEqual(wps[0], { x: 100, y: 0 })
    assert.deepEqual(wps[1], { x: 200, y: 0 })
    assert.equal(buildWaypoints(0, 0, 50, 0, 100).length, 0, 'short hops need no waypoints')
})

test('createMovementPlan: stores destination, schedule and travel estimate', () => {
    const pawn = fakePawn(1)
    const plan = createMovementPlan(pawn, 400, 0, { type: 'explore' }, 100)
    assert.deepEqual(plan.destination, { x: 400, y: 0 })
    assert.equal(plan.createdTick, 100)
    assert.ok(plan.replanAt > 100)
    assert.ok(plan.travelTimeTicks > 0)
    assert.ok(plan.waypoints.length >= 1)
})

test('currentWaypoint walks toward destination as index advances', () => {
    const pawn = fakePawn(1)
    const plan = createMovementPlan(pawn, 400, 0, null, 0)
    assert.equal(currentWaypoint(plan), plan.waypoints[0])
    plan.index = plan.waypoints.length
    assert.deepEqual(currentWaypoint(plan), plan.destination)
})

test('advanceWaypoint: steps past waypoints within tolerance only', () => {
    const pawn = fakePawn(1)
    const plan = createMovementPlan(pawn, 400, 0, null, 0)
    const first = plan.waypoints[0]
    assert.equal(advanceWaypoint(plan, 0, 0), true, 'not at waypoint yet')
    assert.equal(plan.index, 0)
    assert.equal(advanceWaypoint(plan, first.x, first.y), plan.waypoints.length > 1)
    assert.equal(plan.index, 1)
})

test('planComplete: only near the final destination', () => {
    const pawn = fakePawn(1)
    const plan = createMovementPlan(pawn, 400, 0, null, 0)
    assert.equal(planComplete(plan, 0, 0), false)
    assert.equal(planComplete(plan, 395, 2), true)
})

test('replanIfNeeded: rebuilds legs from current position on schedule', () => {
    const pawn = fakePawn(1)
    const plan = createMovementPlan(pawn, 400, 0, null, 0)
    assert.equal(replanIfNeeded(plan, pawn, plan.replanAt - 1), false)
    pawn.x = 200
    pawn.y = 0
    assert.equal(replanIfNeeded(plan, pawn, plan.replanAt), true)
    assert.ok(plan.waypoints.every(w => w.x > 200 && w.x < 400), 'legs rebuilt from new position')
    assert.equal(plan.index, 0)
    assert.ok(plan.replanAt > 0)
})

// --- PawnGoals integration -------------------------------------------------

function makePawn(name, planning) {
    const world = new World(2000, 2000)
    const pawn = new Pawn(name, name, 1000, 1000)
    world.addEntity(pawn)
    if (planning > 0) pawn.useSkill('planning', planning)
    return pawn
}

test('low-planning pawns keep wandering without a plan', () => {
    const pawn = makePawn('p-roamer', 0)
    pawn.goals.currentGoal = { type: 'explore', description: 'Wander', preemptible: false, startedAtTick: 0 }
    pawn.goals.selectExplorationTarget()
    assert.equal(pawn.movementPlan, undefined, 'no plan object created')
    assert.ok(Number.isFinite(pawn.nextTargetX) && Number.isFinite(pawn.nextTargetY))
})

test('planning pawns convert exploration into a waypoint route', () => {
    const pawn = makePawn('p-planner', 1)
    const goal = { type: 'explore', description: 'Wander', preemptible: false, startedAtTick: 0 }
    pawn.goals.currentGoal = goal
    pawn.goals.selectExplorationTarget()
    assert.ok(pawn.movementPlan, 'plan created')
    assert.equal(pawn.movementPlan.goal, goal)
    const wp = currentWaypoint(pawn.movementPlan)
    assert.equal(pawn.nextTargetX, wp.x)
    assert.equal(pawn.nextTargetY, wp.y)
})

test('an active route raises goal commitment (but critical needs still win)', () => {
    const pawn = makePawn('p-committed-route', 1)
    const goal = { type: 'explore', description: 'Wander', preemptible: false, startedAtTick: 0 }
    pawn.goals.currentGoal = goal
    pawn.goals.selectExplorationTarget()
    assert.ok(pawn.movementPlan)

    const cost = pawn.goals.getCommitmentCost()
    assert.ok(cost >= 1, `expected commitment boost, got ${cost}`)
    assert.equal(pawn.goals.shouldPreemptForEmergencyNeed({ need: 'hunger', priority: 3 }), false)
    assert.equal(pawn.goals.shouldPreemptForEmergencyNeed({ need: 'hunger', priority: 4 }), true)
})

test('finishing the route clears the plan and pays planning XP', () => {
    const pawn = makePawn('p-arriver', 1)
    const goal = { type: 'explore', description: 'Wander', preemptible: false, startedAtTick: 0 }
    pawn.goals.currentGoal = goal
    pawn.goals.selectExplorationTarget()
    const before = pawn.getSkill('planning')

    const plan = pawn.movementPlan
    pawn.x = plan.destination.x
    pawn.y = plan.destination.y
    plan.index = plan.waypoints.length
    pawn.goals.advanceExplorationTarget()

    assert.ok(pawn.getSkill('planning') > before, 'planning skill grew')
    assert.notEqual(pawn.movementPlan, plan, 'old plan replaced or cleared')
})

test('startGoal clears any stale movement plan', () => {
    const pawn = makePawn('p-stale', 0.5)
    pawn.movementPlan = { goal: { type: 'old' }, destination: { x: 1, y: 1 }, waypoints: [], index: 0 }
    pawn.goals.startGoal({ type: 'rest', description: 'Rest', preemptible: false })
    assert.equal(pawn.movementPlan, null)
})
