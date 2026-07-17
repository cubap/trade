/**
 * Pawn tactical systems: territory memory, patrol routes, defense assignments.
 */

/**
 * Record a tactical memory entry.
 * @param {Pawn} pawn
 * @param {string} type - Memory type: 'territory', 'route', 'threat', 'resource'
 * @param {Object} location - {x, y} coordinates
 * @param {string} description
 * @param {number} significance - Importance level (0-1)
 */
export function recordTacticalMemory(pawn, type, location, description, significance = 0.5) {
    if (pawn.tacticalMemory.length >= pawn.maxTacticalMemory) {
        // Remove oldest least significant entry
        pawn.tacticalMemory.sort((a, b) => (a.significance ?? 0) - (b.significance ?? 0))
        pawn.tacticalMemory.shift()
    }

    pawn.tacticalMemory.push({
        type,
        location,
        description,
        tick: pawn.world?.clock?.currentTick ?? 0,
        significance
    })
}

/**
 * Update tactical memory: decay old memories, update territory landmarks.
 * @param {Pawn} pawn
 * @param {number} tick - Current game tick
 */
export function updateTacticalMemory(pawn, tick) {
    // Decay old memories
    const decayPeriod = 500 // Ticks before memory starts decaying
    const decayRate = 0.001 // Per tick after decay period

    for (const memory of pawn.tacticalMemory) {
        const age = tick - memory.tick
        if (age > decayPeriod) {
            memory.significance = Math.max(0, memory.significance - decayRate * (age - decayPeriod))
        }
    }

    // Remove insignificant memories
    pawn.tacticalMemory = pawn.tacticalMemory.filter(m => m.significance > 0.05)

    // Update territory landmarks
    updateTerritoryLandmarks(pawn)
}

/**
 * Get territory memories for patrol/defense decisions.
 * @param {Pawn} pawn
 * @param {number} minSignificance - Minimum significance threshold
 * @returns {Array} Territory memories
 */
export function getTerritoryMemories(pawn, minSignificance = 0.3) {
    return pawn.tacticalMemory.filter(m =>
        m.type === 'territory' && m.significance >= minSignificance
    )
}

/**
 * Update territory landmarks from significant memories.
 * @param {Pawn} pawn
 */
export function updateTerritoryLandmarks(pawn) {
    const territoryMemories = getTerritoryMemories(pawn, 0.5)
    pawn.territoryLandmarks = territoryMemories.map(m => ({
        x: m.location.x,
        y: m.location.y,
        type: m.type,
        significance: m.significance,
        claimedAt: m.tick
    }))
}

/**
 * Assign a patrol route to a group member.
 * @param {Pawn} pawn - Leader assigning the route
 * @param {Pawn} member - Member to assign
 * @param {Array} waypoints - Array of {x, y} waypoints
 * @returns {string} Route ID
 */
export function assignPatrolRoute(pawn, member, waypoints) {
    const routeId = `route_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    pawn.patrolRoutes[routeId] = {
        waypoints,
        assignedAt: pawn.world?.clock?.currentTick ?? 0,
        active: true,
        assignedTo: member.id
    }

    // Notify member
    if (member) {
        member.receiveGroupCommand({
            type: 'patrol',
            waypoints,
            routeId
        })
    }

    return routeId
}

/**
 * Assign a defense position to a group member.
 * @param {Pawn} pawn - Leader assigning the position
 * @param {Pawn} member - Member to assign
 * @param {Object} position - {x, y} position to defend
 * @returns {string} Assignment ID
 */
export function assignDefensePosition(pawn, member, position) {
    const assignmentId = `defense_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    pawn.defenseAssignments[assignmentId] = {
        position,
        assignedAt: pawn.world?.clock?.currentTick ?? 0,
        active: true,
        assignedTo: member.id
    }

    // Notify member
    if (member) {
        member.receiveGroupCommand({
            type: 'defend',
            position,
            assignmentId
        })
    }

    return assignmentId
}
