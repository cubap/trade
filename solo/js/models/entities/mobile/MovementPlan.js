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
    const routeOptions = { field, bias, tick, speed: pawn.speed }

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
    // #98: costed at the walker's own pace. A pawn walks at 0.7 units/tick and
    // the generic figure is 1.5, so quoting the constant made every pawn's plan
    // read twice as optimistic as the walk it described - and an estimate
    // nobody can be checked against is not information.
    const speed = Number.isFinite(options.speed) && options.speed > 0 ? options.speed : ESTIMATE_SPEED
    return Math.round(cost / speed)
}

/**
 * #98: how close a finished walk came to what its plan predicted, 0..1.
 *
 * `travelTimeTicks` was computed and then read by nothing but its own test,
 * which is the same as lying about the route. Scoring the walk against the
 * prediction gives the estimate a consumer, and gives the player a number that
 * means something: 1 for a pawn that called it right, 0.5 when the walk took
 * twice (or half) as long as advertised, 0 once the plan is pure fiction.
 * Symmetric in the ratio, so wishful planning and excessive caution cost the
 * same.
 */
export function routeRecallScore(estimatedTicks, actualTicks) {
    const e = Number(estimatedTicks)
    const a = Number(actualTicks)
    if (!Number.isFinite(e) || !Number.isFinite(a) || e <= 0 || a <= 0) return 0
    const ratio = Math.max(a / e, e / a)
    return Math.max(0, Math.min(1, 2 - ratio))
}

/** Attempts after which the running average stops moving much per route. */
export const ROUTE_RECALL_WINDOW = 10

/**
 * #98: fold one finished route into the pawn's record of how well it reads
 * country. Written into `progressionMetrics.routeRecallConsistency`, which is
 * the Phase-3 gate in ProgressionController.js - previously nothing in the
 * simulation ever produced it, so a pawn could never earn its way to the
 * mapping phase by walking well.
 *
 * @returns {{score: number, estimated: number, actual: number, consistency: number}}
 */
export function recordRouteRecall(pawn, plan, tick) {
    if (!pawn || !plan) return null
    const estimated = Number(plan.travelTimeTicks) || 0
    const start = Number(plan.createdTick)
    const actual = Number.isFinite(start) && Number.isFinite(tick) ? Math.max(0, tick - start) : 0
    const score = routeRecallScore(estimated, actual)

    const metrics = pawn.progressionMetrics ?? (pawn.progressionMetrics = {})
    const attempts = (Number(metrics.routeRecallAttempts) || 0) + 1
    const prev = Number.isFinite(metrics.routeRecallConsistency) ? metrics.routeRecallConsistency : 0
    const window = Math.min(attempts, ROUTE_RECALL_WINDOW)
    const consistency = Math.max(0, Math.min(1, prev + (score - prev) / window))

    metrics.routeRecallAttempts = attempts
    metrics.routeRecallConsistency = consistency
    pawn.lastRouteRecall = {
        score,
        estimated,
        actual,
        savings: Number(plan.trailSavings) || 0,
        legs: plan.trailLegs ?? 0,
        tick
    }
    // #105: the route the pawn just finished is now a preference, not just a
    // scorecard. This is the producer that makes `trailSavings` load-bearing.
    if (plan.destination) {
        rememberRouteSavings(pawn, plan.destination.x, plan.destination.y, plan.trailSavings, {
            tick,
            legs: plan.trailLegs
        })
    }
    return { score, estimated, actual, consistency }
}

// --- #105: memory of what a route was worth --------------------------------
//
// #94 measured a route's savings and #98 scored its estimate, but both figures
// were spent the moment the walk ended: `sortByRouteCost()` re-sampled the
// field for every candidate and threw the stored number away. These turn a
// walked route into a preference, which is a different and stronger claim than
// "the ground is cheap right now" - it is "I have been there and it was worth
// going", and it survives the wear fading out from under it.

/** Distinct destinations a pawn keeps a line on. */
export const ROUTE_MEMORY_MAX = 24

/** How near a candidate has to be to count as the place it walked to. */
export const ROUTE_MEMORY_TOLERANCE = WAYPOINT_TOLERANCE

/** Ticks after which a remembered saving is worth nothing at all. */
export const ROUTE_MEMORY_TTL = 2400

/** A saving smaller than this is measurement noise, not a reason to return. */
export const ROUTE_MEMORY_MIN_SAVINGS = 1

/** Trips shorter than this never get remembered (no corridor to remember). */
export const ROUTE_MEMORY_MIN_TRIP = 30

/**
 * The most memory can ever take off a candidate's cost. A remembered good
 * route is a tie-breaker, not a teleport: it must not outvote a destination
 * several times further away.
 */
export const ROUTE_MEMORY_MAX_DISCOUNT = 0.5

/**
 * Fold the savings from one walked route into the pawn's memory of its
 * destinations. Repeat visits average rather than accumulate, so a corridor
 * that was cheap once and dear twice stops pulling.
 *
 * @returns the memory entry, or null when the figure was too small or too
 *          broken to be worth remembering.
 */
export function rememberRouteSavings(pawn, destX, destY, savings, options = {}) {
    if (!pawn) return null
    const x = Number(destX)
    const y = Number(destY)
    const s = Number(savings)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    if (!Number.isFinite(s) || s < ROUTE_MEMORY_MIN_SAVINGS) return null

    const tick = Number(options.tick) || 0
    const legs = Number(options.legs) || 0
    if (!Array.isArray(pawn.routeMemory)) pawn.routeMemory = []
    const memory = pawn.routeMemory

    const existing = memory.find(entry => Math.hypot(entry.x - x, entry.y - y) <= ROUTE_MEMORY_TOLERANCE)
    if (existing) {
        const trips = Number(existing.trips) || 1
        existing.savings = (existing.savings * trips + s) / (trips + 1)
        existing.trips = trips + 1
        existing.legs = Math.max(Number(existing.legs) || 0, legs)
        existing.tick = tick
        return existing
    }

    const entry = { x, y, savings: s, legs, trips: 1, tick }
    memory.push(entry)
    if (memory.length > ROUTE_MEMORY_MAX) {
        // Evict the least-frequented, and among equals the stalest.
        let worst = 0
        for (let i = 1; i < memory.length; i++) {
            const cand = memory[i]
            if (cand.trips < memory[worst].trips
                || (cand.trips === memory[worst].trips && cand.tick < memory[worst].tick)) {
                worst = i
            }
        }
        memory.splice(worst, 1)
    }
    return entry
}

/**
 * What this pawn remembers saving on the way to (x, y), already discounted by
 * how well it reads country (#98's `routeRecallConsistency`) and how long ago
 * it walked the corridor. Null when it has never been there or the memory has
 * aged out.
 *
 * A pawn with no record of calling its routes gets half credit for its
 * memories: it has been there, which counts, but it has not shown it can read
 * what it walked.
 */
export function routeRecall(pawn, x, y, options = {}) {
    const memory = Array.isArray(pawn?.routeMemory) ? pawn.routeMemory : null
    if (!memory?.length) return null
    const tx = Number(x)
    const ty = Number(y)
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null

    const tick = Number(options.tick ?? pawn?.world?.clock?.currentTick ?? pawn?.world?.tick ?? 0) || 0
    let best = null
    for (const entry of memory) {
        const d = Math.hypot((Number(entry.x) || 0) - tx, (Number(entry.y) || 0) - ty)
        if (d > ROUTE_MEMORY_TOLERANCE) continue
        if (!best || d < best.distance) best = { entry, distance: d }
    }
    if (!best) return null

    const age = Math.max(0, tick - (Number(best.entry.tick) || 0))
    if (age >= ROUTE_MEMORY_TTL) return null
    const raw = pawn?.progressionMetrics?.routeRecallConsistency
    const consistency = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0
    const credit = Number.isFinite(options.credit)
        ? Math.max(0, Math.min(1, options.credit))
        : (0.5 + 0.5 * consistency) * (1 - age / ROUTE_MEMORY_TTL)

    return {
        entry: best.entry,
        distance: best.distance,
        age,
        credit,
        savings: Math.max(0, (Number(best.entry.savings) || 0) * credit)
    }
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
    const routeOptions = { field, bias, tick, speed: pawn.speed }
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
 * away they are. This is the destination half of the ticket: with two equal
 * berries, the one down the path wins.
 *
 * With no field, or an untrained pawn, the cost degenerates to Euclidean
 * distance and the ordering is exactly the nearest-first sort this replaced.
 * Costs are computed once per candidate rather than once per comparison.
 *
 * #105 adds the pawn's own history on top of the field reading: a destination
 * it has walked before and found cheap is discounted by what it actually saved
 * (tempered by its route-calling record and the age of the memory), so having
 * been there outranks merely being able to see the ground. Pass `memory: false`
 * for a pure field ordering.
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
    const useMemory = options.memory !== false
    const costed = field && discount > 0 && typeof field.pathCost === 'function'
        ? (item) => field.pathCost(px, py, item.x, item.y, { tick, discount })
        : (item) => Math.hypot((Number.isFinite(item?.x) ? item.x : 0) - px, (Number.isFinite(item?.y) ? item.y : 0) - py)
    return items
        .map(item => {
            let cost = costed(item)
            if (useMemory) {
                const recall = routeRecall(pawn, item?.x, item?.y, { tick, credit: options.credit })
                if (recall) cost -= Math.min(recall.savings, cost * ROUTE_MEMORY_MAX_DISCOUNT)
            }
            return { item, cost }
        })
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
