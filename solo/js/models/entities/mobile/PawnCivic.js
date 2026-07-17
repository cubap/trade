/**
 * Pawn civic/government systems (Phase 2).
 * Proto-settlement detection, encampment landmarks, civic reputation, job board, curriculum.
 */

/**
 * Check if this pawn can form a proto-settlement (social group).
 * Proto-settlement is the social bond, not the physical footprint.
 * @param {Pawn} pawn
 * @returns {Object|null} Proto-settlement trigger or null
 */
export function checkProtoSettlementTrigger(pawn) {
    if (!pawn.world?.entitiesMap) return null

    const otherPawns = Array.from(pawn.world.entitiesMap.values()).filter(e =>
        e?.subtype === 'pawn' && e.id !== pawn.id
    )

    if (otherPawns.length < 2) return null // Need 3+ total for proto-settlement

    // Find pawns with trust >= 0.2
    const trustedPawns = otherPawns.filter(p => {
        const trust = pawn.getGroupTrustIn(p) ?? 0
        return trust >= 0.2
    })

    if (trustedPawns.length < 2) return null // Need 2+ trusted (3+ total)

    // Check for shared shelter structure nearby
    const shelterRadius = 50
    const nearbyStructures = pawn.getNearbyEntities(shelterRadius).filter(e =>
        e?.tags?.has?.('shelter') || e?.tags?.includes?.('shelter')
    )

    if (nearbyStructures.length === 0) return null

    // Check resource richness (food, water, materials within radius)
    const resourceRadius = 100
    const resourceRichness = getResourceRichness(pawn, resourceRadius)

    if (resourceRichness < 0.3) return null // Too poor for settlement

    // Calculate average mutual trust
    const avgTrust = trustedPawns.reduce((sum, p) => sum + (pawn.getGroupTrustIn(p) ?? 0), 0) / trustedPawns.length

    // Canonize encampment landmark
    const shelter = nearbyStructures[0]
    pawn.encampmentLandmark = {
        x: shelter.x,
        y: shelter.y,
        tick: pawn.world.clock.currentTick,
        groupMembers: new Set([pawn.id, ...trustedPawns.map(p => p.id)]),
        resourceRichness,
        canonized: false
    }

    return {
        type: 'proto_settlement',
        initiatorId: pawn.id,
        members: [pawn, ...trustedPawns],
        shelterLocation: { x: shelter.x, y: shelter.y },
        resourceRichness,
        avgTrust
    }
}

/**
 * Calculate resource richness within radius (0-1 scale).
 * @param {Pawn} pawn
 * @param {number} radius
 * @returns {number} Resource richness score
 */
export function getResourceRichness(pawn, radius = 100) {
    const nearby = pawn.getNearbyEntities(radius)
    let score = 0

    for (const entity of nearby) {
        const tags = entity.tags
        if (!tags) continue

        if (tags.has?.('food') || tags.includes?.('food')) score += 0.3
        if (tags.has?.('water') || tags.includes?.('water')) score += 0.3
        if (tags.has?.('material') || tags.includes?.('material')) score += 0.1
        if (tags.has?.('resource') || tags.includes?.('resource')) score += 0.1
    }

    return Math.min(1, score)
}

/**
 * Canonize encampment landmark when communal storage is created.
 * Makes the settlement discoverable to new pawns.
 * @param {Pawn} pawn
 * @param {ResourceCache} cache
 */
export function canonizeEncampment(pawn, cache) {
    if (!pawn.encampmentLandmark || !cache) return

    pawn.encampmentLandmark.canonized = true
    pawn.isSettlementDiscoverable = true

    // Notify all group members
    if (pawn.encampmentLandmark.groupMembers) {
        for (const memberId of pawn.encampmentLandmark.groupMembers) {
            const member = pawn.world?.entitiesMap?.get(memberId)
            if (member && member.id !== pawn.id) {
                member.rememberLandmark({
                    x: pawn.encampmentLandmark.x,
                    y: pawn.encampmentLandmark.y,
                    type: 'encampment',
                    significance: 1,
                    name: 'Settlement Encampment',
                    event: 'canonized'
                })
            }
        }
    }

    pawn.addThought('Our encampment is now a recognized settlement.', 'civic')
}

/**
 * Add a civic contribution to the ledger.
 * @param {Pawn} pawn
 * @param {string} type - Contribution type: 'build', 'supply', 'defend', 'tax'
 * @param {number} amount
 */
export function recordCivicContribution(pawn, type, amount = 1) {
    if (!pawn.encampmentLandmark) return

    pawn.civicLedger.push({
        type,
        pawnId: pawn.id,
        amount,
        tick: pawn.world?.clock?.currentTick ?? 0
    })

    // Update civic reputation for this pawn
    const currentRep = pawn.civicReputation[pawn.id] ?? 0
    pawn.civicReputation[pawn.id] = currentRep + amount

    // Update civic score
    updateCivicScore(pawn)
}

/**
 * Update civic score based on structures, governance, stability, and compliance.
 * @param {Pawn} pawn
 */
export function updateCivicScore(pawn) {
    if (!pawn.encampmentLandmark) return

    // Structure count and variety
    const nearbyStructures = pawn.getNearbyEntities(100).filter(e =>
        e?.tags?.has?.('structure') || e?.tags?.includes?.('structure')
    )
    const structureScore = Math.min(5, nearbyStructures.length * 0.5)

    // Governance model sophistication
    const governanceScores = {
        'none': 0,
        'consensus': 1,
        'appointed': 2,
        'elective': 3,
        'weighted': 4
    }
    const governanceScore = governanceScores[pawn.governanceModel] ?? 0

    // Stability index (simplified: trust + resource richness)
    const avgTrust = getAverageGroupTrust(pawn)
    const stabilityScore = avgTrust * 2 + pawn.encampmentLandmark.resourceRichness

    // Law token compliance (simplified: ledger size vs group size)
    const groupSize = pawn.encampmentLandmark.groupMembers?.size ?? 1
    const complianceScore = Math.min(3, pawn.civicLedger.length / groupSize)

    pawn.civicScore = structureScore + governanceScore + stabilityScore + complianceScore
}

/**
 * Get average trust among group members.
 * @param {Pawn} pawn
 * @returns {number} Average trust score
 */
export function getAverageGroupTrust(pawn) {
    if (!pawn.encampmentLandmark?.groupMembers || pawn.encampmentLandmark.groupMembers.size < 2) return 0

    const members = Array.from(pawn.encampmentLandmark.groupMembers)
    let totalTrust = 0
    let pairs = 0

    for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            const trust = pawn.getGroupTrustIn(pawn.world?.entitiesMap?.get(members[j])) ?? 0
            totalTrust += trust
            pairs++
        }
    }

    return pairs > 0 ? totalTrust / pairs : 0
}

/**
 * Post a job to the job board.
 * @param {Pawn} pawn
 * @param {string} type - Job type: 'build', 'gather', 'defend', 'craft'
 * @param {number} reward
 * @param {number} deadline - Ticks until deadline
 * @returns {Object|null} Job object or null
 */
export function postJob(pawn, type, reward = 1, deadline = 100) {
    if (!pawn.encampmentLandmark) return null

    const taskId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const job = {
        taskId,
        type,
        assignedTo: null,
        deadline: pawn.world?.clock?.currentTick + deadline,
        reward,
        completed: false,
        postedBy: pawn.id,
        postedAt: pawn.world?.clock?.currentTick
    }

    pawn.jobBoard.push(job)
    return job
}

/**
 * Accept a job from the job board.
 * @param {Pawn} pawn
 * @param {string} taskId
 * @returns {Object|null} Job object or null
 */
export function acceptJob(pawn, taskId) {
    const job = pawn.jobBoard.find(j => j.taskId === taskId && !j.completed && !j.assignedTo)
    if (!job) return null

    job.assignedTo = pawn.id
    pawn.addThought(`Accepted job: ${job.type} (reward: ${job.reward})`, 'civic')
    return job
}

/**
 * Complete a job on the job board.
 * @param {Pawn} pawn
 * @param {string} taskId
 * @returns {boolean} True if job was completed
 */
export function completeJob(pawn, taskId) {
    const job = pawn.jobBoard.find(j => j.taskId === taskId && j.assignedTo === pawn.id)
    if (!job) return false

    job.completed = true
    recordCivicContribution(pawn, job.type, job.reward)

    // Award reward to poster
    const poster = pawn.world?.entitiesMap?.get(job.postedBy)
    if (poster) {
        recordCivicContribution(poster, 'tax', job.reward * 0.1) // Small tax for governance
    }

    pawn.addThought(`Completed job: ${job.type} (reward: ${job.reward})`, 'civic')
    return true
}

/**
 * Add a lesson to the curriculum.
 * @param {Pawn} pawn
 * @param {string} skill
 * @param {string|null} prerequisite
 * @param {number} xp
 * @returns {Object} Lesson object
 */
export function addCurriculumLesson(pawn, skill, prerequisite = null, xp = 1) {
    const lessonId = `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const lesson = {
        lessonId,
        skill,
        prerequisite,
        xp,
        scheduledAt: pawn.world?.clock?.currentTick,
        completed: false
    }

    pawn.curriculum.push(lesson)
    return lesson
}

/**
 * Complete a curriculum lesson.
 * @param {Pawn} pawn
 * @param {string} lessonId
 * @returns {boolean} True if lesson was completed
 */
export function completeCurriculumLesson(pawn, lessonId) {
    const lesson = pawn.curriculum.find(l => l.lessonId === lessonId && !l.completed)
    if (!lesson) return false

    // Check prerequisite
    if (lesson.prerequisite) {
        const prereqLesson = pawn.curriculum.find(l => l.skill === lesson.prerequisite)
        if (prereqLesson && !prereqLesson.completed) {
            pawn.addThought(`Cannot complete ${lesson.skill} — prerequisite ${lesson.prerequisite} not met.`, 'civic')
            return false
        }
    }

    lesson.completed = true

    // Award XP to student (this pawn)
    pawn.gainSkill(lesson.skill, lesson.xp)

    pawn.addThought(`Completed lesson: ${lesson.skill} (+${lesson.xp} XP)`, 'civic')
    return true
}
