import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load modules directly for unit testing
const PawnContractPath = path.resolve('solo/js/models/entities/mobile/PawnContract.js')
const PawnPath = path.resolve('solo/js/models/entities/mobile/Pawn.js')

describe('PawnContract Module Structure', () => {
    it('PawnContract.js exists', () => {
        assert.ok(fs.existsSync(PawnContractPath), 'PawnContract.js not found')
    })

    it('PawnContract.js exports all required functions', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        const required = [
            'export function offerContract',
            'export function acceptContract',
            'export function activateContract',
            'export function fulfillContract',
            'export function completeContract',
            'export function disputeContract',
            'export function terminateContract',
            'export function getContract',
            'export function getActiveContracts',
            'export function getPendingContracts',
            'export function getOfferedContracts',
            'export function getContractRate',
            'export function getContractPriorityScore',
            'export function isContractExpired',
            'export function expireExpiredContracts',
            'export function getContractType',
            'export function getAllContractTypes',
            'export function getContractState',
            'export function getAllContractStates'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('PawnContract.js has all five contract types', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        const contractTypes = ['escort', 'defense', 'supply', 'research', 'apprenticeship']

        for (const type of contractTypes) {
            assert.ok(
                content.includes(`${type}:`),
                `Missing contract type: ${type}`
            )
        }
    })

    it('PawnContract.js has all contract lifecycle states', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        const states = ['OFFERED', 'ACCEPTED', 'ACTIVE', 'FULFILLED', 'COMPLETED', 'DISPUTED', 'TERMINATED']

        for (const state of states) {
            assert.ok(
                content.includes(`${state}:`),
                `Missing contract state: ${state}`
            )
        }
    })

    it('PawnContract.js imports PawnReputation for rate modifiers', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes("import * as PawnReputation from './PawnReputation.js'"),
            'PawnContract.js does not import PawnReputation'
        )
    })

    it('PawnContract.js uses reputation for contract rates', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes('getContractRateModifier'),
            'Missing reputation-based rate modifier'
        )
        assert.ok(
            content.includes('canOfferContract'),
            'Missing reputation check for offering contracts'
        )
    })

    it('PawnContract.js has priority system for fulfillment ordering', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes('getContractPriorityScore'),
            'Missing priority scoring function'
        )
        assert.ok(
            content.includes('priority'),
            'Missing priority field in contract terms'
        )
    })

    it('PawnContract.js has contract expiration logic', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes('isContractExpired'),
            'Missing expiration check'
        )
        assert.ok(
            content.includes('expireExpiredContracts'),
            'Missing expiration processing'
        )
        assert.ok(
            content.includes('duration'),
            'Missing duration field in contract terms'
        )
    })

    it('PawnContract.js has dispute handling with reputation impact', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes("modifyGroupReputation(pawn, offeredByGroup, 'contract_broken'"),
            'Missing reputation impact for disputed contracts'
        )
    })

    it('PawnContract.js has fulfillment with reputation reward', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes("modifyGroupReputation(pawn, offeredByGroup, 'contract_fulfilled'"),
            'Missing reputation reward for fulfilled contracts'
        )
    })

    it('Pawn.js imports PawnContract module', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        assert.ok(
            content.includes("import * as PawnContract from './PawnContract.js'"),
            'Pawn.js does not import PawnContract'
        )
    })

    it('Pawn.js has contract delegating wrappers', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        const wrappers = [
            'offerContract(targetPawn, type, terms)',
            'acceptContract(contractId)',
            'activateContract(contractId)',
            'fulfillContract(contractId, results)',
            'completeContract(contractId)',
            'disputeContract(contractId, reason)',
            'terminateContract(contractId)',
            'getContract(contractId)',
            'getActiveContracts()',
            'getPendingContracts()',
            'getOfferedContracts()',
            'getContractRate(targetPawn)',
            'expireExpiredContracts()'
        ]

        for (const wrapper of wrappers) {
            assert.ok(
                content.includes(wrapper),
                `Pawn.js missing delegating wrapper: ${wrapper}`
            )
        }
    })

    it('Pawn.js calls expireExpiredContracts in update tick', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        assert.ok(
            content.includes('this.expireExpiredContracts()'),
            'Pawn.js does not call expireExpiredContracts in update()'
        )
    })

    it('PawnContract.js has contract type definitions with defaults', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes('defaultDuration'),
            'Missing default duration in contract types'
        )
        assert.ok(
            content.includes('defaultPriority'),
            'Missing default priority in contract types'
        )
        assert.ok(
            content.includes('requiresSkills'),
            'Missing required skills in contract types'
        )
    })

    it('PawnContract.js stores contracts on pawn with proper structure', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes('pawn.contracts'),
            'Missing contracts storage on pawn'
        )
        assert.ok(
            content.includes('pawn.activeContracts'),
            'Missing activeContracts storage on pawn'
        )
        assert.ok(
            content.includes('pawn.pendingContracts'),
            'Missing pendingContracts storage on pawn'
        )
    })

    it('PawnContract.js has contract state transitions', () => {
        const content = fs.readFileSync(PawnContractPath, 'utf-8')
        assert.ok(
            content.includes('CONTRACT_STATES.OFFERED'),
            'Missing OFFERED state reference'
        )
        assert.ok(
            content.includes('contract.state = CONTRACT_STATES.ACCEPTED'),
            'Missing ACCEPTED state assignment'
        )
        assert.ok(
            content.includes('contract.state = CONTRACT_STATES.ACTIVE'),
            'Missing ACTIVE state assignment'
        )
        assert.ok(
            content.includes('contract.state = CONTRACT_STATES.FULFILLED'),
            'Missing FULFILLED state assignment'
        )
        assert.ok(
            content.includes('contract.state = CONTRACT_STATES.COMPLETED'),
            'Missing COMPLETED state assignment'
        )
    })
})
