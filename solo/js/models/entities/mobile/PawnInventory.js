/**
 * Pawn inventory systems: carried items, item management.
 * 
 * Works with Pawn.js array-based inventory model:
 *   this.inventory = [{ id, name, type, weight, size, slotType, durability, ... }]
 *   this.inventorySlots = 2  // Hands-only capacity
 *   this.inventoryWeight = 0 // Current total weight
 *   this.maxWeight = 50      // Weight limit
 *   this.maxSize = 100       // Volume limit
 * 
 * Delegates to Pawn.js methods (addItemToInventory, removeItemFromInventory)
 * to preserve slot/weight/size constraints and side effects (pondering, material tracking).
 */

/**
 * Add an item to pawn's inventory.
 * Delegates to pawn.addItemToInventory() which enforces slot/weight/size limits
 * and triggers pondering when constraints are hit.
 * 
 * @param {Pawn} pawn - The pawn whose inventory to modify
 * @param {Object} item - Item object with id, name, type, weight, size, etc.
 * @returns {boolean} True if item was added successfully
 */
export function addItem(pawn, item) {
    if (!item || !item.type) return false
    return pawn.addItemToInventory(item)
}

/**
 * Remove an item from pawn's inventory by item ID.
 * Delegates to pawn.removeItemFromInventory() which updates inventoryWeight.
 * 
 * @param {Pawn} pawn - The pawn whose inventory to modify
 * @param {string} itemId - Item ID to remove
 * @returns {Object|null} The removed item object, or null if not found
 */
export function takeItem(pawn, itemId) {
    if (!itemId) return null
    return pawn.removeItemFromInventory(itemId)
}

/**
 * Count items of a specific type in pawn's inventory.
 * 
 * @param {Pawn} pawn - The pawn whose inventory to inspect
 * @param {string} itemType - Item type to count (e.g., 'food', 'water', 'tool')
 * @returns {number} Number of items matching the type
 */
export function countItem(pawn, itemType) {
    if (!itemType) return 0
    return pawn.inventory.filter(item => item.type === itemType).length
}

/**
 * Check if pawn has any items of a specific type.
 * 
 * @param {Pawn} pawn - The pawn whose inventory to inspect
 * @param {string} itemType - Item type to check for
 * @returns {boolean} True if pawn has at least one item of the type
 */
export function hasItem(pawn, itemType) {
    if (!itemType) return false
    return pawn.inventory.some(item => item.type === itemType)
}

/**
 * Get all unique item types currently in pawn's inventory.
 * 
 * @param {Pawn} pawn - The pawn whose inventory to inspect
 * @returns {string[]} Array of unique item type strings
 */
export function getItemTypes(pawn) {
    const types = new Set()
    for (const item of pawn.inventory) {
        if (item.type) types.add(item.type)
    }
    return Array.from(types)
}

/**
 * Get total number of items in pawn's inventory.
 * Equivalent to pawn.inventory.length.
 * 
 * @param {Pawn} pawn - The pawn whose inventory to inspect
 * @returns {number} Total item count
 */
export function getTotalItems(pawn) {
    return pawn.inventory.length
}

/**
 * Clear all items from pawn's inventory and reset weight tracking.
 * 
 * @param {Pawn} pawn - The pawn whose inventory to clear
 */
export function clearInventory(pawn) {
    pawn.inventory = []
    pawn.inventoryWeight = 0
}

/**
 * Transfer items of a specific type from one pawn to another.
 * Respects slot/weight/size constraints on the destination pawn.
 * Failed transfers are rolled back (item returned to source).
 * 
 * @param {Pawn} from - Source pawn
 * @param {Pawn} to - Destination pawn
 * @param {string} itemType - Item type to transfer
 * @param {number} quantity - Number of items to transfer
 * @returns {number} Actual number of items transferred successfully
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
