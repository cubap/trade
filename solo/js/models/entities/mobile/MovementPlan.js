import { clampTargetToPassable } from './MovementTerrain.js'
import { trailFieldFor, TRAIL_COST_DISCOUNT } from '../../../core/TrailField.js'

// Movement planning (#81): the `planning` skill turns directionless wandering
// into intentional routes. Low planning keeps the old "pick a vector and go"
// behaviour; once planning is developed the pawn builds waypoint routes to its
// destination, follows them leg by leg, re-evaluates only on a skill-scaled
// interval, and is harder to divert while a plan is active.
//
// #94 adds the ground to that picture: a route is *costed* rather than
// measured, so legs sitting on worn corridors are cheaper, waypoints snap onto
// known paths, and destination choice ("two equal berries, one of them down
// the road") follows. #77's followBias() bends one step at a time; this is the
// plan that decides before the step.

export const PLANNING_MIN_FOR_ROUTES = 0.3

// Waypoint arrival radius (world units) for route legs.
export const WAYPOINT_TOLERANCE = 20

// Rough speed used for travel-time estimates (world units per tick).
const ESTIMATE_SPEED = 1.5

/**
 * #94: how far off the direct line a waypoint may be dragged onto worn ground.
 * Bounded on purpose - an unbounded "always use the path" makes every planner
 * on the map converge onto one corridor, which is the opposite of the
 * emergence #77's tests depend on.
 */
export const TRAIL_WAYPOINT_SNAP = 40

/** ...and never more than this fraction of the leg length. */
export const TRAIL_WAYPOINT_SNAP_RATIO = 0.25

/**
 * #94: skill at which a pawn reads the land well enough to plan with it.
 * Mirrors #77's mastery constant in Pawn.js; duplicated rather than imported
 * because MovementPlan must not depend on the entity classes.
 */
export const TRAIL_PLANNING_SKILL_MASTERY = 20

/**
 * #94: how strongly this pawn plans its routes around worn ground, 0..1. Zero
 * for an untrained traveller, which is what keeps a fresh pawn's behaviour
 * identical to the pre-#94 planner - it cannot budget for paths it cannot
 * read. Gated by the skills #77 pays for trail use, not by `planning`.
 */
export function trailPlanningBias(pawn) {
    if (typeof pawn?.getSkill !== 'function') return 0
    const skill = Math.max(
        pawn.getSkill('orienteering') || 0,
        pawn.getSkill('tracking') || 0,
        pawn.getSkill('cartography') || 0
    )
    if (!(skill > 0)) return 0
    return Math.min(1, skill / TRAIL_PLANNING_SKILL_MASTERY)
}

/**
 * #95: cartography at which a pawn will lay a straight surveyed line across
 * country it has never worn, instead of metalling the footpath under its feet.
 * Half the mastery needed merely to *use* worn ground: anyone can walk a path,
 * improving on it is the craft.
 */
export const TRAIL_SURVEY_SKILL = TRAIL_PLANNING_SKILL_MASTERY / 2

/**
 * True when this pawn is a surveyor good enough to build rather than recognise
 * (#95). Deliberately cartography alone - tracking and orienteering tell you
 * where people have been, which is the opposite of a surveyed line.
 */
export function canSurveyRoutes(pawn) {
    if (typeof pawn?.getSkill !== 'function') return false
    return (pawn.getSkill('cartography') || 0) >= TRAIL_SURVEY_SKILL
}

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

    // #94: read the ground, never create it. A world nobody has walked has no
    // field and plans exactly as it did before.
    const field = trailFieldFor(pawn.world, { create: false })
    const bias = field ? trailPlanningBias(pawn) : 0
    const routeOptions = { field, bias, tick }

    const waypoints = buildWaypoints(pawn.x, pawn.y, targetX, targetY, params.legLength, routeOptions)
    const route = measureRoute(pawn.x, pawn.y, waypoints, targetX, targetY, routeOptions)

    return {
        goal: goal ?? null,
        destination: { x: targetX, y: targetY },
        waypoints,
        index: 0,
        createdTick: tick ?? 0,
        replanAt: (tick ?? 0) + params.replanInterval,
        travelTimeTicks: estimateTravelTime(pawn.x, pawn.y, waypoints, targetX, targetY, routeOptions),
        planningAtCreation: planning,
        // #94 telemetry: units of walking the worn ground saved over the
        // straight-line cost, and how many legs were placed on a path.
        trailSavings: route.savings,
        trailLegs: waypoints.filter(wp => wp.onTrail).length,
        trailBias: bias
    }
}

/**
 * Intermediate waypoints along the straight line, spaced ~legLength apart.
 * The final destination is not included (it is tracked separately).
 *
 * With `field` and a non-zero `bias` (#94) each waypoint is nudged onto the
 * strongest worn ground within a bounded radius of its straight-line slot: a
 * path worth taking is one you barely leave the line for.
 */
export function buildWaypoints(fromX, fromY, toX, toY, legLength, options = {}) {
    const dx = toX - fromX
    const dy = toY - fromY
    const dist = Math.hypot(dx, dy)
    // Intermediate legs only; the destination is tracked separately.
    const legs = Math.max(0, Math.ceil(dist / legLength) - 1)
    const field = options.field ?? null
    const bias = Math.max(0, Math.min(1, options.bias ?? 0))
    const snap = field && bias > 0
        ? Math.min(TRAIL_WAYPOINT_SNAP, (legLength || 0) * TRAIL_WAYPOINT_SNAP_RATIO) * bias
        : 0
    const waypoints = []
    for (let i = 1; i <= legs; i++) {
        const t = (i * legLength) / dist
        const nominal = { x: fromX + dx * t, y: fromY + dy * t }
        if (snap > 0) {
            const worn = field.wearNear(nominal.x, nominal.y, { radius: snap, tick: options.tick })
            // The search radius is capped at a fraction of the leg length and
            // every waypoint sits a whole leg ahead of the walker, so a snapped
            // point is still ahead: paths are used, not chased. That cap is
            // also what stops every planner on the map converging onto a
            // single corridor.
            if (worn) {
                nominal.x = worn.x
                nominal.y = worn.y
                nominal.onTrail = true
                nominal.wear = worn.intensity
                nominal.kind = worn.kind ?? null
            }
        }
        waypoints.push(nominal)
    }
    return waypoints
}

/**
 * #94: distance and trail-aware cost of a whole route (start, waypoints,
 * destination). Cost equals distance whenever there is no field, no skill to
 * read it with, or nothing worn underfoot, so an estimate built before #94 is
 * still an estimate built after it.
 */
export function measureRoute(fromX, fromY, waypoints, toX, toY, options = {}) {
    const points = [{ x: fromX, y: fromY }, ...(Array.isArray(waypoints) ? waypoints : []), { x: toX, y: toY }]
    const distance = points.slice(1).reduce((sum, p, i) => {
        const prev = points[i]
        return sum + Math.hypot(p.x - prev.x, p.y - prev.y)
    }, 0)
    const field = options.field
    const bias = Math.max(0, Math.min(1, options.bias ?? 0))
    if (!field || typeof field.routeCost !== 'function' || bias <= 0) {
        return { distance, cost: distance, savings: 0 }
    }
    const route = field.routeCost(points, {
        tick: options.tick,
        discount: TRAIL_COST_DISCOUNT * bias
    })
    return { distance, cost: route.cost, savings: route.savings }
}

function estimateTravelTime(fromX, fromY, waypoints, toX, toY, options = {}) {
    const { cost } = measureRoute(fromX, fromY, waypoints, toX, toY, options)
    return Math.round(cost / ESTIMATE_SPEED)
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
    const field = trailFieldFor(pawn.world, { create: false })
    const bias = field ? trailPlanningBias(pawn) : 0
    const routeOptions = { field, bias, tick }
    plan.waypoints = buildWaypoints(pawn.x, pawn.y, plan.destination.x, plan.destination.y, params.legLength, routeOptions)
    plan.index = 0
    plan.replanAt = tick + params.replanInterval
    // Skills improve while walking, so a route can learn to use the ground it
    // is wearing down; keep the plan's own numbers in step with its legs.
    plan.trailBias = bias
    plan.trailLegs = plan.waypoints.filter(wp => wp.onTrail).length
    plan.travelTimeTicks = estimateTravelTime(pawn.x, pawn.y, plan.waypoints, plan.destination.x, plan.destination.y, routeOptions)
    return true
}

/**
 * #94: order destinations by how expensive they are to *get to*, not how far
 * away they are. This is the destination half of the ticket: with two equally
 * valid berries, the one down the path wins.
 *
 * With no field, or an untrained pawn, the cost degenerates to Euclidean
 * distance and the ordering is exactly the nearest-first sort this replaced.
 * Costs are computed once per candidate rather than once per comparison.
 */
export function sortByRouteCost(pawn, list, options = {}) {
    const items = Array.isArray(list) ? list.slice() : []
    if (items.length < 2) return items
    const px = Number.isFinite(pawn?.x) ? pawn.x : 0
    const py = Number.isFinite(pawn?.y) ? pawn.y : 0
    const field = options.field !== undefined ? options.field : trailFieldFor(pawn?.world, { create: false })
    const bias = options.bias !== undefined ? options.bias : trailPlanningBias(pawn)
    const tick = options.tick ?? pawn?.world?.clock?.currentTick ?? pawn?.world?.tick ?? 0
    const discount = TRAIL_COST_DISCOUNT * Math.max(0, Math.min(1, bias))
    const costed = field && discount > 0 && typeof field.pathCost === 'function'
        ? (item) => field.pathCost(px, py, item.x, item.y, { tick, discount })
        : (item) => Math.hypot((Number.isFinite(item?.x) ? item.x : 0) - px, (Number.isFinite(item?.y) ? item.y : 0) - py)
    return items
        .map(item => ({ item, cost: costed(item) }))
        .sort((a, b) => a.cost - b.cost)
        .map(entry => entry.item)
}

/**
 * Cost of a single leg for this pawn, in units of walking, from an arbitrary
 * point rather than the pawn's position. This is the primitive callers need
 * when they are costing a *multi-stop* run (Pawn.planGatheringRoute scores
 * each next stop from wherever the previous one landed), which sortByRouteCost
 * - anchored at the pawn - cannot express.
 *
 * Same degeneracy rule: no field, nobody trained to read it, or nothing worn
 * underfoot returns the plain Euclidean distance.
 */
export function routeCostTo(pawn, fromX, fromY, toX, toY, options = {}) {
    const x0 = Number.isFinite(fromX) ? fromX : 0
    const y0 = Number.isFinite(fromY) ? fromY : 0
    const x1 = Number.isFinite(toX) ? toX : 0
    const y1 = Number.isFinite(toY) ? toY : 0
    const straight = Math.hypot(x1 - x0, y1 - y0)
    if (!Number.isFinite(straight) || straight <= 0) return Number.isFinite(straight) ? straight : 0
    const field = options.field !== undefined ? options.field : trailFieldFor(pawn?.world, { create: false })
    if (!field || typeof field.pathCost !== 'function' || field.cells?.size === 0) return straight
    const bias = options.bias !== undefined ? options.bias : trailPlanningBias(pawn)
    const discount = TRAIL_COST_DISCOUNT * Math.max(0, Math.min(1, bias))
    if (discount <= 0) return straight
    const tick = options.tick ?? pawn?.world?.clock?.currentTick ?? pawn?.world?.tick ?? 0
    return field.pathCost(x0, y0, x1, y1, { tick, discount })
}
