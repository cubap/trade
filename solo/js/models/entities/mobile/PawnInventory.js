/**
 * Pawn inventory systems: carried items, item management.
 */

/**
 * Add an item to pawn's inventory.
 * @param {Pawn} pawn
 * @param {string} itemType - Item type
 * @param {number} quantity - Quantity to add
 * @returns {boolean} True if item was added
 */
export function addItem(pawn, itemType, quantity = 1) {
    if (!itemType) return false

    const current = pawn.inventory[itemType] ?? 0
    pawn.inventory[itemType] = current + quantity
    return true
}

/**
 * Take items from pawn's inventory.
 * @param {Pawn} pawn
 * @param {string} itemType - Item type
 * @param {number} quantity - Quantity to take
 * @returns {number} Actual quantity taken
 */
export function takeItem(pawn, itemType, quantity = 1) {
    if (!itemType) return 0

    const current = pawn.inventory[itemType] ?? 0
    const taken = Math.min(current, quantity)
    pawn.inventory[itemType] = current - taken

    if (pawn.inventory[itemType] === 0) {
        delete pawn.inventory[itemType]
    }

    return taken
}

/**
 * Count items by type.
 * @param {Pawn} pawn
 * @param {string} itemType - Item type to count
 * @returns {number} Quantity of item type
 */
export function countItem(pawn, itemType) {
    return pawn.inventory[itemType] ?? 0
}

/**
 * Check if pawn has an item type.
 * @param {Pawn} pawn
 * @param {string} itemType - Item type to check
 * @returns {boolean} True if pawn has item type
 */
export function hasItem(pawn, itemType) {
    return (pawn.inventory[itemType] ?? 0) > 0
}

/**
 * Get all item types in inventory.
 * @param {Pawn} pawn
 * @returns {Array} Item types
 */
export function getItemTypes(pawn) {
    return Object.keys(pawn.inventory)
}

/**
 * Get total items in inventory.
 * @param {Pawn} pawn
 * @returns {number} Total items
 */
export function getTotalItems(pawn) {
    return Object.values(pawn.inventory).reduce((sum, qty) => sum + qty, 0)
}

/**
 * Clear inventory.
 * @param {Pawn} pawn
 */
export function clearInventory(pawn) {
    pawn.inventory = {}
}

/**
 * Transfer items from one pawn to another.
 * @param {Pawn} from - Source pawn
 * @param {Pawn} to - Destination pawn
 * @param {string} itemType - Item type to transfer
 * @param {number} quantity - Quantity to transfer
 * @returns {number} Actual quantity transferred
 */
export function transferItems(from, to, itemType, quantity = 1) {
    const taken = takeItem(from, itemType, quantity)
    if (taken > 0) {
        addItem(to, itemType, taken)
    }
    return taken
}
