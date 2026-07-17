/**
 * Shared inventory management for entities that carry or store items.
 * Used by Pawn (carried items), ResourceCache (stored items), and other entities.
 */

class Inventory {
    /**
     * @param {Object} options
     * @param {number} options.capacity - Maximum number of items
     * @param {number} options.maxWeight - Maximum total weight
     * @param {number} options.maxSize - Maximum total volume
     */
    constructor(options = {}) {
        this.items = []
        this.capacity = options.capacity ?? 10
        this.maxWeight = options.maxWeight ?? 50
        this.maxSize = options.maxSize ?? 100
        this.currentWeight = 0
        this.currentSize = 0
    }

    /**
     * Add an item to inventory.
     * @param {Object} item - Item with type, weight, size properties
     * @returns {boolean} True if item was added
     */
    addItem(item) {
        if (!item) return false
        if (this.items.length >= this.capacity) return false

        const weight = item.weight ?? 1
        const size = item.size ?? 1

        if (this.currentWeight + weight > this.maxWeight) return false
        if (this.currentSize + size > this.maxSize) return false

        this.items.push(item)
        this.currentWeight += weight
        this.currentSize += size
        return true
    }

    /**
     * Add multiple items to inventory.
     * @param {Array} items - Array of item objects
     * @returns {number} Number of items added
     */
    addItems(items) {
        if (!Array.isArray(items)) return 0
        let added = 0
        for (const item of items) {
            if (this.addItem(item)) added++
            else break
        }
        return added
    }

    /**
     * Remove items of a specific type from inventory.
     * @param {string} type - Item type to remove
     * @param {number} count - Number of items to remove
     * @returns {Array} Removed items
     */
    takeItems(type, count = 1) {
        if (!type || count <= 0) return []
        const taken = []

        for (let i = this.items.length - 1; i >= 0 && taken.length < count; i--) {
            const item = this.items[i]
            if (item?.type !== type) continue

            taken.push(item)
            this.currentWeight -= item.weight ?? 1
            this.currentSize -= item.size ?? 1
            this.items.splice(i, 1)
        }

        return taken
    }

    /**
     * Count items of a specific type.
     * @param {string} type - Item type to count
     * @returns {number} Number of items of this type
     */
    countByType(type) {
        return this.items.filter(item => item?.type === type).length
    }

    /**
     * Get total number of items.
     * @returns {number} Total item count
     */
    totalItems() {
        return this.items.length
    }

    /**
     * Check if inventory has space for an item.
     * @param {Object} item - Item to check
     * @returns {boolean} True if space is available
     */
    hasSpace(item = {}) {
        if (this.items.length >= this.capacity) return false
        if (this.currentWeight + (item.weight ?? 1) > this.maxWeight) return false
        if (this.currentSize + (item.size ?? 1) > this.maxSize) return false
        return true
    }

    /**
     * Get all unique item types in inventory.
     * @returns {Set} Set of item type strings
     */
    getItemTypes() {
        return new Set(this.items.map(item => item.type).filter(Boolean))
    }

    /**
     * Clear all items from inventory.
     */
    clear() {
        this.items = []
        this.currentWeight = 0
        this.currentSize = 0
    }
}

export default Inventory
