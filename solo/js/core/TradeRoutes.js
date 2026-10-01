/**
 * Trade route tracking for merchant pawns.
 * 
 * Manages regularly traveled paths between settlement nodes,
 * tracking travel frequency, value spreads, and route safety.
 */

import { getPrice } from './PriceRegistry.js'

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
    const route = routes.list?.find(r =>
        r.from === fromLocation && r.to === toLocation
    )

    if (!route) return

    // Decay safety score on incidents, recover slowly
    route.safetyScore = Math.max(0, route.safetyScore - incident * 0.2)
}

/**
 * Find the best route for a specific item type based on price differentials.
 * 
 * @param {Object} routes - Trade routes collection
 * @param {Object} priceRegistry - Price registry from PriceRegistry module
 * @param {string} itemType - Item type to find best route for
 * @returns {Object|null} Best route with profit potential
 */
export function findBestRoute(routes, priceRegistry, itemType) {
    if (!routes.list?.length) return null

    let bestRoute = null
    let bestSpread = 0

    for (const route of routes.list) {
        const fromPrice = getPrice(priceRegistry, itemType, route.from)
        const toPrice = getPrice(priceRegistry, itemType, route.to)

        if (!fromPrice || !toPrice) continue

        // Higher price at destination = better route for selling
        const spread = toPrice / fromPrice

        if (spread > bestSpread && route.safetyScore > 0.3) {
            bestSpread = spread
            bestRoute = { ...route, spread }
        }
    }

    return bestRoute
}

/**
 * Get all routes from a specific location.
 * 
 * @param {Object} routes - Trade routes collection
 * @param {string} location - Location identifier
 * @returns {Object[]} Array of routes originating from this location
 */
export function getRoutesFrom(routes, location) {
    return routes.list?.filter(r => r.from === location) ?? []
}

/**
 * Check if a route is active (traveled recently).
 * 
 * @param {Object} routes - Trade routes collection
 * @param {string} fromLocation - Origin location
 * @param {string} toLocation - Destination location
 * @param {number} currentTick - Current world tick
 * @param {number} inactiveThreshold - Ticks before route is considered inactive (default 500)
 * @returns {boolean} True if route has been traveled recently
 */
export function isRouteActive(routes, fromLocation, toLocation, currentTick, inactiveThreshold = 500) {
    const route = routes.list?.find(r =>
        r.from === fromLocation && r.to === toLocation
    )

    if (!route) return false
    return (currentTick - route.lastTrip) < inactiveThreshold
}
