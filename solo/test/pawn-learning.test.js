import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load modules directly for unit testing
const PawnLearningPath = path.resolve('solo/js/models/entities/mobile/PawnLearning.js')
const WorkshopPath = path.resolve('solo/js/models/entities/immobile/Workshop.js')
const GuildPath = path.resolve('solo/js/models/entities/immobile/Guild.js')

describe('PawnLearning Module Structure', () => {
    it('PawnLearning.js exists', () => {
        assert.ok(fs.existsSync(PawnLearningPath), 'PawnLearning.js not found')
    })

    it('PawnLearning.js exports all required functions', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        const required = [
            'export function getBaseLearningRate',
            'export function getTeachingSkillBonus',
            'export function getTrustBonus',
            'export function getStructureBonus',
            'export function teach',
            'export function observe',
            'export function apprentice',
            'export function clearApprenticeSlowdown',
            'export function getWorkSpeedMultiplier',
            'export function findTeacher',
            'export function isAvailableToTeach',
            'export function establishMentorship',
            'export function dissolveMentorship',
            'export function isMentorOf',
            'export function getMentor',
            'export function recordLessonCompleted',
            'export function recommendLearningMode',
            'export function selectLearningGoal'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('PawnLearning.js has teaching skill bonus logic', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes("teacher.getSkill('teaching')"),
            'Missing teaching skill lookup'
        )
    })

    it('PawnLearning.js has trust bonus logic', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes('getGroupTrustIn'),
            'Missing trust lookup between teacher and student'
        )
    })

    it('PawnLearning.js has school structure bonus', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes("'school'"),
            'Missing school structure bonus'
        )
    })

    it('PawnLearning.js has workshop structure bonus', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes("'workshop'"),
            'Missing workshop structure bonus'
        )
    })

    it('PawnLearning.js has observing mode (40% rate)', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes('0.4'),
            'Missing observing mode rate multiplier'
        )
    })

    it('PawnLearning.js has apprenticing mode (70% rate)', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes('0.7'),
            'Missing apprenticing mode rate multiplier'
        )
    })

    it('PawnLearning.js has apprentice slowdown on teacher', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes('_apprenticeSlowdown'),
            'Missing apprentice slowdown tracking on teacher'
        )
    })

    it('Pawn.js imports PawnLearning module', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/Pawn.js', 'utf-8')
        assert.ok(
            content.includes("import * as PawnLearning from './PawnLearning.js'"),
            'Pawn.js does not import PawnLearning'
        )
    })

    it('Pawn.js has learning delegating wrappers', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/Pawn.js', 'utf-8')
        const wrappers = [
            'teach(student, skill',
            'observe(teacher, skill',
            'apprentice(teacher, skill',
            'getWorkSpeedMultiplier()',
            'findTeacher(skill',
            'establishMentorship(apprentice',
            'dissolveMentorship(apprentice',
            'isMentorOf(apprentice',
            'getMentor()'
        ]

        for (const wrapper of wrappers) {
            assert.ok(content.includes(wrapper), `Missing delegating wrapper: ${wrapper}`)
        }
    })

    it('PawnGoals.js imports PawnLearning module', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/PawnGoals.js', 'utf-8')
        assert.ok(
            content.includes("import * as PawnLearning from './PawnLearning.js'"),
            'PawnGoals.js does not import PawnLearning'
        )
    })

    it('PawnGoals.js uses PawnLearning.teach in teach_skill handler', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/PawnGoals.js', 'utf-8')
        assert.ok(
            content.includes('PawnLearning.teach('),
            'PawnGoals.js does not use PawnLearning.teach'
        )
    })

    it('PawnGoals.js uses PawnLearning.apprentice in apprentice_skill handler', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/PawnGoals.js', 'utf-8')
        assert.ok(
            content.includes('PawnLearning.apprentice('),
            'PawnGoals.js does not use PawnLearning.apprentice'
        )
    })

    it('Workshop.js exists', () => {
        assert.ok(fs.existsSync(WorkshopPath), 'Workshop.js not found')
    })

    it('Workshop.js has workshop tag and apprentice boost', () => {
        const content = fs.readFileSync(WorkshopPath, 'utf-8')
        assert.ok(
            content.includes("'workshop'"),
            'Workshop.js missing workshop tag'
        )
        assert.ok(
            content.includes('apprenticeBoost'),
            'Workshop.js missing apprentice boost'
        )
    })

    it('PawnLearning.js has mentorship management functions', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes('mentorOf'),
            'Missing mentorOf relationship tracking'
        )
        assert.ok(
            content.includes('lessonsCompleted'),
            'Missing lesson completion tracking in mentorship'
        )
    })

    it('PawnLearning.js has goal selection logic', () => {
        const content = fs.readFileSync(PawnLearningPath, 'utf-8')
        assert.ok(
            content.includes('selectLearningGoal'),
            'Missing goal selection function'
        )
        assert.ok(
            content.includes('apprentice_skill'),
            'Missing apprentice_skill goal type in selection'
        )
        assert.ok(
            content.includes('teach_skill'),
            'Missing teach_skill goal type in selection'
        )
    })

    it('Guild.js exists', () => {
        assert.ok(fs.existsSync(GuildPath), 'Guild.js not found')
    })

    it('Guild.js has guild tag and mentor management', () => {
        const content = fs.readFileSync(GuildPath, 'utf-8')
        assert.ok(
            content.includes("'guild'"),
            'Guild.js missing guild tag'
        )
        assert.ok(
            content.includes('registerMentor'),
            'Guild.js missing registerMentor method'
        )
        assert.ok(
            content.includes('enrollStudent'),
            'Guild.js missing enrollStudent method'
        )
        assert.ok(
            content.includes('maxMentors'),
            'Guild.js missing maxMentors limit'
        )
    })

    it('Guild.js has curriculum tracking', () => {
        const content = fs.readFileSync(GuildPath, 'utf-8')
        assert.ok(
            content.includes('this.curriculum'),
            'Guild.js missing curriculum tracking'
        )
        assert.ok(
            content.includes('getMentorForSkill'),
            'Guild.js missing getMentorForSkill method'
        )
    })

    it('Guild.js uses PawnLearning for mentorship', () => {
        const content = fs.readFileSync(GuildPath, 'utf-8')
        assert.ok(
            content.includes('PawnLearning.establishMentorship'),
            'Guild.js does not use PawnLearning.establishMentorship'
        )
        assert.ok(
            content.includes('PawnLearning.recordLessonCompleted'),
            'Guild.js does not use PawnLearning.recordLessonCompleted'
        )
    })
})
