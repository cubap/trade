/**
 * Pawn social systems: trust, group formation, proximity trust.
 */

/**
 * Get trust score for another pawn.
 * @param {Pawn} pawn
 * @param {Pawn} otherPawn
 * @returns {number} Trust score (0-1)
 */
export function getGroupTrustIn(pawn, otherPawn) {
    if (!otherPawn?.id) return 0
    return pawn.groupTrust[otherPawn.id] ?? 0
}

/**
 * Set trust score for another pawn.
 * @param {Pawn} pawn
 * @param {Pawn} otherPawn
 * @param {number} score - Trust score (0-1)
 */
export function setGroupTrustIn(pawn, otherPawn, score) {
    if (!otherPawn?.id) return
    pawn.groupTrust[otherPawn.id] = Math.max(0, Math.min(1, score))
}

/**
 * Gain trust from proximity + shared sleep.
 * @param {Pawn} pawn
 * @param {Array} nearbyPawns - Nearby pawns to gain trust with
 */
export function registerProximityTrustGain(pawn, nearbyPawns = []) {
    if (!nearbyPawns.length) return

    for (const otherPawn of nearbyPawns) {
        if (!otherPawn?.id || otherPawn.id === pawn.id) continue

        // Gain modest trust from proximity + shared sleep
        const baseTrust = 0.08
        const currentTrust = getGroupTrustIn(pawn, otherPawn) ?? 0
        const newTrust = Math.min(1, currentTrust + baseTrust)

        setGroupTrustIn(pawn, otherPawn, newTrust)

        // Log thought about the shared experience
        if (newTrust >= 0.2) {
            pawn.addThought(`Spending a safe night near ${otherPawn.name} builds familiarity.`, 'social')
        }
    }
}

/**
 * Gain trust from successful hunt with partners.
 * @param {Pawn} pawn
 * @param {Array} huntingPartners - Partners in the hunt
 */
export function registerHuntSuccess(pawn, huntingPartners = []) {
    if (!huntingPartners.length) return

    for (const partner of huntingPartners) {
        if (!partner?.id || partner.id === pawn.id) continue

        // Hunt success: +0.15 trust (significant cooperative achievement)
        const baseTrust = 0.15
        const currentTrust = getGroupTrustIn(pawn, partner) ?? 0
        const newTrust = Math.min(1, currentTrust + baseTrust)

        setGroupTrustIn(pawn, partner, newTrust)

        // Log thought about shared hunt success
        pawn.addThought(`Successfully hunted together with ${partner.name}. We work well as a team.`, 'social')
    }
}

/**
 * Gain trust from using someone else's cache.
 * @param {Pawn} pawn
 * @param {string} cacheBuilderId - ID of pawn who built the cache
 */
export function notifyCacheSharing(pawn, cacheBuilderId) {
    if (!cacheBuilderId) return
    const cacheBuilder = pawn.world?.entitiesMap?.get(cacheBuilderId)
    if (!cacheBuilder || cacheBuilder.id === pawn.id) return

    // Cache sharing: +0.10 trust (relying on someone's preparation)
    const baseTrust = 0.10
    const currentTrust = getGroupTrustIn(pawn, cacheBuilder) ?? 0
    const newTrust = Math.min(1, currentTrust + baseTrust)

    setGroupTrustIn(pawn, cacheBuilder, newTrust)

    // Log thought about cache sharing
    pawn.addThought(`Using ${cacheBuilder.name}'s cache builds trust in their preparation.`, 'social')
}

/**
 * Check if pawns can form a civic group.
 * @param {Pawn} pawn
 * @returns {Object|null} Civic group trigger or null
 */
export function checkCivicGroupFormationTrigger(pawn) {
    if (!pawn.world?.entitiesMap) return null

    const otherPawns = Array.from(pawn.world.entitiesMap.values()).filter(e =>
        e?.subtype === 'pawn' && e.id !== pawn.id
    )

    if (otherPawns.length < 1) return null

    // Find pawns with trust >= 0.2 and home location within 50 units
    const potentialMembers = otherPawns.filter(p => {
        const trust = getGroupTrustIn(pawn, p) ?? 0
        if (trust < 0.2) return false

        const otherHome = p.homeLandmark
        const thisHome = pawn.homeLandmark

        if (!otherHome || !thisHome) return false

        const dist = Math.sqrt(
            Math.pow(otherHome.x - thisHome.x, 2) +
            Math.pow(otherHome.y - thisHome.y, 2)
        )

        return dist <= 50
    })

    if (potentialMembers.length < 1) return null

    return {
        type: 'civic',
        initiatorId: pawn.id,
        members: [pawn, ...potentialMembers],
        homeLocation: pawn.homeLandmark,
        baseTrust: Math.min(...potentialMembers.map(p => getGroupTrustIn(pawn, p) ?? 0))
    }
}

/**
 * Apply trust decay over time.
 * @param {Pawn} pawn
 * @param {number} tick - Current game tick
 */
export function applyTrustDecay(pawn, tick) {
    const config = pawn.trustDecayConfig
    if (!config.enabled) return

    if (tick - config.lastDecayTick < config.decayPeriod) return

    for (const pawnId in pawn.groupTrust) {
        pawn.groupTrust[pawnId] = Math.max(config.decayFloor, pawn.groupTrust[pawnId] - config.decayRate)
    }

    config.lastDecayTick = tick
}
