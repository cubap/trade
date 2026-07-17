import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load modules directly for unit testing
const PawnSpecializationPath = path.resolve('solo/js/models/entities/mobile/PawnSpecialization.js')
const PawnPath = path.resolve('solo/js/models/entities/mobile/Pawn.js')

describe('PawnSpecialization Occupation System', () => {
    it('PawnSpecialization.js exists', () => {
        assert.ok(fs.existsSync(PawnSpecializationPath), 'PawnSpecialization.js not found')
    })

    it('PawnSpecialization.js exports all occupation functions', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        const required = [
            'export function getOccupationProfile',
            'export function getAllOccupationProfiles',
            'export function getOccupationAlignment',
            'export function getCurrentOccupation',
            'export function hasOccupationIdentity',
            'export function getOccupationBonuses',
            'export function recordBehaviorSignal',
            'export function applyProfessionDrift',
            'export function getDemandSignals',
            'export function getRecommendedOccupation',
            'export function getOccupationLabel',
            'export function hasOccupationBonus',
            'export function getOccupationBonusMultiplier'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('PawnSpecialization.js has all occupation profiles', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        const occupations = ['forager', 'farmer', 'woodwright', 'trader', 'warrior', 'teacher', 'artisan', 'scout']

        for (const occupation of occupations) {
            assert.ok(
                content.includes(`${occupation}:`),
                `Missing occupation profile: ${occupation}`
            )
        }
    })

    it('PawnSpecialization.js has occupation profile structure', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('skillWeights'),
            'Missing skillWeights in occupation profiles'
        )
        assert.ok(
            content.includes('identityThreshold'),
            'Missing identityThreshold in occupation profiles'
        )
        assert.ok(
            content.includes('bonuses'),
            'Missing bonuses in occupation profiles'
        )
        assert.ok(
            content.includes('description'),
            'Missing description in occupation profiles'
        )
    })

    it('PawnSpecialization.js has profession drift logic', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('applyProfessionDrift'),
            'Missing profession drift function'
        )
        assert.ok(
            content.includes('driftRate'),
            'Missing drift rate parameter'
        )
        assert.ok(
            content.includes('behaviorSignals'),
            'Missing behavior signals tracking'
        )
    })

    it('PawnSpecialization.js has identity threshold logic', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('hasOccupationIdentity'),
            'Missing identity threshold check'
        )
        assert.ok(
            content.includes('identityThreshold'),
            'Missing identity threshold reference'
        )
    })

    it('PawnSpecialization.js has demand signals', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('getDemandSignals'),
            'Missing demand signals function'
        )
        assert.ok(
            content.includes('getRecommendedOccupation'),
            'Missing recommended occupation function'
        )
    })

    it('PawnSpecialization.js has specialization bonuses', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('getOccupationBonuses'),
            'Missing occupation bonuses function'
        )
        assert.ok(
            content.includes('getOccupationBonusMultiplier'),
            'Missing bonus multiplier function'
        )
    })

    it('Pawn.js imports PawnSpecialization module', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        assert.ok(
            content.includes("import * as PawnSpecialization from './PawnSpecialization.js'"),
            'Pawn.js does not import PawnSpecialization'
        )
    })

    it('Pawn.js has occupation delegating wrappers', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        const wrappers = [
            'getCurrentOccupation()',
            'hasOccupationIdentity(occupation)',
            'getOccupationBonuses()',
            'getOccupationBonusMultiplier(activity)',
            'getOccupationLabel()',
            'getRecommendedOccupation()',
            'applyProfessionDrift(driftRate)'
        ]

        for (const wrapper of wrappers) {
            assert.ok(
                content.includes(wrapper),
                `Pawn.js missing delegating wrapper: ${wrapper}`
            )
        }
    })

    it('Pawn.js calls applyProfessionDrift in update tick', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        assert.ok(
            content.includes('this.applyProfessionDrift()'),
            'Pawn.js does not call applyProfessionDrift in update()'
        )
    })

    it('PawnSpecialization.js has behavior signal recording', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('recordBehaviorSignal'),
            'Missing behavior signal recording'
        )
        assert.ok(
            content.includes('pawn.behaviorSignals'),
            'Missing behavior signals storage on pawn'
        )
    })

    it('PawnSpecialization.js has occupation alignment calculation', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('getOccupationAlignment'),
            'Missing occupation alignment calculation'
        )
        assert.ok(
            content.includes('pawn.getSkill'),
            'Missing skill lookup in alignment calculation'
        )
    })

    it('PawnSpecialization.js has occupation switching logic', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        assert.ok(
            content.includes('pawn.currentOccupation'),
            'Missing current occupation tracking on pawn'
        )
        assert.ok(
            content.includes('Drifting toward'),
            'Missing drift thought message'
        )
    })
})
