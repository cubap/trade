import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load modules directly for unit testing
const PawnMercantilePath = path.resolve('solo/js/models/entities/mobile/PawnMercantile.js')
const PriceRegistryPath = path.resolve('solo/js/core/PriceRegistry.js')
const TradeRoutesPath = path.resolve('solo/js/core/TradeRoutes.js')
const MarketPath = path.resolve('solo/js/models/entities/immobile/Market.js')

describe('Phase 3: Mercantile/Trade Module Structure', () => {
    it('PawnMercantile.js exists', () => {
        assert.ok(fs.existsSync(PawnMercantilePath), 'PawnMercantile.js not found')
    })

    it('PriceRegistry.js exists', () => {
        assert.ok(fs.existsSync(PriceRegistryPath), 'PriceRegistry.js not found')
    })

    it('TradeRoutes.js exists', () => {
        assert.ok(fs.existsSync(TradeRoutesPath), 'TradeRoutes.js not found')
    })

    it('Market.js exists', () => {
        assert.ok(fs.existsSync(MarketPath), 'Market.js not found')
    })

    it('PawnMercantile.js exports all required functions', () => {
        const content = fs.readFileSync(PawnMercantilePath, 'utf-8')
        const required = [
            'export function hasSurplus',
            'export function getSurplusItems',
            'export function initiateBarter',
            'export function acceptBarter',
            'export function recordTradeObservation',
            'export function shouldSeekTrade',
            'export function findTradePartner'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('PriceRegistry.js exports all required functions', () => {
        const content = fs.readFileSync(PriceRegistryPath, 'utf-8')
        const required = [
            'export function recordTrade',
            'export function getPrice',
            'export function getKnownPrices',
            'export function detectArbitrage',
            'export function isPriceStale',
            'export function pruneOldPrices'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('TradeRoutes.js exports all required functions', () => {
        const content = fs.readFileSync(TradeRoutesPath, 'utf-8')
        const required = [
            'export function createRoute',
            'export function recordTrip',
            'export function updateRouteSafety',
            'export function findBestRoute',
            'export function getRoutesFrom',
            'export function isRouteActive'
        ]

        for (const fn of required) {
            assert.ok(content.includes(fn), `${fn} not exported`)
        }
    })

    it('Market.js exports default class', () => {
        const content = fs.readFileSync(MarketPath, 'utf-8')
        assert.ok(content.includes('class Market extends Structure'), 'Market class not found')
        assert.ok(content.includes('export default Market'), 'Market default export not found')
    })

    it('Pawn.js imports PawnMercantile module', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/Pawn.js', 'utf-8')
        assert.ok(
            content.includes("import * as PawnMercantile from './PawnMercantile.js'"),
            'Pawn.js does not import PawnMercantile'
        )
    })

    it('PawnGoals.js imports PawnMercantile module', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/PawnGoals.js', 'utf-8')
        assert.ok(
            content.includes("import * as PawnMercantile from './PawnMercantile.js'"),
            'PawnGoals.js does not import PawnMercantile'
        )
    })

    it('PawnGoals.js has mercantile goal types in goalBranchMap', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/PawnGoals.js', 'utf-8')
        const mercantileGoals = ["'barter': 'mercantile'", "'seek_trade': 'mercantile'", "'travel_route': 'mercantile'"]

        for (const goal of mercantileGoals) {
            assert.ok(content.includes(goal), `Missing ${goal} in goalBranchMap`)
        }
    })

    it('Pawn.js has mercantile delegating wrappers', () => {
        const content = fs.readFileSync('solo/js/models/entities/mobile/Pawn.js', 'utf-8')
        const wrappers = [
            'hasSurplus(itemType',
            'getSurplusItems(personalNeed',
            'initiateBarter(target',
            'acceptBarter(offer',
            'shouldSeekTrade()',
            'findTradePartner(range'
        ]

        for (const wrapper of wrappers) {
            assert.ok(content.includes(wrapper), `Missing delegating wrapper: ${wrapper}`)
        }
    })

    it('Market.js extends Structure', () => {
        const content = fs.readFileSync(MarketPath, 'utf-8')
        assert.ok(
            content.includes("import Structure from './Structure.js'"),
            'Market.js does not import Structure'
        )
        assert.ok(
            content.includes('class Market extends Structure'),
            'Market does not extend Structure'
        )
    })

    it('TradeRoutes.js imports PriceRegistry', () => {
        const content = fs.readFileSync(TradeRoutesPath, 'utf-8')
        assert.ok(
            content.includes("import { getPrice } from './PriceRegistry.js'"),
            'TradeRoutes.js does not import PriceRegistry'
        )
    })

    it('PawnMercantile.js imports PriceRegistry', () => {
        const content = fs.readFileSync(PawnMercantilePath, 'utf-8')
        assert.ok(
            content.includes("import { recordTrade } from '../core/PriceRegistry.js'"),
            'PawnMercantile.js does not import PriceRegistry'
        )
    })

    it('Market.js has market-specific attributes', () => {
        const content = fs.readFileSync(MarketPath, 'utf-8')
        assert.ok(content.includes("this.subtype = 'market'"), 'Market missing subtype')
        assert.ok(content.includes('this.tradesRecorded'), 'Market missing tradesRecorded')
        assert.ok(content.includes('this.activeMerchants'), 'Market missing activeMerchants')
        assert.ok(content.includes('this.providedBuffs'), 'Market missing providedBuffs')
    })
})
