import { clampTargetToPassable } from './MovementTerrain.js'

// Movement planning (#81): the `planning` skill turns directionless wandering
// into intentional routes. Low planning keeps the old "pick a vector and go"
// behaviour; once planning is developed the pawn builds waypoint routes to its
// destination, follows them leg by leg, re-evaluates only on a skill-scaled
// interval, and is harder to divert while a plan is active.

export const PLANNING_MIN_FOR_ROUTES = 0.3

// Waypoint arrival radius (world units) for route legs.
export const WAYPOINT_TOLERANCE = 20

// Rough speed used for travel-time estimates (world units per tick).
const ESTIMATE_SPEED = 1.5

/**
 * Planning-skill-derived route parameters. Higher planning means longer legs
 * (bigger-picture routes) and less frequent re-evaluation (more resolve).
 */
export function planningParams(planning) {
    const p = Math.max(0, Math.min(1, planning || 0))
    return {
        legLength: 60 + p * 140,           // 60..200 world units between waypoints
        replanInterval: Math.round(40 + p * 160), // 40..200 ticks between re-checks
        tolerance: WAYPOINT_TOLERANCE
    }
}

/**
 * Build a movement plan from the pawn's current position to a destination.
 * The destination is clamped to passable terrain; intermediate waypoints are
 * spaced by the pawn's planning level.
 */
export function createMovementPlan(pawn, destX, destY, goal, tick) {
    const planning = pawn.getSkill ? pawn.getSkill('planning') : 0
    const params = planningParams(planning)
    const clamped = clampTargetToPassable(pawn.world, pawn.x, pawn.y, destX, destY)
    const targetX = clamped.x
    const targetY = clamped.y

    const waypoints = buildWaypoints(pawn.x, pawn.y, targetX, targetY, params.legLength)

    return {
        goal: goal ?? null,
        destination: { x: targetX, y: targetY },
        waypoints,
        index: 0,
        createdTick: tick ?? 0,
        replanAt: (tick ?? 0) + params.replanInterval,
        travelTimeTicks: estimateTravelTime(pawn.x, pawn.y, waypoints, targetX, targetY),
        planningAtCreation: planning
    }
}

/**
 * Intermediate waypoints along the straight line, spaced ~legLength apart.
 * The final destination is not included (it is tracked separately).
 */
export function buildWaypoints(fromX, fromY, toX, toY, legLength) {
    const dx = toX - fromX
    const dy = toY - fromY
    const dist = Math.hypot(dx, dy)
    // Intermediate legs only; the destination is tracked separately.
    const legs = Math.max(0, Math.ceil(dist / legLength) - 1)
    const waypoints = []
    for (let i = 1; i <= legs; i++) {
        const t = (i * legLength) / dist
        waypoints.push({ x: fromX + dx * t, y: fromY + dy * t })
    }
    return waypoints
}

function estimateTravelTime(fromX, fromY, waypoints, toX, toY) {
    let dist = 0
    let x = fromX
    let y = fromY
    for (const wp of waypoints) {
        dist += Math.hypot(wp.x - x, wp.y - y)
        x = wp.x
        y = wp.y
    }
    dist += Math.hypot(toX - x, toY - y)
    return Math.round(dist / ESTIMATE_SPEED)
}

/**
 * The waypoint the pawn should currently head for, or null once the route
 * is done (pawn should then head for `plan.destination`).
 */
export function currentWaypoint(plan) {
    if (!plan) return null
    return plan.waypoints[plan.index] ?? plan.destination ?? null
}

/**
 * If the pawn is within tolerance of its current waypoint, advance to the
 * next one. Returns true when a further waypoint (or the destination)
 * remains, false when the route is complete.
 */
export function advanceWaypoint(plan, x, y, tolerance = WAYPOINT_TOLERANCE) {
    if (!plan) return false
    const wp = plan.waypoints[plan.index]
    if (!wp) return false
    if (Math.hypot(x - wp.x, y - wp.y) > tolerance) return true
    plan.index++
    return plan.index < plan.waypoints.length
}

/**
 * True when the pawn has reached the plan's final destination.
 */
export function planComplete(plan, x, y, tolerance = WAYPOINT_TOLERANCE) {
    if (!plan?.destination) return false
    return Math.hypot(x - plan.destination.x, y - plan.destination.y) <= tolerance
}

/**
 * Re-evaluate the route on the planning-scaled interval: rebuild remaining
 * legs from the pawn's current position toward the same destination. Returns
 * true if a replan happened.
 */
export function replanIfNeeded(plan, pawn, tick) {
    if (!plan || tick < plan.replanAt) return false
    const planning = pawn.getSkill ? pawn.getSkill('planning') : 0
    const params = planningParams(planning)
    plan.waypoints = buildWaypoints(pawn.x, pawn.y, plan.destination.x, plan.destination.y, params.legLength)
    plan.index = 0
    plan.replanAt = tick + params.replanInterval
    return true
}
