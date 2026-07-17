/**
 * Pawn specialization systems: job assignments, role-based behavior.
 * 
 * Manages pawn's assigned roles within a settlement, including
 * specialization bonuses and role-specific responsibilities.
 */

/**
 * Assign a job role to a pawn.
 * 
 * @param {Pawn} pawn - The pawn to assign a role to
 * @param {string} role - Role name: 'builder', 'farmer', 'guard', 'merchant', 'teacher', 'artisan'
 * @param {Object} settlement - Settlement object tracking assignments
 * @returns {Object} The created assignment
 */
export function assignRole(pawn, role, settlement) {
    if (!settlement.assignments) settlement.assignments = {}

    const assignment = {
        id: `role_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        pawnId: pawn.id,
        role,
        assignedAt: Date.now(),
        performance: 0
    }

    settlement.assignments[pawn.id] = assignment
    pawn.currentRole = role
    pawn.addThought(`Assigned as ${role}`, 'civic')

    return assignment
}

/**
 * Remove a pawn's job role assignment.
 * 
 * @param {Pawn} pawn - The pawn to remove the role from
 * @param {Object} settlement - Settlement object tracking assignments
 */
export function removeRole(pawn, settlement) {
    if (!settlement?.assignments) return

    delete settlement.assignments[pawn.id]
    pawn.currentRole = null
    pawn.addThought(`Role assignment removed`, 'civic')
}

/**
 * Get all pawns assigned to a specific role.
 * 
 * @param {Object} settlement - Settlement object
 * @param {string} role - Role name to filter by
 * @returns {Object[]} Array of assignments for this role
 */
export function getRoleMembers(settlement, role) {
    if (!settlement?.assignments) return []

    return Object.values(settlement.assignments).filter(a => a.role === role)
}

/**
 * Check if a pawn has a specific role.
 * 
 * @param {Pawn} pawn - The pawn to check
 * @param {string} role - Role name to check for
 * @returns {boolean} True if pawn has this role
 */
export function hasRole(pawn, role) {
    return pawn.currentRole === role
}

/**
 * Apply specialization bonuses based on pawn's role.
 * 
 * @param {Pawn} pawn - The pawn to apply bonuses to
 * @returns {Object} Bonus multipliers for relevant skills
 */
export function getSpecializationBonuses(pawn) {
    const bonuses = {}

    switch (pawn.currentRole) {
        case 'builder':
            bonuses.construction = 1.2
            bonuses.strength = 1.1
            break
        case 'farmer':
            bonuses.gathering = 1.2
            bonuses.planning = 1.1
            break
        case 'guard':
            bonuses.fighting = 1.2
            bonuses.strength = 1.1
            break
        case 'merchant':
            bonuses.bartering = 1.2
            bonuses.valuation = 1.1
            break
        case 'teacher':
            bonuses.teaching = 1.2
            bonuses.cooperation = 1.1
            break
        case 'artisan':
            bonuses.crafting = 1.2
            bonuses.experimentation = 1.1
            break
    }

    return bonuses
}

/**
 * Recommend a role for a pawn based on their skills.
 * 
 * @param {Pawn} pawn - The pawn to recommend a role for
 * @returns {string} Recommended role name
 */
export function recommendRole(pawn) {
    const skills = {
        construction: pawn.getSkill('construction'),
        gathering: pawn.getSkill('gathering'),
        fighting: pawn.getSkill('fighting'),
        bartering: pawn.getSkill('bartering'),
        teaching: pawn.getSkill('teaching'),
        crafting: pawn.getSkill('crafting')
    }

    // Find highest skill
    const highestSkill = Object.entries(skills).sort((a, b) => b[1] - a[1])[0]

    const roleMap = {
        construction: 'builder',
        gathering: 'farmer',
        fighting: 'guard',
        bartering: 'merchant',
        teaching: 'teacher',
        crafting: 'artisan'
    }

    return roleMap[highestSkill[0]] ?? 'builder'
}

/**
 * Check if a settlement has enough members for a role.
 * 
 * @param {Object} settlement - Settlement object
 * @param {string} role - Role to check
 * @param {number} minMembers - Minimum members required (default 1)
 * @returns {boolean} True if settlement has enough members for this role
 */
export function canAssignRole(settlement, role, minMembers = 1) {
    const members = getRoleMembers(settlement, role)
    return members.length >= minMembers
}
