/**
 * Shared degradation system for entities that deteriorate over time.
 * Used by Structure (condition decay), Item (durability loss), and other entities.
 */

/**
 * Update degradation over time.
 * @param {Object} entity - Entity with condition and deteriorationRate properties
 * @param {number} tick - Current game tick
 * @returns {boolean} False if entity should be removed
 */
export function update(entity, tick) {
    entity.condition -= entity.deteriorationRate

    if (entity.condition <= 0) {
        entity.condition = 0
        return false
    }

    return true
}

/**
 * Repair or restore condition.
 * @param {Object} entity - Entity with condition property
 * @param {number} amount - Amount to restore
 * @param {number} maxCondition - Maximum possible condition
 */
export function repair(entity, amount, maxCondition = 100) {
    entity.condition = Math.min(maxCondition, entity.condition + amount)
}

/**
 * Get current condition as a percentage of max.
 * @param {Object} entity - Entity with condition property
 * @param {number} maxCondition - Maximum possible condition
 * @returns {number} Condition as percentage (0-100)
 */
export function getPercentage(entity, maxCondition = 100) {
    return (entity.condition / maxCondition) * 100
}

/**
 * Check if entity is in good condition.
 * @param {Object} entity - Entity with condition property
 * @param {number} threshold - Threshold for "good" condition (default 50%)
 * @param {number} maxCondition - Maximum possible condition
 * @returns {boolean} True if above threshold
 */
export function isGood(entity, threshold = 50, maxCondition = 100) {
    return getPercentage(entity, maxCondition) >= threshold
}

/**
 * Check if entity is critically degraded.
 * @param {Object} entity - Entity with condition property
 * @param {number} threshold - Threshold for "critical" condition (default 20%)
 * @param {number} maxCondition - Maximum possible condition
 * @returns {boolean} True if below threshold
 */
export function isCritical(entity, threshold = 20, maxCondition = 100) {
    return getPercentage(entity, maxCondition) < threshold
}
