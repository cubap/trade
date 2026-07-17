/**
 * Shared price tracking across entities and locations.
 * 
 * Maintains rolling averages of trade ratios observed across the world,
 * enabling price discovery and arbitrage detection. Each price entry
 * tracks the item type, location, observed ratios, and recency.
 */

/**
 * Record a trade observation at a location.
 * 
 * @param {Object} registry - Price registry object (attached to world or shared scope)
 * @param {string} itemType - Type of item traded (e.g., 'food', 'stone')
 * @param {string} location - Location identifier (e.g., landmark name, settlement ID)
 * @param {number} ratio - Trade ratio observed (items given / items received)
 * @param {number} tick - Current world tick for recency tracking
 */
export function recordTrade(registry, itemType, location, ratio, tick) {
    if (!registry.prices) registry.prices = {}
    if (!registry.prices[itemType]) registry.prices[itemType] = {}
    if (!registry.prices[itemType][location]) {
        registry.prices[itemType][location] = {
            observations: [],
            average: ratio,
            lastObserved: tick
        }
    }

    const entry = registry.prices[itemType][location]
    entry.observations.push({ ratio, tick })
    entry.lastObserved = tick

    // Rolling average (weighted toward recent)
    const weights = entry.observations.map((_, i) => i + 1)
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    entry.average = entry.observations.reduce((sum, obs, i) =>
        sum + obs.ratio * weights[i], 0
    ) / totalWeight
}

/**
 * Get the current average price for an item at a location.
 * 
 * @param {Object} registry - Price registry object
 * @param {string} itemType - Type of item to look up
 * @param {string} location - Location identifier
 * @returns {number|null} Average trade ratio, or null if no data
 */
export function getPrice(registry, itemType, location) {
    return registry.prices?.[itemType]?.[location]?.average ?? null
}

/**
 * Get all known locations where an item has been traded.
 * 
 * @param {Object} registry - Price registry object
 * @param {string} itemType - Type of item to look up
 * @returns {Object} Map of location → price data
 */
export function getKnownPrices(registry, itemType) {
    return registry.prices?.[itemType] ?? {}
}

/**
 * Detect arbitrage opportunity: item valued differently across locations.
 * 
 * @param {Object} registry - Price registry object
 * @param {string} itemType - Type of item to check
 * @param {number} threshold - Minimum ratio differential to consider arbitrage (default 1.5)
 * @returns {Object|null} Arbitrage opportunity with buy/sell locations and spread
 */
export function detectArbitrage(registry, itemType, threshold = 1.5) {
    const prices = getKnownPrices(registry, itemType)
    const locations = Object.entries(prices)

    if (locations.length < 2) return null

    let bestOpportunity = null

    for (const [locA, dataA] of locations) {
        for (const [locB, dataB] of locations) {
            if (locA === locB) continue

            const spread = dataA.average / dataB.average

            if (spread > threshold && (!bestOpportunity || spread > bestOpportunity.spread)) {
                bestOpportunity = {
                    buyAt: locB,
                    sellAt: locA,
                    buyPrice: dataB.average,
                    sellPrice: dataA.average,
                    spread
                }
            }
        }
    }

    return bestOpportunity
}

/**
 * Check if price data for an item at a location is stale.
 * 
 * @param {Object} registry - Price registry object
 * @param {string} itemType - Type of item to check
 * @param {string} location - Location identifier
 * @param {number} currentTick - Current world tick
 * @param {number} staleThreshold - Ticks before data is considered stale (default 500)
 * @returns {boolean} True if price data is stale or missing
 */
export function isPriceStale(registry, itemType, location, currentTick, staleThreshold = 500) {
    const data = registry.prices?.[itemType]?.[location]
    if (!data) return true
    return (currentTick - data.lastObserved) > staleThreshold
}

/**
 * Clear old price observations beyond a tick threshold.
 * 
 * @param {Object} registry - Price registry object
 * @param {number} currentTick - Current world tick
 * @param {number} maxAge - Maximum age in ticks for observations (default 1000)
 */
export function pruneOldPrices(registry, currentTick, maxAge = 1000) {
    if (!registry.prices) return

    for (const itemType in registry.prices) {
        for (const location in registry.prices[itemType]) {
            const entry = registry.prices[itemType][location]
            entry.observations = entry.observations.filter(
                obs => (currentTick - obs.tick) <= maxAge
            )

            // Recalculate average after pruning
            if (entry.observations.length > 0) {
                const weights = entry.observations.map((_, i) => i + 1)
                const totalWeight = weights.reduce((a, b) => a + b, 0)
                entry.average = entry.observations.reduce((sum, obs, i) =>
                    sum + obs.ratio * weights[i], 0
                ) / totalWeight
            }
        }
    }
}
