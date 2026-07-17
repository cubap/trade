/**
 * Pawn invention systems: pondering, discovery, innovation.
 * 
 * Delegates to Pawn.js's existing invention system:
 * - `ponderProblem()` — add a problem to the pondering queue
 * - `processPonderingQueue()` — attempt to discover solutions
 * - `discoveredSolutions` — Set of discovered solution IDs
 * 
 * This module provides a consistent API surface for invention-related
 * operations while reusing the proven implementation in Pawn.js.
 */

/**
 * Add a problem for the pawn to ponder.
 * Maps to Pawn.ponderProblem() which adds to the pondering queue.
 * 
 * @param {Pawn} pawn - The pawn pondering
 * @param {string} problemType - Problem type: 'need_better_tools', 'need_shelter', 'inventory_full', etc.
 * @param {Object} context - Additional context for solution generation
 */
export function ponderInvention(pawn, problemType, context = {}) {
    pawn.ponderProblem(problemType, context)
}

/**
 * Process the pawn's pondering queue — attempt to discover a solution.
 * Maps to Pawn.processPonderingQueue() which handles cooldowns, bonuses, and discovery.
 * 
 * @param {Pawn} pawn - The pawn processing pondering
 * @returns {Object|null} Discovered solution object, or null if no discovery yet
 */
export function progressInvention(pawn) {
    return pawn.processPonderingQueue()
}

/**
 * Get all solutions the pawn has discovered.
 * 
 * @param {Pawn} pawn - The pawn to inspect
 * @returns {Set} Set of discovered solution IDs
 */
export function getDiscoveredInventions(pawn) {
    return pawn.discoveredSolutions
}

/**
 * Get all problems the pawn is actively pondering.
 * 
 * @param {Pawn} pawn - The pawn to inspect
 * @returns {Object[]} Array of active problem objects from the pondering queue
 */
export function getActiveInventions(pawn) {
    return pawn.ponderingQueue
}

/**
 * Check if a pawn has discovered a specific solution.
 * 
 * @param {Pawn} pawn - The pawn to inspect
 * @param {string} solutionId - Solution ID to check
 * @returns {boolean} True if pawn has discovered this solution
 */
export function hasDiscovered(pawn, solutionId) {
    return pawn.discoveredSolutions.has(solutionId)
}

/**
 * Apply bonuses from discovered inventions to pawn's capabilities.
 * Currently a placeholder for future invention effects (skill bonuses,
 * crafting unlocks, etc.).
 * 
 * @param {Pawn} pawn - The pawn to apply bonuses to
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
