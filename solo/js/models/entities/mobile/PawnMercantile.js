/**
 * Pawn mercantile systems: surplus detection, bartering, trade behavior.
 * 
 * Manages pawn's ability to accumulate surplus goods, initiate trades,
 * and build trade relationships with other pawns. Works with PriceRegistry
 * for price tracking and PawnInventory for item management.
 */

import { recordTrade } from '../core/PriceRegistry.js'

/**
 * Count items of a specific type in pawn's inventory.
 * 
 * @param {Pawn} pawn - The pawn to check
 * @param {string} itemType - Item type to count
 * @returns {number} Number of items of this type
 */
export function countItem(pawn, itemType) {
    return pawn.inventory.filter(item => item.type === itemType).length
}

/**
 * Remove N items of a type from pawn's inventory.
 * 
 * @param {Pawn} pawn - The pawn to remove items from
 * @param {string} itemType - Item type to remove
 * @param {number} amount - Number of items to remove
 */
export function takeItems(pawn, itemType, amount) {
    let removed = 0
    for (const item of pawn.inventory) {
        if (item.type === itemType && removed < amount) {
            pawn.removeItemFromInventory(item.id)
            removed++
        }
    }
}

/**
 * Check if a pawn has surplus of a specific item type beyond personal need.
 * 
 * @param {Pawn} pawn - The pawn to check
 * @param {string} itemType - Item type to check surplus for
 * @param {number} personalNeed - Number of items considered personal need (default 3)
 * @returns {boolean} True if pawn has surplus
 */
export function hasSurplus(pawn, itemType, personalNeed = 3) {
    const count = countItem(pawn, itemType)
    return count > personalNeed
}

/**
 * Get all item types where pawn has surplus.
 * 
 * @param {Pawn} pawn - The pawn to check
 * @param {number} personalNeed - Number of items considered personal need per type (default 3)
 * @returns {Object[]} Array of { type, count, surplus } objects
 */
export function getSurplusItems(pawn, personalNeed = 3) {
    const inventory = pawn.inventory || []
    const surplus = []

    const typeCounts = {}
    for (const item of inventory) {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1
    }

    for (const [type, count] of Object.entries(typeCounts)) {
        if (count > personalNeed) {
            surplus.push({ type, count, surplus: count - personalNeed })
        }
    }

    return surplus
}

/**
 * Initiate a barter offer with another pawn.
 * 
 * @param {Pawn} pawn - The pawn initiating the trade
 * @param {Pawn} target - The pawn to trade with
 * @param {string} offerType - Item type pawn is offering
 * @param {number} offerAmount - Number of items to offer
 * @param {string} wantType - Item type pawn wants in return
 * @param {number} wantAmount - Number of items wanted
 * @returns {Object|null} Trade offer object, or null if trade cannot be initiated
 */
export function initiateBarter(pawn, target, offerType, offerAmount, wantType, wantAmount) {
    // Check prerequisites
    const cooperation = pawn.getSkill('cooperation')
    if (cooperation < 3 && !pawn.getSkill('bartering')) {
        return null
    }

    // Check pawn has items to offer
    if (countItem(pawn, offerType) < offerAmount) {
        return null
    }

    // Check target has items wanted
    if (countItem(target, wantType) < wantAmount) {
        return null
    }

    // Create trade offer
    const offer = {
        id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        initiator: pawn.id,
        target: target.id,
        offerType,
        offerAmount,
        wantType,
        wantAmount,
        ratio: offerAmount / wantAmount,
        timestamp: Date.now()
    }

    pawn.addThought(`Offering ${offerAmount} ${offerType} for ${wantAmount} ${wantType}`, 'trade')
    return offer
}

/**
 * Accept a trade offer from another pawn.
 * 
 * @param {Pawn} pawn - The pawn accepting the trade
 * @param {Object} offer - The trade offer to accept
 * @returns {boolean} True if trade was executed successfully
 */
export function acceptBarter(pawn, offer) {
    const initiator = pawn.getNearbyEntities(1).find(e => e.id === offer.initiator)
    if (!initiator) return false

    // Verify both parties still have required items
    if (countItem(initiator, offer.offerType) < offer.offerAmount) return false
    if (countItem(pawn, offer.wantType) < offer.wantAmount) return false

    // Execute trade
    takeItems(initiator, offer.offerType, offer.offerAmount)
    takeItems(pawn, offer.wantType, offer.wantAmount)
    for (let i = 0; i < offer.wantAmount; i++) {
        initiator.addItemToInventory({ type: offer.wantType })
    }
    for (let i = 0; i < offer.offerAmount; i++) {
        pawn.addItemToInventory({ type: offer.offerType })
    }

    // Both parties gain bartering skill
    pawn.gainSkill('bartering', 1)
    initiator.gainSkill('bartering', 1)

    pawn.addThought(`Traded ${offer.wantAmount} ${offer.wantType} for ${offer.offerAmount} ${offer.offerType}`, 'trade')
    return true
}

/**
 * Record a trade observation in the price registry.
 * 
 * @param {Pawn} pawn - The pawn recording the trade
 * @param {Object} offer - The trade offer that was executed
 * @param {Object} registry - Price registry object (from world or shared scope)
 */
export function recordTradeObservation(pawn, offer, registry) {
    if (!registry) return

    const location = pawn.getHomeLandmark()?.name ?? 'unknown'
    const tick = pawn.world?.clock?.currentTick ?? 0

    // Record from both perspectives
    const { recordTrade } = require('../core/PriceRegistry.js')
    recordTrade(registry, offer.offerType, location, offer.ratio, tick)
    recordTrade(registry, offer.wantType, location, 1 / offer.ratio, tick)
}

/**
 * Check if a pawn should seek trade opportunities.
 * 
 * @param {Pawn} pawn - The pawn to evaluate
 * @returns {boolean} True if pawn should seek trade
 */
export function shouldSeekTrade(pawn) {
    const surplus = getSurplusItems(pawn)
    const cooperation = pawn.getSkill('cooperation')
    const bartering = pawn.getSkill('bartering')

    // Need surplus and social capability
    if (surplus.length === 0) return false
    if (cooperation < 3 && bartering < 1) return false

    // Don't trade if basic needs are unmet
    if (pawn.needs.food.value < 20 || pawn.needs.water.value < 20) return false

    return true
}

/**
 * Find a suitable trade partner among nearby entities.
 * 
 * @param {Pawn} pawn - The pawn seeking a trade partner
 * @param {number} range - Search range for potential partners
 * @returns {Pawn|null} Suitable trade partner, or null
 */
export function findTradePartner(pawn, range = 50) {
    const surplus = getSurplusItems(pawn)
    if (surplus.length === 0) return null

    const nearby = pawn.getNearbyEntities(range).filter(e => e.subtype === 'pawn')
countItem(partner, 
    for (const partner of nearby) {
        // Check if partner has something we want
        for (const { type } of surplus) {
            if (partner.countItem(type) > 0) {
                return partner
            }
        }
    }

    return null
}
