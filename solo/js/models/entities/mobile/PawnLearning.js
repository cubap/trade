/**
 * PawnLearning.js - Skill transfer between pawns
 *
 * Three modes of knowledge transfer:
 * - **Teaching** — teacher's full attention, fastest student learning
 * - **Observing** — student watches teacher work, slowest learning, teacher unaffected
 * - **Apprenticing** — student works alongside teacher, moderate learning, teacher slowed
 *
 * Bonuses:
 * - Teacher's `teaching` skill boosts all modes
 * - Trust between teacher and student boosts all modes
 * - School structure boosts teaching/observing
 * - Workshop structure boosts apprenticing
 * - Apprentice can learn skills the teacher has that the student hasn't unlocked yet
 */

/**
 * Calculate the base learning rate for a skill transfer.
 * @param {Pawn} teacher - The teaching pawn
 * @param {Pawn} student - The learning pawn
 * @param {string} skill - The skill being transferred
 * @returns {number} Base rate before mode and bonus multipliers
 */
export function getBaseLearningRate(teacher, student, skill) {
    const teacherLevel = teacher.getSkill(skill)
    const studentLevel = student.getSkill(skill)

    // Gap between teacher and student: larger gap = faster initial learning
    const gap = Math.max(0, teacherLevel - studentLevel)
    // Diminishing returns as student approaches teacher level
    const gapFactor = gap > 0 ? Math.min(1, gap / 10) : 0.3

    return 0.05 * gapFactor
}

/**
 * Calculate the teaching skill bonus multiplier.
 * @param {Pawn} teacher - The teaching pawn
 * @returns {number} Multiplier (1.0 = no bonus)
 */
export function getTeachingSkillBonus(teacher) {
    const teaching = teacher.getSkill('teaching')
    // Each point of teaching skill adds 5% to learning rate
    return 1 + teaching * 0.05
}

/**
 * Calculate the trust bonus multiplier between teacher and student.
 * @param {Pawn} teacher - The teaching pawn
 * @param {Pawn} student - The learning pawn
 * @returns {number} Multiplier (1.0 = no bonus, 0.5 = distrust penalty)
 */
export function getTrustBonus(teacher, student) {
    const trust = teacher.getGroupTrustIn(student) ?? 0
    // Trust 0 → 1.0x, trust 1 → 1.3x, trust -1 → 0.5x
    return 0.5 + trust * 0.65
}

/**
 * Calculate the structure bonus multiplier for the given mode.
 * - School boosts teaching and observing
 * - Workshop boosts apprenticing
 * @param {Pawn} teacher - The teaching pawn (used for location)
 * @param {Pawn} student - The learning pawn (used for location)
 * @param {string} mode - 'teaching', 'observing', or 'apprenticing'
 * @returns {number} Multiplier (1.0 = no bonus)
 */
export function getStructureBonus(teacher, student, mode) {
    const pawn = mode === 'teaching' ? teacher : student
    if (!pawn.world) return 1

    // Find nearby structure by scanning world entities
    let nearby = null
    for (const entity of pawn.world.entities) {
        if (entity.subtype !== 'structure') continue
        const dist = Math.sqrt((pawn.x - entity.x) ** 2 + (pawn.y - entity.y) ** 2)
        if (dist <= 30) {
            nearby = entity
            break
        }
    }

    if (!nearby) return 1

    const tags = nearby.tags
    const hasTag = t => Array.isArray(tags) ? tags.includes(t) : (typeof tags?.has === 'function' ? tags.has(t) : false)

    if (mode === 'apprenticing' && hasTag('workshop')) {
        // Workshop: +40% to apprenticing
        return 1.4
    }

    if ((mode === 'teaching' || mode === 'observing') && hasTag('school')) {
        // School: +30% to teaching/observing
        return 1.3
    }

    return 1
}

/**
 * Execute one tick of teaching.
 * Teacher gives full attention — cannot do other work.
 * Student learns at the fastest rate.
 * @param {Pawn} teacher - The teaching pawn
 * @param {Pawn} student - The learning pawn
 * @param {string} skill - The skill being taught
 */
export function teach(teacher, student, skill) {
    const base = getBaseLearningRate(teacher, student, skill)
    const teachingBonus = getTeachingSkillBonus(teacher)
    const trustBonus = getTrustBonus(teacher, student)
    const structureBonus = getStructureBonus(teacher, student, 'teaching')

    const rate = base * teachingBonus * trustBonus * structureBonus

    // Student learns
    student.increaseSkill(skill, rate)
    // Teacher reinforces their own skill and gains teaching skill
    teacher.increaseSkill(skill, rate * 0.1)
    teacher.increaseSkill('teaching', rate * 0.05)
}

/**
 * Execute one tick of observing.
 * Student watches teacher work — teacher is unaffected and can continue working.
 * Student learns at the slowest rate.
 * Cannot learn a skill the student hasn't unlocked yet.
 * @param {Pawn} teacher - The teaching pawn (continues working)
 * @param {Pawn} student - The observing pawn
 * @param {string} skill - The skill being observed
 */
export function observe(teacher, student, skill) {
    // Observing cannot unlock new skills — student must already have the skill
    if (student.getSkill(skill) === 0 && !student.unlocked?.skills?.has(skill)) {
        return
    }

    const base = getBaseLearningRate(teacher, student, skill)
    const teachingBonus = getTeachingSkillBonus(teacher)
    const trustBonus = getTrustBonus(teacher, student)
    const structureBonus = getStructureBonus(teacher, student, 'observing')

    // Observing is 40% of base rate (slowest mode)
    const rate = base * 0.4 * teachingBonus * trustBonus * structureBonus

    student.increaseSkill(skill, rate)
}

/**
 * Execute one tick of apprenticing.
 * Student works alongside teacher — teacher is slowed but can continue working.
 * Student learns at a moderate rate.
 * Can learn skills the student hasn't unlocked yet (unlike observing).
 * @param {Pawn} teacher - The teaching pawn (work speed reduced)
 * @param {Pawn} student - The apprenticing pawn
 * @param {string} skill - The skill being apprenticed
 */
export function apprentice(teacher, student, skill) {
    const base = getBaseLearningRate(teacher, student, skill)
    const teachingBonus = getTeachingSkillBonus(teacher)
    const trustBonus = getTrustBonus(teacher, student)
    const structureBonus = getStructureBonus(teacher, student, 'apprenticing')

    // Apprenticing is 70% of base rate (moderate, between observing and teaching)
    const rate = base * 0.7 * teachingBonus * trustBonus * structureBonus

    // Student learns
    student.increaseSkill(skill, rate)
    // Teacher's work speed is reduced by 30% while apprenticing
    teacher._apprenticeSlowdown = 0.7
    // Teacher gains teaching skill from mentoring
    teacher.increaseSkill('teaching', rate * 0.03)
}

/**
 * Clear the apprentice slowdown on a teacher (called when apprenticing ends).
 * @param {Pawn} teacher - The teaching pawn
 */
export function clearApprenticeSlowdown(teacher) {
    delete teacher._apprenticeSlowdown
}

/**
 * Get the effective work speed multiplier for a pawn.
 * If the pawn is teaching a skill (full attention), work speed is 0.
 * If the pawn is apprenticing with a student, work speed is reduced.
 * @param {Pawn} pawn - The pawn to check
 * @returns {number} Work speed multiplier (0-1)
 */
export function getWorkSpeedMultiplier(pawn) {
    // Teaching = full attention, no other work
    if (pawn.behaviorState === 'teaching') {
        return 0
    }

    // Apprenticing = slowed
    if (pawn._apprenticeSlowdown !== undefined) {
        return pawn._apprenticeSlowdown
    }

    return 1
}

/**
 * Find the best teacher for a student in range.
 * @param {Pawn} student - The learning pawn
 * @param {string} skill - The skill to learn
 * @param {number} range - Search radius
 * @returns {Pawn|null} Best available teacher or null
 */
export function findTeacher(student, skill, range = 50) {
    if (!student.world) return null

    let best = null
    let bestLevel = 0

    for (const entity of student.world.entities) {
        if (entity.subtype !== 'pawn' || entity.id === student.id) continue

        const dist = Math.sqrt((student.x - entity.x) ** 2 + (student.y - entity.y) ** 2)
        if (dist > range) continue

        const level = entity.getSkill(skill)
        if (level > bestLevel && level > student.getSkill(skill)) {
            bestLevel = level
            best = entity
        }
    }

    return best
}

/**
 * Check if a pawn is available to teach (not busy with another activity).
 * @param {Pawn} pawn - The potential teacher
 * @returns {boolean}
 */
export function isAvailableToTeach(pawn) {
    // A pawn teaching is already occupied
    if (pawn.behaviorState === 'teaching') return false
    // A pawn apprenticing with someone can still teach (different skill)
    return true
}

/**
 * Establish a mentor-apprentice relationship between two pawns.
 * The mentor commits to teaching the apprentice specific skills.
 * @param {Pawn} mentor - The teaching pawn
 * @param {Pawn} apprentice - The learning pawn
 * @param {string[]} skills - Skills the mentor will teach
 */
export function establishMentorship(mentor, apprentice, skills = []) {
    mentor.mentorOf = mentor.mentorOf ?? new Map()
    apprentice.mentorOf = apprentice.mentorOf ?? new Map()

    mentor.mentorOf.set(apprentice.id, {
        skills,
        startedAt: mentor.world?.clock?.currentTick,
        lessonsCompleted: 0
    })

    apprentice.mentorOf = mentor.id

    mentor.addThought?.(`Mentoring ${apprentice.name} in ${skills.join(', ') || 'various skills'}`, 'social')
    apprentice.addThought?.(`Apprenticed to ${mentor.name}`, 'social')
}

/**
 * Dissolve a mentor-apprentice relationship.
 * @param {Pawn} mentor - The teaching pawn
 * @param {Pawn} apprentice - The learning pawn
 */
export function dissolveMentorship(mentor, apprentice) {
    mentor.mentorOf?.delete(apprentice.id)
    if (apprentice.mentorOf === mentor.id) {
        delete apprentice.mentorOf
    }

    mentor.addThought?.(`Mentorship with ${apprentice.name} ended`, 'social')
    apprentice.addThought?.(`No longer apprenticed to ${mentor.name}`, 'social')
}

/**
 * Check if two pawns have an active mentor-apprentice relationship.
 * @param {Pawn} mentor - Potential mentor
 * @param {Pawn} apprentice - Potential apprentice
 * @returns {boolean}
 */
export function isMentorOf(mentor, apprentice) {
    return mentor.mentorOf?.has(apprentice.id) ?? false
}

/**
 * Get the mentor for an apprentice pawn.
 * @param {Pawn} apprentice - The learning pawn
 * @returns {Pawn|null} The mentor or null
 */
export function getMentor(apprentice, world) {
    if (!apprentice.mentorOf || !world) return null
    return world.entitiesMap?.get(apprentice.mentorOf) ?? null
}

/**
 * Record a completed lesson in a mentorship relationship.
 * @param {Pawn} mentor - The teaching pawn
 * @param {Pawn} apprentice - The learning pawn
 * @param {string} skill - The skill taught
 */
export function recordLessonCompleted(mentor, apprentice, skill) {
    const record = mentor.mentorOf?.get(apprentice.id)
    if (record) {
        record.lessonsCompleted++
    }
}

/**
 * Recommend a learning mode based on pawn states and context.
 * - Teaching: when pawn has high skill and a mentorship bond
 * - Apprenticing: when pawn has a mentor and wants to learn while working
 * - Observing: when pawn wants to learn without disrupting the teacher
 * @param {Pawn} pawn - The pawn choosing a learning mode
 * @param {Pawn} target - The other pawn involved
 * @param {string} skill - The skill in question
 * @returns {string} 'teaching', 'apprenticing', or 'observing'
 */
export function recommendLearningMode(pawn, target, skill) {
    // If pawn is the mentor, prefer teaching
    if (isMentorOf(pawn, target)) {
        return 'teaching'
    }

    // If pawn has a mentor and it's this target, prefer apprenticing
    if (pawn.mentorOf === target.id) {
        return 'apprenticing'
    }

    // If pawn is significantly less skilled, apprenticing allows new skill discovery
    if (pawn.getSkill(skill) === 0 && target.getSkill(skill) > 0) {
        return 'apprenticing'
    }

    // Default to observing for minimal disruption
    return 'observing'
}

/**
 * Select the best learning goal for a pawn based on current state.
 * Considers mentor relationships, skill gaps, and available teachers.
 * @param {Pawn} pawn - The pawn selecting a goal
 * @param {number} range - Search radius for potential teachers
 * @returns {Object|null} Goal object or null if no learning goal appropriate
 */
export function selectLearningGoal(pawn, range = 50) {
    // If pawn has a mentor, prioritize learning from them
    const mentor = getMentor(pawn, pawn.world)
    if (mentor) {
        const dist = Math.sqrt((pawn.x - mentor.x) ** 2 + (pawn.y - mentor.y) ** 2)
        if (dist <= range) {
            // Find a skill the mentor has that pawn lacks
            const mentorSkills = Object.entries(mentor.skills).sort((a, b) => b[1] - a[1])
            for (const [skill, level] of mentorSkills) {
                if (level > pawn.getSkill(skill)) {
                    return {
                        type: 'apprentice_skill',
                        skill,
                        target: mentor,
                        priority: 3,
                        description: `Apprentice ${skill} under ${mentor.name}`,
                        duration: 80
                    }
                }
            }
        }
    }

    // If pawn is a mentor to someone nearby, teach them
    if (pawn.mentorOf) {
        for (const [appId, record] of pawn.mentorOf) {
            const apprentice = pawn.world?.entitiesMap?.get(appId)
            if (!apprentice) continue

            const dist = Math.sqrt((pawn.x - apprentice.x) ** 2 + (pawn.y - apprentice.y) ** 2)
            if (dist <= range) {
                // Find a skill to teach from the mentorship record
                const skill = record.skills?.[0] || Object.entries(pawn.skills)
                    .sort((a, b) => b[1] - a[1])[0]?.[0]

                if (skill && pawn.getSkill(skill) > apprentice.getSkill(skill)) {
                    return {
                        type: 'teach_skill',
                        skill,
                        target: apprentice,
                        priority: 3,
                        description: `Teach ${skill} to ${apprentice.name}`,
                        duration: 100
                    }
                }
            }
        }
    }

    // If pawn has discovered solutions, teach them to nearby pawns
    if (pawn.discoveredSolutions?.size > 0) {
        for (const entity of pawn.world.entities) {
            if (entity.subtype !== 'pawn' || entity.id === pawn.id) continue

            const dist = Math.sqrt((pawn.x - entity.x) ** 2 + (pawn.y - entity.y) ** 2)
            if (dist > range) continue

            // Find a solution this pawn has that the other doesn't
            for (const solutionId of pawn.discoveredSolutions) {
                if (!entity.discoveredSolutions?.has(solutionId)) {
                    return {
                        type: 'teach_skill',
                        skill: 'invention',
                        target: entity,
                        priority: 2,
                        description: `Teach discovered solution to ${entity.name}`,
                        duration: 100
                    }
                }
            }
        }
    }

    // Find any teacher for a skill the pawn needs
    const pawnSkills = Object.entries(pawn.skills).sort((a, b) => a[1] - b[1])
    for (const [skill, level] of pawnSkills) {
        if (level >= 5) continue // Already proficient

        const teacher = findTeacher(pawn, skill, range)
        if (teacher) {
            return {
                type: 'apprentice_skill',
                skill,
                target: teacher,
                priority: 2,
                description: `Learn ${skill} from ${teacher.name}`,
                duration: 80
            }
        }
    }

    return null
}

/**
 * Share discovered solutions from a mentor to an apprentice.
 * Called after a teaching session to transfer knowledge.
 * @param {Pawn} mentor - The teaching pawn
 * @param {Pawn} apprentice - The learning pawn
 * @param {number} maxSolutions - Maximum solutions to share per session
 */
export function shareDiscoveredSolutions(mentor, apprentice, maxSolutions = 3) {
    let shared = 0

    for (const solutionId of mentor.discoveredSolutions) {
        if (shared >= maxSolutions) break
        if (apprentice.discoveredSolutions?.has(solutionId)) continue

        apprentice.discoveredSolutions?.add(solutionId)
        shared++
    }

    if (shared > 0) {
        mentor.addThought?.(`Shared ${shared} discovered solutions with ${apprentice.name}`, 'social')
        apprentice.addThought?.(`Learned ${shared} new solutions from ${mentor.name}`, 'social')
    }
}

/**
 * Share observed crafts from a mentor to an apprentice.
 * Called after a teaching session to transfer craft knowledge.
 * @param {Pawn} mentor - The teaching pawn
 * @param {Pawn} apprentice - The learning pawn
 * @param {number} maxCrafts - Maximum crafts to share per session
 */
export function shareObservedCrafts(mentor, apprentice, maxCrafts = 5) {
    let shared = 0

    for (const craft of mentor.observedCrafts) {
        if (shared >= maxCrafts) break
        if (apprentice.observedCrafts?.has(craft)) continue

        apprentice.observedCrafts?.add(craft)
        shared++
    }

    if (shared > 0) {
        mentor.addThought?.(`Shared ${shared} observed crafts with ${apprentice.name}`, 'social')
        apprentice.addThought?.(`Learned ${shared} new crafts from ${mentor.name}`, 'social')
    }
}
