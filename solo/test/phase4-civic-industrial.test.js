import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load modules directly for unit testing
const GovernancePath = path.resolve('solo/js/core/Governance.js')
const PawnSpecializationPath = path.resolve('solo/js/models/entities/mobile/PawnSpecialization.js')

describe('Phase 4: Civic/Industrial Module Structure', () => {
    it('Governance.js exists', () => {
        assert.ok(fs.existsSync(GovernancePath), 'Governance.js not found')
    })

    it('PawnSpecialization.js exists', () => {
        assert.ok(fs.existsSync(PawnSpecializationPath), 'PawnSpecialization.js not found')
    })

    it('Governance.js exports all required functions', () => {
        const content = fs.readFileSync(GovernancePath, 'utf-8')
        const required = [
            'export function createLaw',
            'export function isLawInEffect',
            'export function getActiveLaws',
            'export function updateLawSupport',
            'export function revokeLaw',
            'export function hasLawType',
            'export function getGovernanceModel',
            'export function upgradeGovernance',
            'export function calculateCivicScore'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('PawnSpecialization.js exports all required functions', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        const required = [
            'export function assignRole',
            'export function removeRole',
            'export function getRoleMembers',
            'export function hasRole',
            'export function getSpecializationBonuses',
            'export function recommendRole',
            'export function canAssignRole'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('Pawn.js imports PawnSpecialization module', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/Pawn.js', 'utf-8')
        assert.ok(
            content.includes("import * as PawnSpecialization from './PawnSpecialization.js'"),
            'Pawn.js does not import PawnSpecialization'
        )
    })

    it('Pawn.js has specialization delegating wrappers', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/Pawn.js', 'utf-8')
        const wrappers = [
            'assignRole(role',
            'removeRole(settlement',
            'hasRole(role',
            'getSpecializationBonuses()',
            'recommendRole()'
        ]

        for (const wrapper of wrappers) {
            assert.ok(content.includes(wrapper), `Missing delegating wrapper: ${wrapper}`)
        }
    })

    it('PawnGoals.js has civic goal types in goalBranchMap', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/PawnGoals.js', 'utf-8')
        const civicGoals = ["'assign_role': 'civic'", "'enact_law': 'civic'"]

        for (const goal of civicGoals) {
            assert.ok(content.includes(goal), `Missing ${goal} in goalBranchMap`)
        }
    })

    it('Governance.js has governance model progression', () => {
        const content = fs.readFileSync(GovernancePath, 'utf-8')
        assert.ok(content.includes("'informal'"), 'Missing informal governance model')
        assert.ok(content.includes("'appointed'"), 'Missing appointed governance model')
        assert.ok(content.includes("'elective'"), 'Missing elective governance model')
        assert.ok(content.includes("'weighted'"), 'Missing weighted governance model')
    })

    it('PawnSpecialization.js has all role types', () => {
        const content = fs.readFileSync(PawnSpecializationPath, 'utf-8')
        const roles = ['builder', 'farmer', 'guard', 'merchant', 'teacher', 'artisan']

        for (const role of roles) {
            assert.ok(content.includes(`'${role}'`), `Missing role: ${role}`)
        }
    })
})
