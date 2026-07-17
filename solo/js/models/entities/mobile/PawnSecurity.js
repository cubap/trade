/**
 * Pawn security systems: contracts between groups, hunt coordination.
 */

/**
 * Create a security contract between groups.
 * @param {Pawn} pawn - Initiating pawn (leader)
 * @param {string} withGroup - Group ID to contract with
 * @param {string} type - Contract type: 'patrol', 'defense'
 * @param {Object} terms - Contract terms
 * @returns {string} Contract ID
 */
export function createSecurityContract(pawn, withGroup, type, terms = {}) {
    const contractId = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    pawn.securityContracts[contractId] = {
        withGroup,
        type,
        terms,
        active: true,
        createdAt: pawn.world?.clock?.currentTick ?? 0
    }

    return contractId
}

/**
 * Get active security contracts.
 * @param {Pawn} pawn
 * @returns {Array} Active contracts
 */
export function getActiveSecurityContracts(pawn) {
    return Object.values(pawn.securityContracts).filter(c => c.active)
}

/**
 * Terminate a security contract.
 * @param {Pawn} pawn
 * @param {string} contractId
 * @returns {boolean} True if contract was terminated
 */
export function terminateSecurityContract(pawn, contractId) {
    const contract = pawn.securityContracts[contractId]
    if (!contract) return false

    contract.active = false
    return true
}

/**
 * Create a hunt party with members.
 * @param {Pawn} pawn - Leader creating the party
 * @param {Array} members - Party members
 * @param {string} targetId - Target to hunt
 * @param {Object} targetLocation - {x, y} target location
 * @returns {Object} Hunt party object
 */
export function createHuntParty(pawn, members, targetId, targetLocation) {
    const partyId = `hunt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    pawn.huntParty = {
        partyId,
        targetId,
        targetLocation,
        members: [pawn.id, ...members.map(m => m.id)],
        startedAt: pawn.world?.clock?.currentTick ?? 0
    }

    // Notify all members
    for (const member of members) {
        if (member) {
            member.receiveGroupCommand({
                type: 'hunt',
                partyId,
                targetId,
                targetLocation
            })
        }
    }

    // Record tactical memory for all participants
    for (const memberId of pawn.huntParty.members) {
        const member = pawn.world?.entitiesMap?.get(memberId)
        if (member) {
            member.recordTacticalMemory('route', targetLocation, `Hunt route to ${targetId}`, 0.7)
        }
    }

    return pawn.huntParty
}

/**
 * Update hunt party state.
 * @param {Pawn} pawn
 * @param {Object} newTargetLocation - New target location
 */
export function updateHuntParty(pawn, newTargetLocation) {
    if (!pawn.huntParty) return

    pawn.huntParty.targetLocation = newTargetLocation

    // Notify all members of target movement
    for (const memberId of pawn.huntParty.members) {
        const member = pawn.world?.entitiesMap?.get(memberId)
        if (member && member.id !== pawn.id) {
            member.receiveGroupCommand({
                type: 'hunt',
                partyId: pawn.huntParty.partyId,
                targetLocation: newTargetLocation
            })
        }
    }
}

/**
 * End a hunt party and record history.
 * @param {Pawn} pawn
 * @param {boolean} success - Whether hunt was successful
 */
export function endHuntParty(pawn, success = false) {
    if (!pawn.huntParty) return

    const huntTarget = pawn.huntParty.targetId
    const partySize = pawn.huntParty.members.length

    // Record hunt history
    pawn.huntHistory.push({
        target: huntTarget,
        success,
        tick: pawn.world?.clock?.currentTick ?? 0,
        partySize
    })

    // Notify all members
    for (const memberId of pawn.huntParty.members) {
        const member = pawn.world?.entitiesMap?.get(memberId)
        if (member) {
            member.receiveGroupCommand({
                type: 'hunt_end',
                partyId: pawn.huntParty.partyId,
                success
            })
        }
    }

    // Clear hunt party
    pawn.huntParty = null
}
