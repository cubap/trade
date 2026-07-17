/**
 * Pawn memory systems: landmarks, resource memory, memory management.
 */

/**
 * Remember a landmark.
 * @param {Pawn} pawn
 * @param {Object} landmark - {x, y, type, significance, name, event}
 */
export function rememberLandmark(pawn, landmark) {
    if (!landmark?.x || !landmark?.y) return

    // Check if we already remember this landmark (within 5 units)
    const existingIndex = pawn.memoryMap.findIndex(m =>
        Math.hypot(m.x - landmark.x, m.y - landmark.y) < 5
    )

    if (existingIndex >= 0) {
        // Update existing landmark with new info
        pawn.memoryMap[existingIndex] = {
            ...pawn.memoryMap[existingIndex],
            ...landmark,
            updatedAt: pawn.world?.clock?.currentTick ?? 0
        }
    } else {
        // Add new landmark
        if (pawn.memoryMap.length >= pawn.maxMemory) {
            // Remove oldest least significant entry
            pawn.memoryMap.sort((a, b) => (a.significance ?? 0) - (b.significance ?? 0))
            pawn.memoryMap.shift()
        }

        pawn.memoryMap.push({
            ...landmark,
            rememberedAt: pawn.world?.clock?.currentTick ?? 0
        })
    }
}

/**
 * Find landmarks by type.
 * @param {Pawn} pawn
 * @param {string} type - Landmark type to find
 * @returns {Array} Matching landmarks
 */
export function findLandmarksByType(pawn, type) {
    return pawn.memoryMap.filter(m => m.type === type)
}

/**
 * Find landmarks by location (within radius).
 * @param {Pawn} pawn
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Search radius
 * @returns {Array} Matching landmarks
 */
export function findLandmarksByLocation(pawn, x, y, radius) {
    return pawn.memoryMap.filter(m =>
        Math.hypot(m.x - x, m.y - y) <= radius
    )
}

/**
 * Find landmarks by minimum significance.
 * @param {Pawn} pawn
 * @param {number} minSignificance - Minimum significance threshold
 * @returns {Array} Matching landmarks
 */
export function findLandmarksBySignificance(pawn, minSignificance) {
    return pawn.memoryMap.filter(m => m.significance >= minSignificance)
}

/**
 * Get home landmark (most significant shelter landmark).
 * @param {Pawn} pawn
 * @returns {Object|null} Home landmark or null
 */
export function getHomeLandmark(pawn) {
    const shelters = findLandmarksByType(pawn, 'shelter')
    if (!shelters.length) return null

    // Return most significant shelter
    return shelters.reduce((best, current) =>
        (current.significance ?? 0) > (best.significance ?? 0) ? current : best
    )
}

/**
 * Decay memory significance over time.
 * @param {Pawn} pawn
 * @param {number} tick - Current game tick
 */
export function decayMemory(pawn, tick) {
    const decayPeriod = 1000 // Ticks before memory starts decaying
    const decayRate = 0.0005 // Per tick after decay period

    for (const memory of pawn.memoryMap) {
        const age = tick - (memory.rememberedAt ?? memory.tick ?? 0)
        if (age > decayPeriod) {
            memory.significance = Math.max(0, memory.significance - decayRate * (age - decayPeriod))
        }
    }

    // Remove insignificant memories
    pawn.memoryMap = pawn.memoryMap.filter(m => m.significance > 0.05)
}

/**
 * Prune memory to keep only most significant entries.
 * @param {Pawn} pawn
 * @param {number} keepCount - Number of most significant entries to keep
 */
export function pruneMemory(pawn, keepCount) {
    if (pawn.memoryMap.length <= keepCount) return

    pawn.memoryMap.sort((a, b) => (b.significance ?? 0) - (a.significance ?? 0))
    pawn.memoryMap.length = keepCount
}

/**
 * Get memory size.
 * @param {Pawn} pawn
 * @returns {number} Number of memory entries
 */
export function getMemorySize(pawn) {
    return pawn.memoryMap.length
}

/**
 * Clear all memory.
 * @param {Pawn} pawn
 */
export function clearMemory(pawn) {
    pawn.memoryMap = []
}
