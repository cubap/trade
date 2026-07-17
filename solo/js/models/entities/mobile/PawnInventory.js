/**
 * Pawn inventory systems: carried items, item management.
 * Works with Pawn.js array-based inventory: this.inventory = [{ id, name, type, weight, size, ... }]
 */

/**
 * Add an item to pawn's inventory (delegates to addItemToInventory for slot/weight checks).
 * @param {Pawn} pawn
 * @param {Object} item - Item object with id, name, type, weight, size, etc.
 * @returns {boolean} True if item was added
 */
export function addItem(pawn, item) {
    if (!item || !item.type) return false
    return pawn.addItemToInventory(item)
}

/**
 * Take an item from pawn's inventory by item ID.
 * @param {Pawn} pawn
 * @param {string} itemId - Item ID to remove
 * @returns {Object|null} The removed item or null
 */
export function takeItem(pawn, itemId) {
    if (!itemId) return null
    return pawn.removeItemFromInventory(itemId)
}

/**
 * Count items by type.
 * @param {Pawn} pawn
 * @param {string} itemType - Item type to count
 * @returns {number} Quantity of item type
 */
export function countItem(pawn, itemType) {
    if (!itemType) return 0
    return pawn.inventory.filter(item => item.type === itemType).length
}

/**
 * Check if pawn has an item type.
 * @param {Pawn} pawn
 * @param {string} itemType - Item type to check
 * @returns {boolean} True if pawn has item type
 */
export function hasItem(pawn, itemType) {
    if (!itemType) return false
    return pawn.inventory.some(item => item.type === itemType)
}

/**
 * Get all item types in inventory.
 * @param {Pawn} pawn
 * @returns {Array} Unique item types
 */
export function getItemTypes(pawn) {
    const types = new Set()
    for (const item of pawn.inventory) {
        if (item.type) types.add(item.type)
    }
    return Array.from(types)
}

/**
 * Get total items in inventory.
 * @param {Pawn} pawn
 * @returns {number} Total items
 */
export function getTotalItems(pawn) {
    return pawn.inventory.length
}

/**
 * Clear inventory.
 * @param {Pawn} pawn
 */
export function clearInventory(pawn) {
    pawn.inventory = []
    pawn.inventoryWeight = 0
}

/**
 * Transfer items from one pawn to another by type.
 * @param {Pawn} from - Source pawn
 * @param {Pawn} to - Destination pawn
 * @param {string} itemType - Item type to transfer
 * @param {number} quantity - Quantity to transfer
 * @returns {number} Actual quantity transferred
 */
export function transferItems(from, to, itemType, quantity = 1) {
    if (!itemType) return 0

    const items = from.inventory.filter(item => item.type === itemType)
    let transferred = 0

    for (const item of items) {
        if (transferred >= quantity) break

        const removed = from.removeItemFromInventory(item.id)
        if (removed && to.addItemToInventory(item)) {
            transferred++
        } else if (removed) {
            // Failed to add to destination, put it back
            from.addItemToInventory(item)
        }
    }

    return transferred
}
