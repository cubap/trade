import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load modules directly for unit testing
const PawnReputationPath = path.resolve('solo/js/models/entities/mobile/PawnReputation.js')
const PawnPath = path.resolve('solo/js/models/entities/mobile/Pawn.js')

describe('PawnReputation Module Structure', () => {
    it('PawnReputation.js exists', () => {
        assert.ok(fs.existsSync(PawnReputationPath), 'PawnReputation.js not found')
    })

    it('PawnReputation.js exports all required functions', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        const required = [
            'export function getGroupReputation',
            'export function setGroupReputation',
            'export function getTargetGroupId',
            'export function modifyGroupReputation',
            'export function applyReputationDecay',
            'export function propagateReputationToAllies',
            'export function meetsReputationThreshold',
            'export function getContractRateModifier',
            'export function getTradePriceModifier',
            'export function getReputationLabel',
            'export function recordReputationEvent',
            'export function getRecentReputationEvents',
            'export function canInitiateTrade',
            'export function canOfferContract'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('PawnReputation.js has reputation decay logic', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes('decayRate'),
            'Missing decay rate parameter'
        )
        assert.ok(
            content.includes('0.5'),
            'Missing neutral default (0.5)'
        )
    })

    it('PawnReputation.js has gossip/contagion logic', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes('contagionFactor'),
            'Missing contagion factor for gossip'
        )
        assert.ok(
            content.includes('propagateReputationToAllies'),
            'Missing reputation propagation function'
        )
    })

    it('PawnReputation.js has reputation thresholds', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes("contract: 0.4"),
            'Missing contract threshold'
        )
        assert.ok(
            content.includes("trade: 0.3"),
            'Missing trade threshold'
        )
        assert.ok(
            content.includes("alliance: 0.7"),
            'Missing alliance threshold'
        )
    })

    it('PawnReputation.js has contract rate modifier', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes('getContractRateModifier'),
            'Missing contract rate modifier'
        )
        assert.ok(
            content.includes('1.3') && content.includes('0.7'),
            'Missing rate modifier range (0.7-1.3)'
        )
    })

    it('PawnReputation.js has trade price modifier', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes('getTradePriceModifier'),
            'Missing trade price modifier'
        )
        assert.ok(
            content.includes('1.2') && content.includes('0.8'),
            'Missing price modifier range (0.8-1.2)'
        )
    })

    it('PawnReputation.js has reputation labels', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes("'Allied'"),
            'Missing Allied label'
        )
        assert.ok(
            content.includes("'Trusted'"),
            'Missing Trusted label'
        )
        assert.ok(
            content.includes("'Hostile'"),
            'Missing Hostile label'
        )
    })

    it('PawnReputation.js has event recording', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes('recordReputationEvent'),
            'Missing event recording function'
        )
        assert.ok(
            content.includes('reputationEvents'),
            'Missing reputation events tracking'
        )
    })

    it('Pawn.js imports PawnReputation module', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        assert.ok(
            content.includes("import * as PawnReputation from './PawnReputation.js'"),
            'Pawn.js does not import PawnReputation'
        )
    })

    it('Pawn.js has reputation delegating wrappers', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        const wrappers = [
            'getGroupReputation(targetGroupId)',
            'setGroupReputation(targetGroupId, score)',
            'modifyGroupReputation(targetGroupId, eventType, magnitude)',
            'applyReputationDecay(decayRate)',
            'propagateReputationToAllies(contagionFactor)',
            'meetsReputationThreshold(targetGroupId, action)',
            'canInitiateTrade(otherPawn)',
            'canOfferContract(otherPawn)'
        ]

        for (const wrapper of wrappers) {
            assert.ok(
                content.includes(wrapper),
                `Pawn.js missing delegating wrapper: ${wrapper}`
            )
        }
    })

    it('Pawn.js calls applyReputationDecay in update tick', () => {
        const content = fs.readFileSync(PawnPath, 'utf-8')
        assert.ok(
            content.includes('this.applyReputationDecay()'),
            'Pawn.js does not call applyReputationDecay in update()'
        )
    })

    it('PawnReputation.js has contract event types', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        const eventTypes = [
            "'contract_fulfilled'",
            "'contract_broken'",
            "'trade_success'",
            "'raid_defended'",
            "'raid_attacked'"
        ]

        for (const eventType of eventTypes) {
            assert.ok(
                content.includes(eventType),
                `Missing event type: ${eventType}`
            )
        }
    })

    it('PawnReputation.js has canInitiateTrade with reason', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes("'reputation_ok'"),
            'Missing reputation_ok reason'
        )
        assert.ok(
            content.includes("'reputation_too_low'"),
            'Missing reputation_too_low reason'
        )
    })

    it('PawnReputation.js has canOfferContract with rate modifier', () => {
        const content = fs.readFileSync(PawnReputationPath, 'utf-8')
        assert.ok(
            content.includes('rateModifier'),
            'Missing rate modifier in canOfferContract'
        )
        assert.ok(
            content.includes('reputationLabel'),
            'Missing reputation label in canOfferContract'
        )
    })
})
