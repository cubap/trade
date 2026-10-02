/**
 * Pawn mercantile systems: surplus detection, bartering, trade behavior.
 * 
 * Manages pawn's ability to accumulate surplus goods, initiate trades,
 * and build trade relationships with other pawns. Works with PriceRegistry
 * for price tracking and PawnInventory for item management.
 */

import { recordTrade, getPrice, getKnownPrices, isPriceStale, detectArbitrage } from '../../../core/PriceRegistry.js'
import { findBestRoute, ROUTE_TRADE_MARGIN } from '../../../core/TradeRoutes.js'
import { countItem as countHeld, getItemTypes } from './PawnInventory.js'

/**
 * How much dearer a good must be elsewhere before a merchant bothers (#114).
 *
 * A 20% spread is worth asking about; one the size of a rounding error is not
 * worth crossing the map for, and without a floor the first non-identical pair
 * of prices would send every trader to the same field.
 *
 * Since #118 this is the route table's number rather than a second copy of it:
 * a road and a trade partner are the same question - is the far end dear enough
 * to walk for - and two 1.2s would drift apart the first time someone tuned one.
 */
export const PRICE_TRADE_MARGIN = ROUTE_TRADE_MARGIN

/**
 * A quote older than this is a memory of a price, not a price (#114).
 *
 * Matches PriceRegistry's own staleness default; the merchant passes it
 * explicitly so the two do not drift apart silently.
 */
export const PRICE_STALE_AFTER = 500

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
 * What our goods fetch where a partner lives, relative to here (#114).
 *
 * The registry has held recorded prices since #110 and nothing read them when
 * choosing a trading partner: two pawns both holding something we want were
 * worth the same however differently their markets paid. This is the number
 * that distinguishes them - the best surplus good by sell-high ratio between
 * the two homes - or null when the table has nothing live to say, which is the
 * common case early in a run and in every test without a registry.
 *
 * @param {Pawn} pawn - The prospective seller
 * @param {Pawn} partner - The pawn standing nearby
 * @param {string[]} [itemTypes] - Surplus types to consider (default: ours)
 * @returns {{type: string, gain: number, from: number, to: number, market: string}|null}
 */
export function priceAdvantage(pawn, partner, itemTypes = null) {
    const registry = pawn?.world?.priceRegistry
    if (!registry?.prices) return null

    const here = pawn.getHomeLandmark?.()?.name ?? null
    const there = partner?.getHomeLandmark?.()?.name ?? null
    if (!here || !there || here === there) return null

    const tick = pawn.world?.tick ?? pawn.world?.clock?.currentTick ?? 0
    const types = itemTypes ?? getSurplusItems(pawn).map(s => s.type)
    let best = null

    for (const type of types) {
        // isPriceStale() is true for missing data as well as dead data, so these
        // two guards are also the "we have never traded this here/there" check.
        if (isPriceStale(registry, type, here, tick, PRICE_STALE_AFTER)) continue
        if (isPriceStale(registry, type, there, tick, PRICE_STALE_AFTER)) continue

        const from = getPrice(registry, type, here)
        const to = getPrice(registry, type, there)
        if (!from || !to) continue

        const gain = to / from
        if (!best || gain > best.gain) best = { type, gain, from, to, market: there }
    }

    return best
}

/**
 * Is any of our surplus worth more at some other market than at ours? (#114)
 *
 * detectArbitrage() had no caller: it could name the dear market for an item
 * and nobody asked. Here it answers the question shouldSeekTrade() never got
 * round to - not "am I hungry" but "is there money in going out".
 *
 * @param {Pawn} pawn
 * @param {Array<{type: string}>} [surplus] - Pre-computed surplus list
 * @returns {Object|null} The arbitrage opportunity, or null
 */
export function profitableMarket(pawn, surplus = null) {
    const registry = pawn?.world?.priceRegistry
    if (!registry?.prices) return null

    const here = pawn.getHomeLandmark?.()?.name ?? null
    const tick = pawn.world?.tick ?? pawn.world?.clock?.currentTick ?? 0

    for (const holding of (surplus ?? getSurplusItems(pawn))) {
        const opp = detectArbitrage(registry, holding.type, PRICE_TRADE_MARGIN)
        if (!opp) continue
        // Standing in the dear market is not a reason to travel; the profit is
        // already ours to realise with whoever is nearby.
        if (here && opp.sellAt === here) continue
        if (isPriceStale(registry, holding.type, opp.sellAt, tick, PRICE_STALE_AFTER)) continue
        if (isPriceStale(registry, holding.type, opp.buyAt, tick, PRICE_STALE_AFTER)) continue
        return opp
    }

    return null
}

/**
 * Where our surplus would sell dearest, among markets a road actually reaches.
 *
 * #95/#105 record the roads a pawn walks and #110 books the prices trades pay;
 * findBestRoute() joins them and had no caller. This is that caller, and it is
 * deliberately a *market* rather than a journey - walking there is #99.
 *
 * Until #118 this function had to do the direction arithmetic itself, because
 * findBestRoute() ranked a road in the direction it was written: it read the
 * prices back out of the route table, worked out which end was dearer, and threw
 * away the answer when that end was the one the pawn was standing on. Now the
 * route table is told where the walker is and returns the leg, so this is the
 * question rather than the workaround.
 *
 * @param {Pawn} pawn
 * @param {string[]} [itemTypes] - Surplus types to consider (default: ours)
 * @returns {{type: string, market: string, gain: number, route: Object}|null}
 */
export function bestMarketToSell(pawn, itemTypes = null) {
    const registry = pawn?.world?.priceRegistry
    const routes = pawn?.world?.tradeRoutes
    if (!registry?.prices || !routes?.list?.length) return null

    const here = pawn.getHomeLandmark?.()?.name ?? null
    const tick = pawn.world?.tick ?? pawn.world?.clock?.currentTick ?? 0
    const types = itemTypes ?? getSurplusItems(pawn).map(s => s.type)
    let best = null

    for (const type of types) {
        // Ranked from the end this pawn is standing at, and only legs that clear
        // the margin come back at all.
        const route = findBestRoute(routes, registry, type, here)
        if (!route) continue

        const market = route.sellAt
        if (isPriceStale(registry, type, market, tick, PRICE_STALE_AFTER)) continue

        if (!best || route.spread > best.gain) best = { type, market, gain: route.spread, route }
    }

    return best
}

/**
 * How urgent a need has to be before a merchant will leave home to sell
 * something they do not strictly need to sell (#114).
 *
 * Needs in this codebase are 0-100 *urgency* values that grow (PawnNeeds), so
 * unlike the rest of this file's old predicates the reading is "above", not
 * "below". At anxiety a trader goes out to top up; past critical they are in
 * trouble rather than in trade, and the goal has nothing to offer them.
 *
 * The rule this replaces asked for `pawn.needs.food.value < 20`, a field that
 * has never existed - needs are not on the pawn that way. The comparison was
 * therefore always false and the "unmet needs" clause was decoration.
 */
export const TRADE_ANXIETY = 60
export const TRADE_CRITICAL = 85

/** The pawn's worst pressing need, or 0 for a thing without needs. */
function needUrgency(pawn) {
    const needs = pawn?.needs?.needs
    if (!needs) return 0
    return Math.max(needs.hunger ?? 0, needs.thirst ?? 0, needs.energy ?? 0)
}

/**
 * Has this good been priced anywhere at all?
 *
 * An empty table is not "nothing worth selling" - it is a world too young to
 * have traded, in which there is no number to consult yet. Merchants trade on
 * instinct there, because the trades are what fill the table (#110).
 *
 * @param {Pawn} pawn
 * @param {Array<{type: string}>} surplus
 * @returns {boolean}
 */
function pricesKnownFor(pawn, surplus) {
    const registry = pawn?.world?.priceRegistry
    if (!registry?.prices) return false

    return surplus.some(holding => Object.keys(getKnownPrices(registry, holding.type)).length > 0)
}

/**
 * Why this pawn wants to go trading, in one place (#114).
 *
 * shouldSeekTrade() asked about surplus, skill levels and needs and never about
 * what anything was worth, so a full pack of cheap goods sent a well-fed pawn
 * out to barter exactly as eagerly as a scarce one. The reasons are now need,
 * profit, or instinct - instinct only while the market table is still blank.
 *
 * @param {Pawn} pawn
 * @returns {{seek: boolean, reason: ('need'|'profit'|'instinct')|null, opportunity?: Object}}
 */
export function tradeMotivation(pawn) {
    const surplus = getSurplusItems(pawn)
    if (surplus.length === 0) return { seek: false, reason: null }

    const cooperation = pawn.getSkill('cooperation')
    const bartering = pawn.getSkill('bartering')
    if (cooperation < 3 && bartering < 1) return { seek: false, reason: null }

    const pressed = needUrgency(pawn)
    if (pressed >= TRADE_CRITICAL) return { seek: false, reason: null }

    if (pressed >= TRADE_ANXIETY) return { seek: true, reason: 'need' }

    // A table with nothing in it is not evidence that trade is pointless, it is
    // evidence that nobody has traded yet. Somebody has to bootstrap the prices.
    if (!pricesKnownFor(pawn, surplus)) return { seek: true, reason: 'instinct' }

    const opportunity = profitableMarket(pawn, surplus)
    if (opportunity) return { seek: true, reason: 'profit', opportunity }

    return { seek: false, reason: null }
}

/**
 * Check if a pawn should seek trade opportunities.
 * 
 * @param {Pawn} pawn - The pawn to evaluate
 * @returns {boolean} True if pawn should seek trade
 */
export function shouldSeekTrade(pawn) {
    return tradeMotivation(pawn).seek
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
    const surplusTypes = surplus.map(s => s.type)
    const ourSurplus = new Set(surplusTypes)

    let first = null
    let preferred = null
    let bestGain = PRICE_TRADE_MARGIN

    for (const partner of nearby) {
        // A useful partner holds something we are not already drowning in.
        // This used to call partner.countItem(), which is not a method on Pawn
        // (counting lives here and in PawnInventory), so every barter goal threw
        // the moment a surplus pawn met another pawn (#107).
        if (!getItemTypes(partner).some(type => !ourSurplus.has(type))) continue

        if (!first) first = partner

        // #114: whoever we already know is worth trading with may not be the
        // best trade. Where the recorded prices say our goods fetch more, and
        // the pair is recent enough to still be a price, prefer that partner.
        // With no registry, or nothing live in it, every candidate scores the
        // same and the first one found still wins - proximity as before.
        const signal = priceAdvantage(pawn, partner, surplusTypes)
        if (signal && signal.gain > bestGain) {
            preferred = partner
            bestGain = signal.gain
        }
    }

    return preferred ?? first
}
