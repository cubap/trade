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
