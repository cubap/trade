import Structure from './Structure.js'
import * as PawnLearning from '../mobile/PawnLearning.js'

class Guild extends Structure {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'guild'
        this.tags = new Set(['structure', 'guild', 'school', 'workshop', 'cover'])
        this.color = '#8b4513' // saddle brown for guild
        this.size = 28
        this.capacity = 8
        this.occupants = new Set()
        
        // Guild-specific: multiple mentor slots
        this.mentors = new Map() // pawnId -> { skills, lessonsCompleted, joinedAt }
        this.maxMentors = 4
        
        // Curriculum: skills the guild teaches
        this.curriculum = new Map() // skill -> { level, priority, enrolled }
        
        // Guild bonuses
        this.studyRateBoost = 2.0 // +100% study rate (better than school's 1.5)
        this.apprenticeBoost = 1.6 // +60% apprenticing rate (better than workshop's 1.4)
        this.teachingBoost = 1.5 // +50% teaching rate (better than school's 1.3)
    }

    canEnter(pawn) {
        return this.occupants.size < this.capacity
    }

    enter(pawn) {
        if (this.canEnter(pawn)) this.occupants.add(pawn.id)
    }

    leave(pawn) {
        this.occupants.delete(pawn.id)
    }

    /**
     * Register a pawn as a mentor at this guild.
     * @param {Pawn} mentor - The mentor pawn
     * @param {string[]} skills - Skills this mentor teaches
     */
    registerMentor(mentor, skills = []) {
        if (this.mentors.size >= this.maxMentors) {
            mentor.addThought?.('Guild is full — cannot register as mentor', 'civic')
            return false
        }

        this.mentors.set(mentor.id, {
            skills,
            lessonsCompleted: 0,
            joinedAt: mentor.world?.clock?.currentTick
        })

        mentor.addThought?.(`Registered as mentor at ${this.name}`, 'civic')
        return true
    }

    /**
     * Remove a mentor from this guild.
     * @param {Pawn} mentor - The mentor pawn
     */
    removeMentor(mentor) {
        this.mentors.delete(mentor.id)
        mentor.addThought?.(`Removed as mentor from ${this.name}`, 'civic')
    }

    /**
     * Enroll a student in a skill at this guild.
     * @param {Pawn} student - The student pawn
     * @param {string} skill - The skill to learn
     * @returns {Pawn|null} Assigned mentor or null
     */
    enrollStudent(student, skill) {
        // Find a mentor who teaches this skill
        for (const [mentorId, record] of this.mentors) {
            const mentor = this.world?.entitiesMap?.get(mentorId)
            if (!mentor) continue

            if (record.skills.includes(skill) || mentor.getSkill(skill) > student.getSkill(skill)) {
                // Establish mentorship through PawnLearning
                PawnLearning.establishMentorship(mentor, student, [skill])

                // Track enrollment in curriculum
                const course = this.curriculum.get(skill) || { level: 0, priority: 0, enrolled: new Set() }
                course.enrolled.add(student.id)
                this.curriculum.set(skill, course)

                student.addThought?.(`Enrolled in ${skill} at ${this.name}`, 'civic')
                return mentor
            }
        }

        student.addThought?.(`No mentor available for ${skill} at ${this.name}`, 'civic')
        return null
    }

    /**
     * Get a mentor for a skill at this guild.
     * @param {string} skill - The skill to find a mentor for
     * @returns {Pawn|null} Best available mentor or null
     */
    getMentorForSkill(skill) {
        let best = null
        let bestLevel = 0

        for (const [mentorId, record] of this.mentors) {
            const mentor = this.world?.entitiesMap?.get(mentorId)
            if (!mentor) continue

            const level = mentor.getSkill(skill)
            if (level > bestLevel) {
                bestLevel = level
                best = mentor
            }
        }

        return best
    }

    /**
     * Record a lesson completed by a mentor at this guild.
     * @param {Pawn} mentor - The mentor pawn
     * @param {Pawn} student - The student pawn
     * @param {string} skill - The skill taught
     */
    recordLesson(mentor, student, skill) {
        const record = this.mentors.get(mentor.id)
        if (record) {
            record.lessonsCompleted++
        }

        PawnLearning.recordLessonCompleted(mentor, student, skill)
    }

    update(tick) {
        const alive = super.update(tick)
        if (alive === false) return false

        // Apply guild buffs to occupants
        if (this.world && this.occupants.size) {
            for (const id of this.occupants) {
                const pawn = this.world?.entitiesMap?.get(id)
                if (!pawn) continue

                // Boost planning and teaching for being in guild
                pawn.increaseSkill?.('planning', 0.02 * this.studyRateBoost)
                pawn.increaseSkill?.('teaching', 0.01)
                
                // Small rest recovery when sheltering at guild
                pawn.needs?.satisfyNeed?.('energy', 0.15)
            }
        }

        return true
    }
}

export default Guild
