/**
 * Shared memory system for entities that track landmarks, resources, or locations.
 * Used by Pawn (landmarks, resource memory), Structure (builder memory), and other entities.
 */

/**
 * Add a memory entry.
 * @param {Object} entity - Entity with memoryMap array and maxMemory property
 * @param {Object} entry - Memory with type, location, significance, timestamp
 * @returns {boolean} True if memory was added
 */
export function addEntry(entity, entry) {
    if (!entry) return false
    
    if (entity.memoryMap.length >= entity.maxMemory) {
        // Remove oldest least significant entry
        entity.memoryMap.sort((a, b) => (a.significance ?? 0) - (b.significance ?? 0))
        entity.memoryMap.shift()
    }

    entry.timestamp = entry.timestamp ?? Date.now()
    entry.strength = entry.strength ?? 1
    entity.memoryMap.push(entry)
    return true
}

/**
 * Find memories by type.
 * @param {Object} entity - Entity with memoryMap array
 * @param {string} type - Memory type to search for
 * @returns {Array} Matching memory entries
 */
export function findByType(entity, type) {
    return entity.memoryMap.filter(entry => entry.type === type)
}

/**
 * Find memories within a radius of a location.
 * @param {Object} entity - Entity with memoryMap array
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Search radius
 * @returns {Array} Matching memory entries
 */
export function findByLocation(entity, x, y, radius) {
    return entity.memoryMap.filter(entry => {
        if (!entry.location) return false
        const dx = entry.location.x - x
        const dy = entry.location.y - y
        return Math.sqrt(dx * dx + dy * dy) <= radius
    })
}

/**
 * Find memories above a significance threshold.
 * @param {Object} entity - Entity with memoryMap array
 * @param {number} minSignificance - Minimum significance value
 * @returns {Array} Matching memory entries
 */
export function findBySignificance(entity, minSignificance) {
    return entity.memoryMap.filter(entry => (entry.significance ?? 0) >= minSignificance)
}

/**
 * Decay all memory strengths over time.
 * @param {Object} entity - Entity with memoryMap array
 * @param {number} ticks - Number of ticks to decay
 * @param {number} decayRate - Rate at which memories decay per tick
 * @param {number} decayFloor - Minimum memory strength retained
 */
export function decay(entity, ticks = 1, decayRate = 0.001, decayFloor = 0.1) {
    for (const entry of entity.memoryMap) {
        entry.strength = Math.max(decayFloor, (entry.strength ?? 1) - decayRate * ticks)
    }
}

/**
 * Prune memories below a significance threshold.
 * @param {Object} entity - Entity with memoryMap array
 * @param {number} minSignificance - Minimum significance to retain
 */
export function prune(entity, minSignificance = 0.1) {
    entity.memoryMap = entity.memoryMap.filter(entry => (entry.significance ?? 0) >= minSignificance)
}

/**
 * Get the number of memory entries.
 * @param {Object} entity - Entity with memoryMap array
 * @returns {number} Number of memory entries
 */
export function size(entity) {
    return entity.memoryMap.length
}

/**
 * Clear all memory entries.
 * @param {Object} entity - Entity with memoryMap array
 */
export function clear(entity) {
    entity.memoryMap = []
}
