/**
 * Shared degradation system for entities that deteriorate over time.
 * Used by Structure (condition decay), Item (durability loss), and other entities.
 */

class Degradation {
    /**
     * @param {Object} options
     * @param {number} options.initialValue - Starting value (e.g., condition, durability)
     * @param {number} options.maxValue - Maximum possible value
     * @param {number} options.decayRate - Rate of decay per tick
     * @param {number} options.decayPeriod - Ticks between decay checks
     * @param {boolean} options.removeWhenZero - Whether to remove entity when value hits 0
     */
    constructor(options = {}) {
        this.value = options.initialValue ?? 100
        this.maxValue = options.maxValue ?? 100
        this.decayRate = options.decayRate ?? 0.01
        this.decayPeriod = options.decayPeriod ?? 100
        this.removeWhenZero = options.removeWhenZero ?? false
        this.lastDecayTick = 0
    }

    /**
     * Update degradation over time.
     * @param {number} tick - Current game tick
     * @returns {boolean} False if entity should be removed
     */
    update(tick) {
        if (tick - this.lastDecayTick >= this.decayPeriod) {
            this.value -= this.decayRate
            this.lastDecayTick = tick

            if (this.value <= 0) {
                this.value = 0
                if (this.removeWhenZero) return false
            }
        }

        return true
    }

    /**
     * Repair or restore value.
     * @param {number} amount - Amount to restore
     */
    repair(amount) {
        this.value = Math.min(this.maxValue, this.value + amount)
    }

    /**
     * Get current value as a percentage of max.
     * @returns {number} Value as percentage (0-100)
     */
    getPercentage() {
        return (this.value / this.maxValue) * 100
    }

    /**
     * Check if entity is in good condition.
     * @param {number} threshold - Threshold for "good" condition (default 50%)
     * @returns {boolean} True if above threshold
     */
    isGood(threshold = 50) {
        return this.getPercentage() >= threshold
    }

    /**
     * Check if entity is critically degraded.
     * @param {number} threshold - Threshold for "critical" condition (default 20%)
     * @returns {boolean} True if below threshold
     */
    isCritical(threshold = 20) {
        return this.getPercentage() < threshold
    }
}

export default Degradation
