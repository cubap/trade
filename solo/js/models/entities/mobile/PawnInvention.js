/**
 * Pawn invention systems: pondering, discovery, innovation.
 */

/**
 * Ponder a new invention or improvement.
 * @param {Pawn} pawn
 * @param {string} category - Invention category: 'tools', 'structures', 'skills', 'civic'
 * @param {string} name - Invention name
 * @param {number} difficulty - Difficulty level (1-10)
 * @returns {Object} Invention object
 */
export function ponderInvention(pawn, category, name, difficulty) {
    const inventionId = `invention_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const invention = {
        inventionId,
        category,
        name,
        difficulty,
        progress: 0,
        discovered: false,
        ponderedAt: pawn.world?.clock?.currentTick ?? 0
    }

    pawn.inventions.push(invention)
    return invention
}

/**
 * Make progress on an invention.
 * @param {Pawn} pawn
 * @param {string} inventionId - Invention to progress
 * @param {number} progress - Progress amount
 */
export function progressInvention(pawn, inventionId, progress = 1) {
    const invention = pawn.inventions.find(inv => inv.inventionId === inventionId)
    if (!invention) return

    invention.progress += progress

    // Check if invention is complete
    if (invention.progress >= invention.difficulty * 10) {
        invention.discovered = true
        pawn.addThought(`Discovered invention: ${invention.name}!`, 'invention')
    }
}

/**
 * Get discovered inventions.
 * @param {Pawn} pawn
 * @returns {Array} Discovered inventions
 */
export function getDiscoveredInventions(pawn) {
    return pawn.inventions.filter(inv => inv.discovered)
}

/**
 * Get active inventions (not yet discovered).
 * @param {Pawn} pawn
 * @returns {Array} Active inventions
 */
export function getActiveInventions(pawn) {
    return pawn.inventions.filter(inv => !inv.discovered)
}

/**
 * Check if pawn has discovered an invention.
 * @param {Pawn} pawn
 * @param {string} inventionName - Invention name to check
 * @returns {boolean} True if discovered
 */
export function hasDiscovered(pawn, inventionName) {
    return pawn.inventions.some(inv =>
        inv.name === inventionName && inv.discovered
    )
}

/**
 * Apply invention discovery bonuses.
 * @param {Pawn} pawn
 */
export function applyInventionBonuses(pawn) {
    const discovered = getDiscoveredInventions(pawn)

    for (const invention of discovered) {
        switch (invention.category) {
            case 'tools':
                // Tool inventions improve gathering efficiency
                pawn.gatheringBonus = (pawn.gatheringBonus ?? 0) + invention.difficulty * 0.1
                break
            case 'structures':
                // Structure inventions improve building speed
                pawn.buildingBonus = (pawn.buildingBonus ?? 0) + invention.difficulty * 0.1
                break
            case 'skills':
                // Skill inventions improve learning rate
                pawn.learningBonus = (pawn.learningBonus ?? 0) + invention.difficulty * 0.05
                break
            case 'civic':
                // Civic inventions improve trust gain
                pawn.trustBonus = (pawn.trustBonus ?? 0) + invention.difficulty * 0.05
                break
        }
    }
}
