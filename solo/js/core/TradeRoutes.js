/**
 * Trade route tracking for merchant pawns.
 * 
 * Manages regularly traveled paths between settlement nodes,
 * tracking travel frequency, value spreads, and route safety.
 */

import { getPrice } from './PriceRegistry.js'

/**
 * What a walk has to clear in raw spread before it counts as worth taking (#118).
 *
 * One number for the whole sim: `PRICE_TRADE_MARGIN` in `PawnMercantile.js` is
 * this constant, so a road and a trade partner are measured against the same
 * idea of "worth the trip".
 */
export const ROUTE_TRADE_MARGIN = 1.2

/** Below this a road is too dangerous to plan anything along (unchanged since #95). */
export const ROUTE_SAFETY_FLOOR = 0.3

/**
 * #99: how long a trading day is, in ticks, for both halves of a journey.
 *
 * The route table used to distrust any trip over 600 ticks, which was the right
 * ceiling when a "journey" was the last few steps of a chance meeting and the
 * wrong one the moment a merchant sets out to cross the map: a real crossing is
 * thrown away as noise. One figure, in the module both travellers and route
 * tables can import without a cycle, so the goal that gives up and the ledger
 * that refuses to believe cannot drift apart.
 */
export const TRADE_DAY_TICKS = 2400

/** True for a real, usable duration; a trip nobody timed must not poison the average. */
function positive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Create a new trade route between two locations.
 * 
 * @param {Object} routes - Trade routes collection (attached to pawn or world)
 * @param {string} fromLocation - Origin location identifier
 * @param {string} toLocation - Destination location identifier
 * @param {number} tick - Current world tick
 * @param {Object} [options] - #95 measurements taken from the ground itself:
 *   {fromPoint, toPoint, geometry, distance, coverage, travelTime, value}.
 *   A route is no longer only a pair of names: it carries the polyline it
 *   walks, so a renderer, a cost estimate, or a merchant deciding whether the
 *   trip is worth it can use it without asking the sim anything.
 * @returns {Object} The created route object
 */
export function createRoute(routes, fromLocation, toLocation, tick, options = {}) {
    if (!routes.list) routes.list = []

    const routeId = `route_${fromLocation}_${toLocation}_${Date.now()}`
    const route = {
        routeId,
        from: fromLocation,
        to: toLocation,
        trips: 1,
        lastTrip: tick,
        totalValue: options.value || 0,
        averageTravelTime: positive(options.travelTime) ? options.travelTime : 0,
        safetyScore: 1.0,
        // #95: geometry, null when the route was made from names alone.
        fromPoint: options.fromPoint ?? null,
        toPoint: options.toPoint ?? null,
        geometry: Array.isArray(options.geometry) && options.geometry.length ? options.geometry : null,
        distance: options.distance ?? null,
        coverage: options.coverage ?? null
    }

    routes.list.push(route)
    return route
}

/**
 * Find the route between two places, in either direction (#95).
 *
 * A road runs both ways, and a return trip should maintain the entry the
 * outbound trip made rather than start a rival one.
 * @param {Object} routes - Trade routes collection
 * @param {string} a - One location identifier
 * @param {string} b - The other
 * @returns {Object|null}
 */
export function findRoute(routes, a, b) {
    return routes.list?.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a)) ?? null
}

/**
 * Record a completed trip on an existing route.
 * 
 * @param {Object} routes - Trade routes collection
 * @param {string} fromLocation - Origin location
 * @param {string} toLocation - Destination location
 * @param {number} value - Value of goods traded on this trip
 * @param {number} travelTime - Time taken for this trip in ticks
 * @param {number} tick - Current world tick
 * @param {Object} [options] - #95 measurements for this trip, same shape as
 *   createRoute's. A trip is how a road is kept: the entry refreshes whatever
 *   the walker actually measured this time round, so the table follows the
 *   ground instead of freezing the first survey.
 * @returns {Object|null} The route maintained, or null when none matched
 */
export function recordTrip(routes, fromLocation, toLocation, value, travelTime, tick, options = {}) {
    const route = findRoute(routes, fromLocation, toLocation)

    if (!route) return null

    route.trips++
    route.lastTrip = tick
    route.totalValue += value

    // Running average of travel time
    if (positive(travelTime)) {
        route.averageTravelTime = ((route.averageTravelTime * (route.trips - 1)) + travelTime) / route.trips
    }

    if (options.fromPoint) route.fromPoint = options.fromPoint
    if (options.toPoint) route.toPoint = options.toPoint
    if (Array.isArray(options.geometry) && options.geometry.length) route.geometry = options.geometry
    if (options.distance != null) route.distance = options.distance
    if (options.coverage != null) route.coverage = options.coverage

    return route
}

/**
 * Update route safety score based on recent incidents.
 * 
 * @param {Object} routes - Trade routes collection
 * @param {string} fromLocation - Origin location
 * @param {string} toLocation - Destination location
 * @param {number} incident - Incident severity (0 = safe, 1 = hostile encounter)
 */
export function updateRouteSafety(routes, fromLocation, toLocation, incident) {
    // A road runs both ways (#118), so an incident on the way home degrades the
    // same entry the outbound trip made.
    const route = findRoute(routes, fromLocation, toLocation)

    if (!route) return

    // Decay safety score on incidents, recover slowly
    route.safetyScore = Math.max(0, route.safetyScore - incident * 0.2)
}

/**
 * The ends of a road, in the direction a given walker would take it (#118).
 *
 * `createRoute` stores a road with a first name and a second name - alphabetical,
 * since `Pawn.noteTradeRoute` normalises the pair so both traders write one entry
 * - and that order has nothing to do with which end anyone is standing at. A road
 * is therefore walkable twice, and which traversal is profitable depends entirely
 * on where the walker is.
 *
 * @param {Object} route - A stored route
 * @param {string|null} fromLocation - Where the walker is, or null for "unknown"
 * @returns {Array<[string, string]>} [leaveAt, sellAt] pairs to price
 */
function routeLegs(route, fromLocation) {
    const forth = [route.from, route.to]
    const back = [route.to, route.from]
    if (fromLocation == null) return [forth, back]
    if (route.from === fromLocation) return [forth]
    if (route.to === fromLocation) return [back]
    // A road the walker is not standing on is not theirs to walk. Setting out
    // for it from somewhere else is the journey #99 describes, not this function.
    return []
}

/** A leg with more spread wins; ties go to the shorter road, then the better-worn one. */
function isBetterLeg(candidate, best) {
    if (!best) return true
    if (candidate.spread !== best.spread) return candidate.spread > best.spread
    const a = Number.isFinite(candidate.distance) ? candidate.distance : Infinity
    const b = Number.isFinite(best.distance) ? best.distance : Infinity
    if (a !== b) return a < b
    return (candidate.trips ?? 0) > (best.trips ?? 0)
}

/**
 * Find the best route for a specific item type based on price differentials.
 *
 * #118. This used to price each road in the direction it happened to be stored
 * and to accept any positive spread, which together meant the answer was the
 * accident of an id with a number attached to it: a single road whose far end was
 * four fifths cheaper came back as "the best route", and a profitable return trip
 * could not be expressed at all. A road is now walked from whichever end the
 * merchant is at, and a spread that does not clear `margin` is not a route - "no
 * route" and "a route that loses goods" are both `null`, which is the only way a
 * caller can tell them apart.
 *
 * @param {Object} routes - Trade routes collection
 * @param {Object} priceRegistry - Price registry from PriceRegistry module
 * @param {string} itemType - Item type to find best route for
 * @param {string|null} [fromLocation=null] - Where the walker is. Null prices both
 *   directions of every road and returns the better of them; a name restricts the
 *   search to roads leaving that place, from that end.
 * @param {Object} [options] - {margin} to override ROUTE_TRADE_MARGIN
 * @returns {Object|null} Best route with profit potential, tagged with the
 *   `leaveAt`/`sellAt` ends this traversal uses (`from`/`to` stay as stored)
 */
export function findBestRoute(routes, priceRegistry, itemType, fromLocation = null, options = {}) {
    if (!routes.list?.length) return null

    const margin = Number.isFinite(options.margin) ? options.margin : ROUTE_TRADE_MARGIN
    let best = null

    for (const route of routes.list) {
        if (!(route.safetyScore > ROUTE_SAFETY_FLOOR)) continue

        for (const [leaveAt, sellAt] of routeLegs(route, fromLocation)) {
            const leavePrice = getPrice(priceRegistry, itemType, leaveAt)
            const sellPrice = getPrice(priceRegistry, itemType, sellAt)

            if (!leavePrice || !sellPrice) continue

            const spread = sellPrice / leavePrice
            if (spread <= margin) continue

            const candidate = { ...route, leaveAt, sellAt, spread }
            if (isBetterLeg(candidate, best)) best = candidate
        }
    }

    return best
}

/**
 * Get every road that touches a place, either end (#118).
 *
 * A stored route has a first name and a second name, but a road runs both ways,
 * so "routes from here" means the ones a walker here could set out along.
 *
 * @param {Object} routes - Trade routes collection
 * @param {string} location - Location identifier
 * @returns {Object[]} Array of routes with an end at this location
 */
export function getRoutesFrom(routes, location) {
    return routes.list?.filter(r => r.from === location || r.to === location) ?? []
}

/**
 * Check if a route is active (traveled recently), from either end (#118).
 *
 * @param {Object} routes - Trade routes collection
 * @param {string} fromLocation - One end
 * @param {string} toLocation - The other
 * @param {number} currentTick - Current world tick
 * @param {number} inactiveThreshold - Ticks before route is considered inactive (default 500)
 * @returns {boolean} True if route has been traveled recently
 */
export function isRouteActive(routes, fromLocation, toLocation, currentTick, inactiveThreshold = 500) {
    const route = findRoute(routes, fromLocation, toLocation)

    if (!route) return false
    return (currentTick - route.lastTrip) < inactiveThreshold
}
