/**
 * Pawn invention systems: pondering, discovery, innovation.
 * 
 * Manages pawn's ability to discover new inventions, tools, and improvements
 * through contemplation and experimentation. Each invention has a difficulty
 * threshold that must be reached through accumulated progress.
 * 
 * NOTE: Pawn.js uses `ponderProblem()` for inline constraint-triggered pondering.
 * This module provides a separate invention tracking system for long-term discoveries.
 * The two systems coexist — ponderProblem handles immediate constraints,
 * while this module tracks structured invention progress.
 */

/**
 * Create a new invention to ponder.
 * 
 * @param {Pawn} pawn - The pawn creating the invention
 * @param {string} category - Invention category: 'tools', 'structures', 'skills', 'civic'
 * @param {string} name - Invention name (e.g., 'Better Axe', 'Stone Wall')
 * @param {number} difficulty - Difficulty level 1-10, determines progress threshold
 * @returns {Object} The created invention object with inventionId
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
 * Advance progress on an existing invention.
 * When progress reaches difficulty * 10, the invention is discovered.
 * 
 * @param {Pawn} pawn - The pawn making progress
 * @param {string} inventionId - ID of the invention to progress
 * @param {number} progress - Progress amount to add (default 1)
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
 * Get all inventions the pawn has discovered.
 * 
 * @param {Pawn} pawn - The pawn to inspect
 * @returns {Object[]} Array of discovered invention objects
 */
export function getDiscoveredInventions(pawn) {
    return pawn.inventions.filter(inv => inv.discovered)
}

/**
 * Get all inventions the pawn is actively working on (not yet discovered).
 * 
 * @param {Pawn} pawn - The pawn to inspect
 * @returns {Object[]} Array of active invention objects
 */
export function getActiveInventions(pawn) {
    return pawn.inventions.filter(inv => !inv.discovered)
}

/**
 * Check if a pawn has discovered a specific invention by name.
 * 
 * @param {Pawn} pawn - The pawn to inspect
 * @param {string} inventionName - Name of the invention to check
 * @returns {boolean} True if pawn has discovered this invention
 */
export function hasDiscovered(pawn, inventionName) {
    return pawn.inventions.some(inv =>
        inv.name === inventionName && inv.discovered
    )
}

/**
 * Apply bonuses from discovered inventions to pawn's capabilities.
 * Currently a placeholder for future invention effects (skill bonuses,
 * crafting unlocks, etc.).
 * 
 * @param {Pawn} pawn - The pawn to apply bonuses to
 */
export function applyInventionBonuses(pawn) {
    // Placeholder for future invention effects
    // e.g., discovered tools unlock new crafting recipes
}
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
