/**
 * Shared price tracking across entities and locations.
 * 
 * Maintains rolling averages of trade ratios observed across the world,
 * enabling price discovery and arbitrage detection. Each price entry
 * tracks the item type, location, observed ratios, and recency.
 */

/**
 * Oldest observation a market keeps, in ticks. Past this the trade is history
 * rather than a price, and the quote stops claiming it (#114).
 */
export const PRICE_MAX_AGE = 1000

/**
 * How often the world sweeps the price table, in ticks.
 *
 * Half of PRICE_MAX_AGE, so a dead quote is never left standing for longer
 * than its own lifetime.
 */
export const PRICE_PRUNE_INTERVAL = 500

/**
 * Triangular-weighted average of a market's observations: the newest trade is
 * counted newest-last and heaviest, so the number tracks what things have been
 * going for rather than the whole recorded past.
 * @param {Array<{ratio: number, tick: number}>} observations
 * @returns {number|null} null for a market with nothing left to say
 */
function weightedAverage(observations) {
    if (!observations.length) return null

    const totalWeight = observations.length * (observations.length + 1) / 2
    return observations.reduce((sum, obs, i) => sum + obs.ratio * (i + 1), 0) / totalWeight
}

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
    entry.average = weightedAverage(entry.observations)
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
 * A market whose every observation has aged out is *deleted* rather than left
 * holding its last average. Before this, the recompute sat inside
 * `if (observations.length > 0)` with no else, so an emptied entry went on
 * quoting a price while isPriceStale() said the same data was dead - the two
 * readers of one table disagreed, and the ghost price was the one
 * detectArbitrage() and findBestRoute() would have shopped by (#114).
 *
 * @param {Object} registry - Price registry object
 * @param {number} currentTick - Current world tick
 * @param {number} [maxAge] - Maximum age in ticks for observations
 * @returns {number} How many market entries were forgotten
 */
export function pruneOldPrices(registry, currentTick, maxAge = PRICE_MAX_AGE) {
    if (!registry.prices) return 0

    let forgotten = 0

    for (const itemType of Object.keys(registry.prices)) {
        const byLocation = registry.prices[itemType]

        for (const location of Object.keys(byLocation)) {
            const entry = byLocation[location]
            entry.observations = entry.observations.filter(
                obs => (currentTick - obs.tick) <= maxAge
            )

            if (entry.observations.length === 0) {
                delete byLocation[location]
                forgotten++
                continue
            }

            entry.average = weightedAverage(entry.observations)
        }

        // An item nobody has traded anywhere recently is not a known item.
        if (Object.keys(byLocation).length === 0) delete registry.prices[itemType]
    }

    return forgotten
}
