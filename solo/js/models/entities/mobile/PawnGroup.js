/**
 * Pawn group systems: group commands, leadership, member management.
 */

/**
 * Send a group command to a member.
 * @param {Pawn} pawn - Leader sending the command
 * @param {Pawn} member - Member receiving the command
 * @param {Object} command - Command object with type and parameters
 */
export function sendGroupCommand(pawn, member, command) {
    if (!member) return

    member.receiveGroupCommand(command)
}

/**
 * Receive a group command from a leader.
 * @param {Pawn} pawn - Member receiving the command
 * @param {Object} command - Command object with type and parameters
 * @param {Pawn} issuedByPawn - Leader issuing the command
 * @returns {boolean} True if the command was accepted
 */
export function receiveGroupCommand(pawn, command, issuedByPawn) {
    if (!command?.type) return false

    // Validate command issuer
    if (!issuedByPawn?.id) return false
    if (issuedByPawn.id === pawn.id) return false

    // Must be in the same group with the issuer as leader
    if (!pawn.groupState?.id || pawn.groupState.id !== issuedByPawn.groupState?.id) return false
    if (pawn.groupState.leaderId !== issuedByPawn.id) return false

    // Trust check
    const minTrust = command.minTrust ?? 0.05
    const trust = pawn.getGroupTrustIn?.(issuedByPawn) ?? 0
    if (trust < minTrust) return false

    // Log received command
    pawn.addThought(`Received group command: ${command.type}`, 'social')

    // Queue the command for later goal conversion
    const queuedCommand = {
        ...command,
        issuedBy: issuedByPawn.id,
        issuedAt: command.issuedAt ?? Date.now()
    }
    pawn.groupCommandQueue.push(queuedCommand)

    return true
}

/**
 * Get all members of a pawn's group.
 * @param {Pawn} pawn
 * @returns {Array} Group members
 */
export function getGroupMembers(pawn) {
    if (!pawn.world?.entitiesMap) return []

    const members = []
    for (const [id, trust] of Object.entries(pawn.groupTrust)) {
        if (trust > 0.2) {
            const member = pawn.world.entitiesMap.get(id)
            if (member) {
                members.push(member)
            }
        }
    }

    return members
}

/**
 * Check if pawn is a leader (has active patrol routes or defense assignments).
 * @param {Pawn} pawn
 * @returns {boolean} True if pawn is a leader
 */
export function isLeader(pawn) {
    return Object.keys(pawn.patrolRoutes).length > 0 ||
           Object.keys(pawn.defenseAssignments).length > 0
}

/**
 * Get active patrol routes.
 * @param {Pawn} pawn
 * @returns {Array} Active patrol routes
 */
export function getActivePatrolRoutes(pawn) {
    return Object.values(pawn.patrolRoutes).filter(r => r.active)
}

/**
 * Get active defense assignments.
 * @param {Pawn} pawn
 * @returns {Array} Active defense assignments
 */
export function getActiveDefenseAssignments(pawn) {
    return Object.values(pawn.defenseAssignments).filter(a => a.active)
}
