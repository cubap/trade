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

// ============================================================
// Occupation System: Profession drift and identity emergence
// ============================================================

/**
 * Occupation profiles derived from sustained behavior patterns.
 * Each occupation has skill weights, identity thresholds, and bonuses.
 */
const OCCUPATION_PROFILES = {
    forager: {
        description: 'Gathers wild resources and identifies edible plants',
        skillWeights: { gathering: 0.4, tracking: 0.2, survival: 0.2, planning: 0.2 },
        identityThreshold: 0.6,
        bonuses: { gathering: 1.15, tracking: 1.1, survival: 1.05 }
    },
    farmer: {
        description: 'Cultivates crops and manages agricultural resources',
        skillWeights: { gathering: 0.3, planning: 0.3, construction: 0.2, cooperation: 0.2 },
        identityThreshold: 0.6,
        bonuses: { gathering: 1.1, planning: 1.15, construction: 1.05 }
    },
    woodwright: {
        description: 'Crafts tools, weapons, and structures from wood',
        skillWeights: { crafting: 0.4, construction: 0.3, experimentation: 0.3 },
        identityThreshold: 0.6,
        bonuses: { crafting: 1.15, construction: 1.1, experimentation: 1.05 }
    },
    trader: {
        description: 'Negotiates exchanges and evaluates resource value',
        skillWeights: { bartering: 0.4, valuation: 0.3, cooperation: 0.15, planning: 0.15 },
        identityThreshold: 0.6,
        bonuses: { bartering: 1.15, valuation: 1.1, cooperation: 1.05 }
    },
    warrior: {
        description: 'Defends group and hunts large game',
        skillWeights: { fighting: 0.4, tracking: 0.2, strength: 0.2, survival: 0.2 },
        identityThreshold: 0.6,
        bonuses: { fighting: 1.15, tracking: 1.05, strength: 1.05 }
    },
    teacher: {
        description: 'Transfers knowledge and trains other pawns',
        skillWeights: { teaching: 0.4, cooperation: 0.3, planning: 0.3 },
        identityThreshold: 0.6,
        bonuses: { teaching: 1.15, cooperation: 1.1, planning: 1.05 }
    },
    artisan: {
        description: 'Creates specialized items and experiments with materials',
        skillWeights: { crafting: 0.3, experimentation: 0.3, planning: 0.2, bartering: 0.2 },
        identityThreshold: 0.6,
        bonuses: { crafting: 1.1, experimentation: 1.15, planning: 1.05 }
    },
    scout: {
        description: 'Explores territory and maps resources',
        skillWeights: { tracking: 0.3, survival: 0.3, planning: 0.2, gathering: 0.2 },
        identityThreshold: 0.6,
        bonuses: { tracking: 1.15, survival: 1.1, planning: 1.05 }
    }
}

/**
 * Get occupation profile definition.
 * @param {string} occupation - Occupation name
 * @returns {Object|null} Occupation profile or null
 */
export function getOccupationProfile(occupation) {
    return OCCUPATION_PROFILES[occupation] ?? null
}

/**
 * Get all occupation profiles.
 * @returns {Object} All occupation profiles
 */
export function getAllOccupationProfiles() {
    return OCCUPATION_PROFILES
}

/**
 * Calculate occupation alignment score for a pawn.
 * Measures how well the pawn's skills match an occupation's skill weights.
 * @param {Pawn} pawn
 * @param {string} occupation - Occupation name
 * @returns {number} Alignment score (0-1)
 */
export function getOccupationAlignment(pawn, occupation) {
    const profile = getOccupationProfile(occupation)
    if (!profile) return 0

    let weightedScore = 0
    let totalWeight = 0

    for (const [skill, weight] of Object.entries(profile.skillWeights)) {
        const skillValue = pawn.getSkill(skill) ?? 0
        weightedScore += skillValue * weight
        totalWeight += weight
    }

    // Normalize to 0-1 range (assuming max skill value ~100)
    return Math.min(1, weightedScore / (totalWeight * 100))
}

/**
 * Determine pawn's current occupation based on skill alignment.
 * @param {Pawn} pawn
 * @returns {string} Occupation name
 */
export function getCurrentOccupation(pawn) {
    let bestOccupation = 'forager' // Default
    let bestAlignment = 0

    for (const [occupation, profile] of Object.entries(OCCUPATION_PROFILES)) {
        const alignment = getOccupationAlignment(pawn, occupation)
        if (alignment > bestAlignment) {
            bestAlignment = alignment
            bestOccupation = occupation
        }
    }

    return bestOccupation
}

/**
 * Check if pawn has achieved identity threshold for an occupation.
 * @param {Pawn} pawn
 * @param {string} occupation - Occupation name
 * @returns {boolean} True if pawn meets identity threshold
 */
export function hasOccupationIdentity(pawn, occupation) {
    const profile = getOccupationProfile(occupation)
    if (!profile) return false

    const alignment = getOccupationAlignment(pawn, occupation)
    return alignment >= profile.identityThreshold
}

/**
 * Get specialization bonuses for pawn's current occupation.
 * @param {Pawn} pawn
 * @returns {Object} Skill bonus multipliers
 */
export function getOccupationBonuses(pawn) {
    const occupation = getCurrentOccupation(pawn)
    const profile = getOccupationProfile(occupation)

    return profile?.bonuses ?? {}
}

/**
 * Record a behavior signal toward an occupation.
 * Used to track repeated domain behavior for profession drift.
 * @param {Pawn} pawn
 * @param {string} occupation - Occupation the behavior supports
 * @param {number} magnitude - Strength of signal (0-1)
 */
export function recordBehaviorSignal(pawn, occupation, magnitude = 0.1) {
    if (!pawn.behaviorSignals) {
        pawn.behaviorSignals = {}
    }

    if (!pawn.behaviorSignals[occupation]) {
        pawn.behaviorSignals[occupation] = 0
    }

    pawn.behaviorSignals[occupation] += magnitude

    // Cap at 1.0
    pawn.behaviorSignals[occupation] = Math.min(1, pawn.behaviorSignals[occupation])
}

/**
 * Apply profession drift: gradually shift occupation based on behavior signals.
 * Called periodically to update pawn's occupation identity.
 * @param {Pawn} pawn
 * @param {number} driftRate - Rate of drift per tick (default 0.001)
 */
export function applyProfessionDrift(pawn, driftRate = 0.001) {
    if (!pawn.behaviorSignals) {
        pawn.behaviorSignals = {}
    }

    // Decay old signals slowly
    for (const [occupation, signal] of Object.entries(pawn.behaviorSignals)) {
        pawn.behaviorSignals[occupation] = Math.max(0, signal - driftRate)
    }

    // Check if current occupation still aligns with skills
    const currentOccupation = getCurrentOccupation(pawn)
    const currentAlignment = getOccupationAlignment(pawn, currentOccupation)

    // If alignment dropped below threshold, consider switching
    const profile = getOccupationProfile(currentOccupation)
    if (profile && currentAlignment < profile.identityThreshold * 0.8) {
        // Find next best occupation
        let bestOccupation = currentOccupation
        let bestAlignment = currentAlignment

        for (const [occupation] of Object.entries(OCCUPATION_PROFILES)) {
            if (occupation === currentOccupation) continue

            const alignment = getOccupationAlignment(pawn, occupation)
            if (alignment > bestAlignment) {
                bestAlignment = alignment
                bestOccupation = occupation
            }
        }

        // Only switch if new occupation is significantly better
        if (bestAlignment > currentAlignment * 1.2) {
            pawn.currentOccupation = bestOccupation
            pawn.addThought(`Drifting toward ${bestOccupation} identity`, 'specialization')
        }
    } else {
        pawn.currentOccupation = currentOccupation
    }
}

/**
 * Get demand signals from settlements and merchants.
 * Demand signals influence specialization direction.
 * @param {Pawn} pawn
 * @returns {Object} Demand signals by occupation
 */
export function getDemandSignals(pawn) {
    if (!pawn.world?.entitiesMap) return {}

    const demands = {}

    // Scan world for settlement/merchant demand signals
    for (const entity of pawn.world.entitiesMap.values()) {
        if (entity.demands) {
            for (const [occupation, demand] of Object.entries(entity.demands)) {
                demands[occupation] = (demands[occupation] ?? 0) + demand
            }
        }
    }

    return demands
}

/**
 * Get recommended occupation based on demand signals and current skills.
 * @param {Pawn} pawn
 * @returns {string} Recommended occupation
 */
export function getRecommendedOccupation(pawn) {
    const demands = getDemandSignals(pawn)
    const currentOccupation = getCurrentOccupation(pawn)

    // If there's high demand for a different occupation, consider switching
    let bestOccupation = currentOccupation
    let bestScore = getOccupationAlignment(pawn, currentOccupation)

    for (const [occupation, demand] of Object.entries(demands)) {
        const alignment = getOccupationAlignment(pawn, occupation)
        const score = alignment * (1 + demand * 0.5) // Demand boosts score

        if (score > bestScore) {
            bestScore = score
            bestOccupation = occupation
        }
    }

    return bestOccupation
}

/**
 * Get occupation label for display.
 * @param {Pawn} pawn
 * @returns {string} Occupation label
 */
export function getOccupationLabel(pawn) {
    const occupation = getCurrentOccupation(pawn)
    const profile = getOccupationProfile(occupation)

    return profile?.description ?? occupation
}

/**
 * Check if pawn should receive occupation bonus for an activity.
 * @param {Pawn} pawn
 * @param {string} activity - Activity type (skill name)
 * @returns {boolean} True if pawn gets bonus for this activity
 */
export function hasOccupationBonus(pawn, activity) {
    const bonuses = getOccupationBonuses(pawn)
    return (bonuses[activity] ?? 1) > 1
}

/**
 * Get occupation bonus multiplier for an activity.
 * @param {Pawn} pawn
 * @param {string} activity - Activity type (skill name)
 * @returns {number} Bonus multiplier (1.0 = no bonus)
 */
export function getOccupationBonusMultiplier(pawn, activity) {
    const bonuses = getOccupationBonuses(pawn)
    return bonuses[activity] ?? 1.0
}
