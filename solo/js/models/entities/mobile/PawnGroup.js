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
 */
export function receiveGroupCommand(pawn, command) {
    if (!command?.type) return

    // Log received command
    pawn.addThought(`Received group command: ${command.type}`, 'social')

    // Execute command based on type
    switch (command.type) {
        case 'patrol':
            // Set patrol waypoints
            if (command.waypoints) {
                pawn.currentPatrolRoute = command.waypoints
            }
            break
        case 'defend':
            // Set defense position
            if (command.position) {
                pawn.currentDefensePosition = command.position
            }
            break
        case 'hunt':
            // Join hunt party
            if (command.partyId && command.targetLocation) {
                pawn.currentHuntParty = {
                    partyId: command.partyId,
                    targetLocation: command.targetLocation
                }
            }
            break
        case 'hunt_end':
            // Hunt ended
            pawn.currentHuntParty = null
            break
        default:
            // Unknown command type
            break
    }
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
