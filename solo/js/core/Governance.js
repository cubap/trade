/**
 * Shared governance system for settlements.
 * 
 * Manages law tokens, governance models, and civic rules
 * that coordinate settlement activities.
 */

/**
 * Create a new law token for a settlement.
 * 
 * @param {Object} settlement - Settlement object with governance data
 * @param {string} lawType - Type of law: 'curfew', 'storage_share', 'tax_rate', 'trade_rule'
 * @param {Object} parameters - Law-specific parameters
 * @param {number} tick - Current world tick
 * @returns {Object} The created law token
 */
export function createLaw(settlement, lawType, parameters, tick) {
    if (!settlement.laws) settlement.laws = []

    const law = {
        id: `law_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: lawType,
        parameters,
        enactedAt: tick,
        enactedBy: parameters.enactedBy,
        support: 1.0 // Initial full support from enactor
    }

    settlement.laws.push(law)
    return law
}

/**
 * Check if a law is in effect (has sufficient support).
 * 
 * @param {Object} settlement - Settlement object
 * @param {string} lawId - Law ID to check
 * @param {number} supportThreshold - Minimum support to be in effect (default 0.5)
 * @returns {boolean} True if law is in effect
 */
export function isLawInEffect(settlement, lawId, supportThreshold = 0.5) {
    const law = settlement.laws?.find(l => l.id === lawId)
    if (!law) return false
    return law.support >= supportThreshold
}

/**
 * Get all active laws for a settlement.
 * 
 * @param {Object} settlement - Settlement object
 * @param {number} supportThreshold - Minimum support to be considered active (default 0.5)
 * @returns {Object[]} Array of active law tokens
 */
export function getActiveLaws(settlement, supportThreshold = 0.5) {
    return settlement.laws?.filter(l => l.support >= supportThreshold) ?? []
}

/**
 * Update support for a law based on member behavior.
 * 
 * @param {Object} settlement - Settlement object
 * @param {string} lawId - Law ID to update
 * @param {number} delta - Support change (-1 to 1)
 */
export function updateLawSupport(settlement, lawId, delta) {
    const law = settlement.laws?.find(l => l.id === lawId)
    if (!law) return

    law.support = Math.max(0, Math.min(1, law.support + delta))
}

/**
 * Revoke a law from a settlement.
 * 
 * @param {Object} settlement - Settlement object
 * @param {string} lawId - Law ID to revoke
 */
export function revokeLaw(settlement, lawId) {
    if (!settlement.laws) return

    const index = settlement.laws.findIndex(l => l.id === lawId)
    if (index >= 0) {
        settlement.laws.splice(index, 1)
    }
}

/**
 * Check if a settlement has a specific type of law.
 * 
 * @param {Object} settlement - Settlement object
 * @param {string} lawType - Law type to check for
 * @param {number} supportThreshold - Minimum support (default 0.5)
 * @returns {boolean} True if settlement has active law of this type
 */
export function hasLawType(settlement, lawType, supportThreshold = 0.5) {
    return settlement.laws?.some(l =>
        l.type === lawType && l.support >= supportThreshold
    ) ?? false
}

/**
 * Get the governance model for a settlement.
 * 
 * @param {Object} settlement - Settlement object
 * @returns {string} Governance model: 'informal', 'appointed', 'elective', 'weighted'
 */
export function getGovernanceModel(settlement) {
    return settlement.governanceModel ?? 'informal'
}

/**
 * Upgrade governance model based on settlement maturity.
 * 
 * @param {Object} settlement - Settlement object
 * @param {number} groupSize - Number of pawns in settlement
 * @param {number} planning - Coordinator's planning skill
 * @param {number} leadership - Coordinator's leadership skill
 * @returns {string} New governance model
 */
export function upgradeGovernance(settlement, groupSize, planning, leadership) {
    if (groupSize >= 15 && planning >= 5 && leadership >= 4) {
        settlement.governanceModel = 'weighted'
    } else if (groupSize >= 10 && planning >= 4 && leadership >= 3) {
        settlement.governanceModel = 'elective'
    } else if (groupSize >= 5 && planning >= 2 && leadership >= 2) {
        settlement.governanceModel = 'appointed'
    } else {
        settlement.governanceModel = 'informal'
    }

    return settlement.governanceModel
}

/**
 * Calculate civic score for a settlement based on infrastructure and governance.
 * 
 * @param {Object} settlement - Settlement object
 * @param {number} structureCount - Number of structures in settlement
 * @param {number} lawCount - Number of active laws
 * @param {number} groupSize - Number of pawns in settlement
 * @returns {number} Civic score (0-100)
 */
export function calculateCivicScore(settlement, structureCount, lawCount, groupSize) {
    const baseScore = Math.min(40, structureCount * 10)
    const governanceBonus = Math.min(30, lawCount * 5)
    const populationBonus = Math.min(30, groupSize * 2)

    return baseScore + governanceBonus + populationBonus
}
