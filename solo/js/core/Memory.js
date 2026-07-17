/**
 * Shared memory system for entities that track landmarks, resources, or locations.
 * Used by Pawn (landmarks, resource memory), Structure (builder memory), and other entities.
 */

class Memory {
    /**
     * @param {Object} options
     * @param {number} options.maxEntries - Maximum number of memory entries
     * @param {number} options.decayRate - Rate at which memories decay per tick
     * @param {number} options.decayFloor - Minimum memory strength retained
     */
    constructor(options = {}) {
        this.entries = []
        this.maxEntries = options.maxEntries ?? 20
        this.decayRate = options.decayRate ?? 0.001
        this.decayFloor = options.decayFloor ?? 0.1
    }

    /**
     * Add a memory entry.
     * @param {Object} entry - Memory with type, location, significance, timestamp
     * @returns {boolean} True if memory was added
     */
    addEntry(entry) {
        if (!entry) return false
        if (this.entries.length >= this.maxEntries) {
            // Remove oldest least significant entry
            this.entries.sort((a, b) => (a.significance ?? 0) - (b.significance ?? 0))
            this.entries.shift()
        }

        entry.timestamp = entry.timestamp ?? Date.now()
        entry.strength = entry.strength ?? 1
        this.entries.push(entry)
        return true
    }

    /**
     * Find memories by type.
     * @param {string} type - Memory type to search for
     * @returns {Array} Matching memory entries
     */
    findByType(type) {
        return this.entries.filter(entry => entry.type === type)
    }

    /**
     * Find memories within a radius of a location.
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} radius - Search radius
     * @returns {Array} Matching memory entries
     */
    findByLocation(x, y, radius) {
        return this.entries.filter(entry => {
            if (!entry.location) return false
            const dx = entry.location.x - x
            const dy = entry.location.y - y
            return Math.sqrt(dx * dx + dy * dy) <= radius
        })
    }

    /**
     * Find memories above a significance threshold.
     * @param {number} minSignificance - Minimum significance value
     * @returns {Array} Matching memory entries
     */
    findBySignificance(minSignificance) {
        return this.entries.filter(entry => (entry.significance ?? 0) >= minSignificance)
    }

    /**
     * Decay all memory strengths over time.
     * @param {number} ticks - Number of ticks to decay
     */
    decay(ticks = 1) {
        for (const entry of this.entries) {
            entry.strength = Math.max(this.decayFloor, (entry.strength ?? 1) - this.decayRate * ticks)
        }
    }

    /**
     * Remove memories below a strength threshold.
     * @param {number} minStrength - Minimum strength to retain
     */
    prune(minStrength = 0) {
        this.entries = this.entries.filter(entry => (entry.strength ?? 0) >= minStrength)
    }

    /**
     * Get total number of memories.
     * @returns {number} Memory count
     */
    size() {
        return this.entries.length
    }

    /**
     * Clear all memories.
     */
    clear() {
        this.entries = []
    }
}

export default Memory
