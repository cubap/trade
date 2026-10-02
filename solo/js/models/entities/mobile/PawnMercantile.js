/**
 * Pawn mercantile systems: surplus detection, bartering, trade behavior.
 * 
 * Manages pawn's ability to accumulate surplus goods, initiate trades,
 * and build trade relationships with other pawns. Works with PriceRegistry
 * for price tracking and PawnInventory for item management.
 */

import { recordTrade } from '../../../core/PriceRegistry.js'
import { countItem as countHeld, getItemTypes } from './PawnInventory.js'

/**
 * How close two pawns must be for a trade to change hands.
 *
 * acceptBarter and the barter goal both need this number. They used to disagree:
 * the goal traded at anything under 10 units while acceptBarter only recognised a
 * partner within 1, so a partner standing 5 units away "agreed" to nothing and the
 * goal silently never completed. One constant, two users.
 */
export const TRADE_REACH = 4

/**
 * Count items of a specific type in pawn's inventory.
 *
 * Kept as the mercantile-side name for it; PawnInventory holds the logic so the
 * two modules cannot drift apart. Trade code that also needs the *set* of types
 * a pawn holds uses the re-exported getItemTypes - inventories are arrays of
 * item objects, so `Object.keys(inventory)` yields indices, not types, and
 * `pawn.countItem(...)` is not a method.
 *
 * @param {Pawn} pawn - The pawn to check
 * @param {string} itemType - Item type to count
 * @returns {number} Number of items of this type
 */
export function countItem(pawn, itemType) {
    return countHeld(pawn, itemType)
}

export { getItemTypes }

/**
 * Remove N items of a type from pawn's inventory.
 *
 * Returns the items that actually came out, which is what lets a caller undo a
 * move it no longer wants: an exchange that has to be refused should be able to
 * put back exactly what it took (#109).
 *
 * @param {Pawn} pawn - The pawn to remove items from
 * @param {string} itemType - Item type to remove
 * @param {number} amount - Number of items to remove
 * @returns {Object[]} the removed items, fewer than `amount` if the pawn ran out
 */
export function takeItems(pawn, itemType, amount) {
    const taken = []
    // Iterating the live array while removeItemFromInventory splices it makes the
    // cursor skip items, so a pawn with three sticks could only ever give up two.
    for (const item of [...pawn.inventory]) {
        if (item.type === itemType && taken.length < amount) {
            const removed = pawn.removeItemFromInventory(item.id)
            if (removed) taken.push(removed)
        }
    }
    return taken
}

/**
 * Can this pawn take what a trade would leave it, counting the goods it is about
 * to hand over as room? The mirror of the "do you still have it" checks around a
 * barter. Anything that does not answer the question (not a Pawn, or a Pawn from
 * before the carry rules lived in one method) is assumed to have room rather than
 * having a trade refused on a technicality.
 *
 * @param {Object} receiver - the pawn that would take the goods
 * @param {string} incomingType - item type it would receive
 * @param {number} incomingAmount
 * @param {string|null} [outgoingType] - item type it hands over in the same trade
 * @param {number} [outgoingAmount]
 * @returns {boolean}
 */
function willCarry(receiver, incomingType, incomingAmount, outgoingType = null, outgoingAmount = 0) {
    if (typeof receiver?.canHold !== 'function') return true
    const frees = outgoingType && outgoingAmount > 0
        ? receiver.inventory.filter(item => item.type === outgoingType).slice(0, outgoingAmount)
        : null
    return receiver.canHold(incomingType, incomingAmount, frees)
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

    // And that neither pack has room problems. Asking for a trade the other pawn
    // physically cannot carry wastes the approach; asking for goods the initiator
    // cannot bring back is the same mistake pointed the other way. acceptBarter
    // decides for itself when the offer comes back, because a pack can fill in
    // between asking and answering.
    if (!willCarry(target, offerType, offerAmount, wantType, wantAmount)) {
        return null
    }
    if (!willCarry(pawn, wantType, wantAmount, offerType, offerAmount)) {
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
    const initiator = pawn.getNearbyEntities(TRADE_REACH).find(e => e.id === offer.initiator)
    if (!initiator) return false

    // Verify both parties still have required items
    if (countItem(initiator, offer.offerType) < offer.offerAmount) return false
    if (countItem(pawn, offer.wantType) < offer.wantAmount) return false

    // Verify both packs can hold what they are about to receive. This mirror of the
    // two checks above used to be missing entirely: the goods came out of both packs
    // first, the placements were attempted, and their answer was thrown away, so a
    // pawn with a full pack deleted the difference and was still paid the practice
    // for a trade that had not happened (#109).
    if (!willCarry(initiator, offer.wantType, offer.wantAmount, offer.offerType, offer.offerAmount)) return false
    if (!willCarry(pawn, offer.offerType, offer.offerAmount, offer.wantType, offer.wantAmount)) return false

    // Move both ways. canHold() should have made this a formality, so anything that
    // still will not land undoes the whole exchange rather than eating it.
    const toPawn = takeItems(initiator, offer.offerType, offer.offerAmount)
    const toInitiator = takeItems(pawn, offer.wantType, offer.wantAmount)
    const placedForPawn = []
    const placedForInitiator = []
    const stuck = []
    for (const item of toPawn) (pawn.addItemToInventory(item) ? placedForPawn : stuck).push(item)
    for (const item of toInitiator) (initiator.addItemToInventory(item) ? placedForInitiator : stuck).push(item)

    if (stuck.length > 0 || toPawn.length < offer.offerAmount || toInitiator.length < offer.wantAmount) {
        // Undo: every item goes back to the pawn it came from. Its own removal just
        // made the room for it, so this normally cannot fail. If it somehow does -
        // a pack too small to hold its own contents - the other side carries the
        // goods rather than the item stopping existing: there is no ground to set
        // anything down on.
        for (const item of placedForPawn) pawn.removeItemFromInventory(item.id)
        for (const item of placedForInitiator) initiator.removeItemFromInventory(item.id)
        for (const item of toPawn) {
            if (!initiator.addItemToInventory(item)) pawn.addItemToInventory(item)
        }
        for (const item of toInitiator) {
            if (!pawn.addItemToInventory(item)) initiator.addItemToInventory(item)
        }
        return false
    }

    // Both parties gain bartering skill
    pawn.useSkill('bartering', 1)
    initiator.useSkill('bartering', 1)

    // And the world learns what the goods are worth. A completed exchange is the
    // only thing in the sim that knows a price, and until #110 it wrote nothing
    // down: PriceRegistry's consumers all read null, and kept reading null no
    // matter how much trade happened.
    const world = pawn.world ?? initiator.world
    if (world) {
        const registry = world.priceRegistry ?? (world.priceRegistry = { prices: {} })
        recordTradeObservation(pawn, offer, registry, tradeMarket(pawn, initiator))
    }

    pawn.addThought(`Traded ${offer.wantAmount} ${offer.wantType} for ${offer.offerAmount} ${offer.offerType}`, 'trade')
    return true
}

/**
 * The market a barter belongs to (#110).
 *
 * A price is a property of a place, and the only place-names this sim has are
 * landmarks a pawn remembers. An exchange happened where the two pawns are
 * standing, and the `barter` goal walks the initiator to the partner, so the
 * resident's home is the ground it was struck on; the visitor's landmark is the
 * fallback for a trade made in the field where only one of them knows where
 * they are.
 *
 * Deliberately not `'unknown'`, which is what this used to fall back to. Filing
 * every homeless pawn's trades in one global bucket puts numbers under a name no
 * route can ever be keyed by - TradeRoutes needs two distinct landmarks at its
 * ends (#95) - so the registry would have had data in it and still nothing that
 * could read it. A price nobody can locate is not a known price yet.
 *
 * @param {Pawn} resident - the pawn that was asked, i.e. the one at home
 * @param {Pawn} visitor - the pawn that travelled
 * @returns {string|null}
 */
function tradeMarket(resident, visitor) {
    return resident?.getHomeLandmark?.()?.name
        ?? visitor?.getHomeLandmark?.()?.name
        ?? null
}

/**
 * Record a trade observation in the price registry.
 *
 * Called from acceptBarter for the exchange it just completed (#110). One call
 * books one pair of numbers: the ratio the offer states, and its reciprocal for
 * the other good, both in the market the trade happened in. Booking it once per
 * *pawn* instead - which is what "both sides observe" might suggest - would give
 * the two ends of a single route opposite prices, and every merchant walking
 * between them would find a profit that the trade which created the numbers
 * already realised.
 *
 * @param {Pawn} pawn - The pawn recording the trade
 * @param {Object} offer - The trade offer that was executed
 * @param {Object} registry - Price registry object (the world's `priceRegistry`)
 * @param {string|null} [location] - Market name; defaults to the pawn's home landmark
 * @returns {boolean} True when the observation was bookable and written
 */
export function recordTradeObservation(pawn, offer, registry, location = null) {
    if (!registry || !offer || !offer.offerType || !offer.wantType) return false

    const market = location ?? pawn?.getHomeLandmark?.()?.name ?? null
    if (!market) return false

    // An offer that did not come through initiateBarter may carry no ratio;
    // the two amounts it names still mean the same exchange.
    const ratio = Number.isFinite(offer.ratio) && offer.ratio > 0
        ? offer.ratio
        : (offer.wantAmount > 0 ? offer.offerAmount / offer.wantAmount : null)
    if (ratio === null) return false

    const tick = pawn?.world?.clock?.currentTick ?? 0

    // Record from both perspectives
    recordTrade(registry, offer.offerType, market, ratio, tick)
    recordTrade(registry, offer.wantType, market, 1 / ratio, tick)
    return true
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
    const ourSurplus = new Set(surplus.map(s => s.type))

    for (const partner of nearby) {
        // A useful partner holds something we are not already drowning in.
        // This used to call partner.countItem(), which is not a method on Pawn
        // (counting lives here and in PawnInventory), so every barter goal threw
        // the moment a surplus pawn met another pawn (#107).
        if (getItemTypes(partner).some(type => !ourSurplus.has(type))) {
            return partner
        }
    }

    return null
}
