/**
 * Shared inventory management for entities that carry or store items.
 * Used by Pawn (carried items), ResourceCache (stored items), and other entities.
 */

/**
 * Add an item to inventory.
 * @param {Object} entity - Entity with items array
 * @param {Object} item - Item to add
 * @returns {boolean} True if item was added
 */
export function addItem(entity, item) {
    if (!item) return false
    entity.items.push(item)
    return true
}

/**
 * Add multiple items to inventory.
 * @param {Object} entity - Entity with items array
 * @param {Array} items - Array of item objects
 * @returns {number} Number of items added
 */
export function addItems(entity, items) {
    if (!Array.isArray(items)) return 0
    let added = 0
    for (const item of items) {
        if (addItem(entity, item)) added++
        else break
    }
    return added
}

/**
 * Remove items of a specific type from inventory.
 * @param {Object} entity - Entity with items array
 * @param {string} type - Item type to remove
 * @param {number} count - Number of items to remove
 * @returns {Array} Removed items
 */
export function takeItems(entity, type, count = 1) {
    if (!type || count <= 0) return []
    const taken = []

    for (let i = entity.items.length - 1; i >= 0 && taken.length < count; i--) {
        const item = entity.items[i]
        if (item?.type !== type) continue

        taken.push(item)
        entity.items.splice(i, 1)
    }

    return taken
}

/**
 * Count items of a specific type in inventory.
 * @param {Object} entity - Entity with items array
 * @param {string} type - Item type to count
 * @returns {number} Number of items of that type
 */
export function countByType(entity, type) {
    return entity.items.filter(item => item?.type === type).length
}

/**
 * Get total number of items in inventory.
 * @param {Object} entity - Entity with items array
 * @returns {number} Total number of items
 */
export function totalItems(entity) {
    return entity.items.length
}

/**
 * Check if inventory has space for more items.
 * @param {Object} entity - Entity with items array and capacity
 * @param {number} capacity - Maximum capacity (default from entity.capacity)
 * @returns {boolean} True if there is space
 */
export function hasSpace(entity, capacity = null) {
    const max = capacity ?? entity.capacity ?? Infinity
    return entity.items.length < max
}

/**
 * Get all unique item types in inventory.
 * @param {Object} entity - Entity with items array
 * @returns {Array} Array of unique item types
 */
export function getItemTypes(entity) {
    return [...new Set(entity.items.map(item => item?.type).filter(Boolean))]
}

/**
 * Clear all items from inventory.
 * @param {Object} entity - Entity with items array
 */
export function clear(entity) {
    entity.items = []
}
