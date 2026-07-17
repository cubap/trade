/**
 * Pawn reputation systems: group-to-group reputation, gossip, thresholds.
 * 
 * Group reputation is the resolution layer for inter-group interactions.
 * Instead of tracking O(n²) pawn-to-pawn trust across groups, we track
 * O(m²) group-to-group reputation where m is the number of groups.
 * 
 * Individual pawn trust still exists for within-group dynamics, but
 * cross-group interactions (contracts, trade, alliances) use group reputation.
 */

/**
 * Get group reputation score for another group.
 * @param {Pawn} pawn - Pawn whose group's reputation we're checking
 * @param {string} targetGroupId - ID of target group
 * @returns {number} Reputation score (0-1)
 */
export function getGroupReputation(pawn, targetGroupId) {
    if (!targetGroupId || !pawn.groupMemberships) return 0.5 // Neutral default

    // Find which of this pawn's groups has reputation toward target
    for (const [groupId, membership] of Object.entries(pawn.groupMemberships)) {
        const groupRep = membership.reputation?.[targetGroupId]
        if (groupRep !== undefined) {
            return groupRep
        }
    }

    return 0.5 // Neutral default if no reputation tracked
}

/**
 * Set group reputation score toward another group.
 * @param {Pawn} pawn - Pawn whose group's reputation we're setting
 * @param {string} targetGroupId - ID of target group
 * @param {number} score - Reputation score (0-1)
 */
export function setGroupReputation(pawn, targetGroupId, score) {
    if (!targetGroupId || !pawn.groupMemberships) return

    // Update reputation for all of this pawn's groups
    for (const [groupId, membership] of Object.entries(pawn.groupMemberships)) {
        if (!membership.reputation) {
            membership.reputation = {}
        }
        membership.reputation[targetGroupId] = Math.max(0, Math.min(1, score))
    }
}

/**
 * Get target group ID from another pawn.
 * @param {Pawn} otherPawn - Other pawn to look up group for
 * @returns {string|null} Group ID or null
 */
export function getTargetGroupId(otherPawn) {
    if (!otherPawn?.groupMemberships) return null

    // Return first group ID this pawn belongs to
    const entries = Object.entries(otherPawn.groupMemberships)
    return entries.length > 0 ? entries[0][0] : null
}

/**
 * Modify group reputation based on an event.
 * @param {Pawn} pawn - Pawn whose group's reputation is being modified
 * @param {string} targetGroupId - ID of target group
 * @param {string} eventType - Type of event: 'contract_fulfilled', 'contract_broken', 'trade_success', 'raid_defended', 'raid_attacked'
 * @param {number} magnitude - Base magnitude of change (0-1)
 */
export function modifyGroupReputation(pawn, targetGroupId, eventType, magnitude = 0.1) {
    if (!targetGroupId) return

    const currentRep = getGroupReputation(pawn, targetGroupId)
    let change = 0

    switch (eventType) {
        case 'contract_fulfilled':
            change = magnitude * 0.15 // +15% of magnitude
            break
        case 'contract_broken':
            change = -magnitude * 0.3 // -30% of magnitude
            break
        case 'trade_success':
            change = magnitude * 0.1 // +10% of magnitude
            break
        case 'raid_defended':
            change = magnitude * 0.2 // +20% of magnitude (defending together builds trust)
            break
        case 'raid_attacked':
            change = -magnitude * 0.25 // -25% of magnitude
            break
        default:
            change = magnitude * 0.05 // Small default change
    }

    const newRep = Math.max(0, Math.min(1, currentRep + change))
    setGroupReputation(pawn, targetGroupId, newRep)
}

/**
 * Apply reputation decay to all tracked group reputations.
 * Reputation slowly returns toward neutral (0.5) over time.
 * @param {Pawn} pawn
 * @param {number} decayRate - Decay rate per tick (default 0.001)
 */
export function applyReputationDecay(pawn, decayRate = 0.001) {
    if (!pawn.groupMemberships) return

    for (const [, membership] of Object.entries(pawn.groupMemberships)) {
        if (!membership.reputation) continue

        for (const [groupId, rep] of Object.entries(membership.reputation)) {
            // Decay toward neutral (0.5)
            const diff = rep - 0.5
            const decayed = rep - diff * decayRate
            membership.reputation[groupId] = Math.max(0, Math.min(1, decayed))
        }
    }
}

/**
 * Propagate reputation to allied groups (gossip).
 * When Group A has reputation toward Group B, allied groups of A
 * inherit a fraction of that reputation toward B.
 * @param {Pawn} pawn - Pawn whose group's reputation is being propagated
 * @param {number} contagionFactor - Fraction of reputation to propagate (default 0.5)
 */
export function propagateReputationToAllies(pawn, contagionFactor = 0.5) {
    if (!pawn.groupMemberships) return

    // Find allied groups (groups with high mutual reputation)
    const alliedGroups = []
    for (const [groupId, membership] of Object.entries(pawn.groupMemberships)) {
        if (!membership.reputation) continue

        for (const [targetGroupId, rep] of Object.entries(membership.reputation)) {
            if (rep >= 0.7) { // High reputation = allied
                alliedGroups.push({ groupId, targetGroupId, rep })
            }
        }
    }

    // Propagate reputation to allies
    for (const alliance of alliedGroups) {
        const sourceRep = alliance.rep
        const propagatedRep = 0.5 + (sourceRep - 0.5) * contagionFactor

        // Set this reputation for all of pawn's groups toward the target
        for (const [groupId] of Object.entries(pawn.groupMemberships)) {
            if (groupId !== alliance.groupId) {
                const currentRep = getGroupReputation(pawn, alliance.targetGroupId)
                // Blend existing reputation with propagated reputation
                const blendedRep = currentRep * 0.6 + propagatedRep * 0.4
                setGroupReputation(pawn, alliance.targetGroupId, blendedRep)
            }
        }
    }
}

/**
 * Check if group reputation meets a threshold for an action.
 * @param {Pawn} pawn
 * @param {string} targetGroupId - ID of target group
 * @param {string} action - Action type: 'contract', 'trade', 'alliance', 'raid'
 * @returns {boolean} True if reputation meets threshold
 */
export function meetsReputationThreshold(pawn, targetGroupId, action) {
    const rep = getGroupReputation(pawn, targetGroupId)

    const thresholds = {
        contract: 0.4, // Can offer contracts at 40%+ reputation
        trade: 0.3,    // Can trade at 30%+ reputation
        alliance: 0.7, // Can form alliance at 70%+ reputation
        raid: 0.2      // Can raid at any reputation (low rep = hostile)
    }

    return rep >= (thresholds[action] ?? 0.5)
}

/**
 * Get reputation-affected contract rate modifier.
 * Higher reputation = better rates for the other party.
 * @param {Pawn} pawn
 * @param {string} targetGroupId - ID of target group
 * @returns {number} Rate modifier (0.5 = 50% discount, 1.0 = normal, 1.5 = 50% premium)
 */
export function getContractRateModifier(pawn, targetGroupId) {
    const rep = getGroupReputation(pawn, targetGroupId)

    // Reputation 0-0.3: 1.3x premium (distrusted)
    // Reputation 0.3-0.7: 1.0x normal
    // Reputation 0.7-1.0: 0.7x discount (trusted)
    if (rep < 0.3) {
        return 1.3 - (rep / 0.3) * 0.3 // 1.3 → 1.0
    } else if (rep < 0.7) {
        return 1.0 // Normal rate
    } else {
        return 1.0 - ((rep - 0.7) / 0.3) * 0.3 // 1.0 → 0.7
    }
}

/**
 * Get reputation-affected trade price modifier.
 * Higher reputation = better prices for both parties.
 * @param {Pawn} pawn
 * @param {string} targetGroupId - ID of target group
 * @returns {number} Price modifier (0.8 = 20% discount, 1.0 = normal, 1.2 = 20% premium)
 */
export function getTradePriceModifier(pawn, targetGroupId) {
    const rep = getGroupReputation(pawn, targetGroupId)

    // Reputation 0-0.3: 1.2x premium (distrusted)
    // Reputation 0.3-0.7: 1.0x normal
    // Reputation 0.7-1.0: 0.8x discount (trusted)
    if (rep < 0.3) {
        return 1.2 - (rep / 0.3) * 0.2 // 1.2 → 1.0
    } else if (rep < 0.7) {
        return 1.0 // Normal price
    } else {
        return 1.0 - ((rep - 0.7) / 0.3) * 0.2 // 1.0 → 0.8
    }
}

/**
 * Get reputation label for display.
 * @param {Pawn} pawn
 * @param {string} targetGroupId - ID of target group
 * @returns {string} Reputation label
 */
export function getReputationLabel(pawn, targetGroupId) {
    const rep = getGroupReputation(pawn, targetGroupId)

    if (rep >= 0.9) return 'Allied'
    if (rep >= 0.7) return 'Trusted'
    if (rep >= 0.5) return 'Neutral'
    if (rep >= 0.3) return 'Distrusted'
    return 'Hostile'
}

/**
 * Record a reputation event for tracking.
 * @param {Pawn} pawn
 * @param {string} targetGroupId - ID of target group
 * @param {string} eventType - Event type
 * @param {number} magnitude - Magnitude of change
 * @param {number} tick - Current tick
 */
export function recordReputationEvent(pawn, targetGroupId, eventType, magnitude, tick) {
    if (!targetGroupId || !pawn.groupMemberships) return

    for (const [, membership] of Object.entries(pawn.groupMemberships)) {
        if (!membership.reputationEvents) {
            membership.reputationEvents = []
        }

        membership.reputationEvents.push({
            targetGroupId,
            eventType,
            magnitude,
            tick,
            timestamp: Date.now()
        })

        // Keep only recent events (last 50)
        if (membership.reputationEvents.length > 50) {
            membership.reputationEvents = membership.reputationEvents.slice(-50)
        }
    }
}

/**
 * Get recent reputation events for a target group.
 * @param {Pawn} pawn
 * @param {string} targetGroupId - ID of target group
 * @param {number} maxEvents - Maximum events to return
 * @returns {Array} Recent reputation events
 */
export function getRecentReputationEvents(pawn, targetGroupId, maxEvents = 10) {
    if (!targetGroupId || !pawn.groupMemberships) return []

    const events = []
    for (const [, membership] of Object.entries(pawn.groupMemberships)) {
        if (!membership.reputationEvents) continue

        for (const event of membership.reputationEvents) {
            if (event.targetGroupId === targetGroupId) {
                events.push(event)
            }
        }
    }

    // Sort by tick descending, return most recent
    events.sort((a, b) => b.tick - a.tick)
    return events.slice(0, maxEvents)
}

/**
 * Check if pawn can initiate trade with another pawn based on group reputation.
 * @param {Pawn} pawn
 * @param {Pawn} otherPawn - Other pawn to trade with
 * @returns {Object} { canTrade: boolean, reason: string, priceModifier: number }
 */
export function canInitiateTrade(pawn, otherPawn) {
    if (!otherPawn?.groupMemberships) {
        return { canTrade: true, reason: 'no_group', priceModifier: 1.0 }
    }

    const targetGroupId = getTargetGroupId(otherPawn)
    if (!targetGroupId) {
        return { canTrade: true, reason: 'no_group', priceModifier: 1.0 }
    }

    const canTrade = meetsReputationThreshold(pawn, targetGroupId, 'trade')
    const priceModifier = getTradePriceModifier(pawn, targetGroupId)
    const label = getReputationLabel(pawn, targetGroupId)

    return {
        canTrade,
        reason: canTrade ? 'reputation_ok' : 'reputation_too_low',
        priceModifier,
        reputationLabel: label
    }
}

/**
 * Check if pawn can offer a contract to another pawn's group.
 * @param {Pawn} pawn
 * @param {Pawn} otherPawn - Other pawn to offer contract to
 * @returns {Object} { canOffer: boolean, reason: string, rateModifier: number }
 */
export function canOfferContract(pawn, otherPawn) {
    if (!otherPawn?.groupMemberships) {
        return { canOffer: true, reason: 'no_group', rateModifier: 1.0 }
    }

    const targetGroupId = getTargetGroupId(otherPawn)
    if (!targetGroupId) {
        return { canOffer: true, reason: 'no_group', rateModifier: 1.0 }
    }

    const canOffer = meetsReputationThreshold(pawn, targetGroupId, 'contract')
    const rateModifier = getContractRateModifier(pawn, targetGroupId)
    const label = getReputationLabel(pawn, targetGroupId)

    return {
        canOffer,
        reason: canOffer ? 'reputation_ok' : 'reputation_too_low',
        rateModifier,
        reputationLabel: label
    }
}
