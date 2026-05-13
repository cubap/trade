import { describe, it } from 'node:test'
import assert from 'node:assert'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import ResourceCache from '../js/models/entities/immobile/ResourceCache.js'

function createWorldWith(...entities) {
  const world = {
    entitiesMap: new Map(),
    clock: { currentTick: 0 }
  }

  for (const entity of entities) {
    entity.world = world
    world.entitiesMap.set(entity.id, entity)
  }

  return world
}

describe('Activity-Based Trust Gains', () => {
    describe('Hunt Success Trust', () => {
        it('should gain trust when hunting with partners', () => {
            const hunter1 = new Pawn('p1', 'Hunter1', 100, 100)
            const hunter2 = new Pawn('p2', 'Hunter2', 105, 105)
            const world = createWorldWith(hunter1, hunter2)

            assert.strictEqual(hunter1.getGroupTrustIn(hunter2) ?? 0, 0, 'Initial trust should be 0')

            hunter1.registerHuntSuccess([hunter2])

            assert.ok(Math.abs((hunter1.getGroupTrustIn(hunter2) ?? 0) - 0.15) < 0.001, 'Hunt success should add 0.15 trust')
        })

        it('should stack hunt success trust with multiple hunts', () => {
            const hunter1 = new Pawn('p3', 'Hunter3', 200, 200)
            const hunter2 = new Pawn('p4', 'Hunter4', 205, 205)
            const world = createWorldWith(hunter1, hunter2)

            hunter1.registerHuntSuccess([hunter2])
            assert.ok(Math.abs((hunter1.getGroupTrustIn(hunter2) ?? 0) - 0.15) < 0.001, 'First hunt: +0.15')

            hunter1.registerHuntSuccess([hunter2])
            assert.ok(Math.abs((hunter1.getGroupTrustIn(hunter2) ?? 0) - 0.30) < 0.001, 'Second hunt: +0.15 = 0.30')

            hunter1.registerHuntSuccess([hunter2])
            assert.ok(Math.abs((hunter1.getGroupTrustIn(hunter2) ?? 0) - 0.45) < 0.001, 'Third hunt: +0.15 = 0.45')
        })

        it('should cap hunt trust at 1.0', () => {
            const hunter1 = new Pawn('p5', 'Hunter5', 300, 300)
            const hunter2 = new Pawn('p6', 'Hunter6', 305, 305)
            const world = createWorldWith(hunter1, hunter2)

            // Build trust to near-cap
            for (let i = 0; i < 7; i++) {
                hunter1.registerHuntSuccess([hunter2])
            }

            const trust = hunter1.getGroupTrustIn(hunter2) ?? 0
            assert.ok(trust <= 1.0, 'Trust should not exceed 1.0')
            assert.ok(Math.abs(trust - 1.0) < 0.001, 'Should reach exactly 1.0 after cap')
        })

        it('should handle multiple hunting partners', () => {
            const hunter1 = new Pawn('p7', 'Hunter7', 400, 400)
            const hunter2 = new Pawn('p8', 'Hunter8', 405, 405)
            const hunter3 = new Pawn('p9', 'Hunter9', 410, 410)
            const world = createWorldWith(hunter1, hunter2, hunter3)

            hunter1.registerHuntSuccess([hunter2, hunter3])

            assert.ok(Math.abs((hunter1.getGroupTrustIn(hunter2) ?? 0) - 0.15) < 0.001, 'Partner 1 should gain 0.15')
            assert.ok(Math.abs((hunter1.getGroupTrustIn(hunter3) ?? 0) - 0.15) < 0.001, 'Partner 2 should gain 0.15')
        })

        it('should not gain self-trust', () => {
            const hunter1 = new Pawn('p10', 'Hunter10', 500, 500)
            const world = createWorldWith(hunter1)

            hunter1.registerHuntSuccess([hunter1])

            // Should not affect self-trust (undefined or 0)
            assert.strictEqual(hunter1.getGroupTrustIn(hunter1) ?? 0, 0, 'Self-trust should remain 0')
        })
    })

    describe('Cache Sharing Trust', () => {
        it('should gain trust when using another pawn\'s cache', () => {
            const pawn1 = new Pawn('p11', 'Pawn11', 600, 600)
            const pawn2 = new Pawn('p12', 'Pawn12', 605, 605)
            const world = createWorldWith(pawn1, pawn2)

            assert.strictEqual(pawn1.getGroupTrustIn(pawn2) ?? 0, 0, 'Initial trust should be 0')

            pawn1.notifyCacheSharing(pawn2.id)

            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.10) < 0.001, 'Cache sharing should add 0.10 trust')
        })

        it('should stack cache sharing trust over time', () => {
            const pawn1 = new Pawn('p13', 'Pawn13', 700, 700)
            const pawn2 = new Pawn('p14', 'Pawn14', 705, 705)
            const world = createWorldWith(pawn1, pawn2)

            pawn1.notifyCacheSharing(pawn2.id)
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.10) < 0.001, 'First cache use: +0.10')

            pawn1.notifyCacheSharing(pawn2.id)
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.20) < 0.001, 'Second cache use: +0.10 = 0.20')

            pawn1.notifyCacheSharing(pawn2.id)
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.30) < 0.001, 'Third cache use: +0.10 = 0.30')
        })

        it('should cap cache sharing trust at 1.0', () => {
            const pawn1 = new Pawn('p15', 'Pawn15', 800, 800)
            const pawn2 = new Pawn('p16', 'Pawn16', 805, 805)
            const world = createWorldWith(pawn1, pawn2)

            for (let i = 0; i < 11; i++) {
                pawn1.notifyCacheSharing(pawn2.id)
            }

            const trust = pawn1.getGroupTrustIn(pawn2) ?? 0
            assert.ok(trust <= 1.0, 'Trust should not exceed 1.0')
            assert.ok(Math.abs(trust - 1.0) < 0.001, 'Should reach 1.0 after cap')
        })

        it('should not affect trust with invalid cache builder', () => {
            const pawn1 = new Pawn('p17', 'Pawn17', 900, 900)
            const world = createWorldWith(pawn1)

            pawn1.notifyCacheSharing(null)
            pawn1.notifyCacheSharing('nonexistent-id')

            // Should have no effect (no trust change)
            const trust = pawn1.getGroupTrustIn(pawn1) ?? 0
            assert.strictEqual(trust, 0, 'Invalid cache builder should not affect trust')
        })
    })

    describe('Shared Cache Contribution Trust', () => {
        it('should gain trust when contributing to shared cache with others', () => {
            const pawn1 = new Pawn('p45', 'Pawn45', 100, 100)
            const pawn2 = new Pawn('p46', 'Pawn46', 105, 105)
            const world = createWorldWith(pawn1, pawn2)

            assert.strictEqual(pawn1.getGroupTrustIn(pawn2) ?? 0, 0, 'Initial trust should be 0')

            pawn1.registerSharedCacheContribution('cache-1', [pawn2])

            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.12) < 0.001, 'Shared cache contribution should add 0.12 trust')
        })

        it('should stack shared cache contributions over time', () => {
            const pawn1 = new Pawn('p47', 'Pawn47', 200, 200)
            const pawn2 = new Pawn('p48', 'Pawn48', 205, 205)
            const world = createWorldWith(pawn1, pawn2)

            pawn1.registerSharedCacheContribution('cache-1', [pawn2])
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.12) < 0.001, 'First contribution: +0.12')

            pawn1.registerSharedCacheContribution('cache-2', [pawn2])
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.24) < 0.001, 'Second contribution: +0.12 = 0.24')

            pawn1.registerSharedCacheContribution('cache-3', [pawn2])
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.36) < 0.001, 'Third contribution: +0.12 = 0.36')
        })

        it('should cap shared cache contribution trust at 1.0', () => {
            const pawn1 = new Pawn('p49', 'Pawn49', 300, 300)
            const pawn2 = new Pawn('p50', 'Pawn50', 305, 305)
            const world = createWorldWith(pawn1, pawn2)

            for (let i = 0; i < 9; i++) {
                pawn1.registerSharedCacheContribution(`cache-${i}`, [pawn2])
            }

            const trust = pawn1.getGroupTrustIn(pawn2) ?? 0
            assert.ok(trust <= 1.0, 'Trust should not exceed 1.0')
            assert.ok(Math.abs(trust - 1.0) < 0.001, 'Should reach 1.0 after 9 contributions')
        })

        it('should handle multiple contributors to same cache', () => {
            const pawn1 = new Pawn('p51', 'Pawn51', 400, 400)
            const pawn2 = new Pawn('p52', 'Pawn52', 405, 405)
            const pawn3 = new Pawn('p53', 'Pawn53', 410, 410)
            const world = createWorldWith(pawn1, pawn2, pawn3)

            pawn1.registerSharedCacheContribution('cache-1', [pawn2, pawn3])

            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.12) < 0.001, 'Contributor 1 should gain +0.12')
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn3) ?? 0) - 0.12) < 0.001, 'Contributor 2 should gain +0.12')
        })

        it('should not gain self-trust from cache contribution', () => {
            const pawn1 = new Pawn('p54', 'Pawn54', 500, 500)
            const world = createWorldWith(pawn1)

            pawn1.registerSharedCacheContribution('cache-1', [pawn1])

            // Self-trust should not change
            assert.strictEqual(pawn1.getGroupTrustIn(pawn1) ?? 0, 0, 'Self-trust should remain 0')
        })

        it('should prioritize shared contribution (0.12) over single cache use (0.10)', () => {
            const pawn1 = new Pawn('p55', 'Pawn55', 600, 600)
            const pawn2 = new Pawn('p56', 'Pawn56', 605, 605)
            const world = createWorldWith(pawn1, pawn2)

            // Single use
            pawn1.notifyCacheSharing(pawn2.id)
            const singleUseTrust = pawn1.getGroupTrustIn(pawn2) ?? 0

            // Reset
            pawn1.setGroupTrustIn(pawn2, 0)

            // Shared contribution
            pawn1.registerSharedCacheContribution('cache-1', [pawn2])
            const contributionTrust = pawn1.getGroupTrustIn(pawn2) ?? 0

            assert.ok(contributionTrust > singleUseTrust, 'Shared contribution should build more trust than single use')
            assert.ok(Math.abs(singleUseTrust - 0.10) < 0.001, 'Single use: 0.10')
            assert.ok(Math.abs(contributionTrust - 0.12) < 0.001, 'Contribution: 0.12')
        })
    })

    describe('Safe Night Trust', () => {
        it('should gain trust from safe nights with shelter', () => {
            const pawn1 = new Pawn('p18', 'Pawn18', 100, 100)
            const pawn2 = new Pawn('p19', 'Pawn19', 105, 105)
            const world = createWorldWith(pawn1, pawn2)

            assert.strictEqual(pawn1.getGroupTrustIn(pawn2) ?? 0, 0, 'Initial trust should be 0')

            pawn1.registerSafeNightTrust([pawn2])

            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.05) < 0.001, 'Safe night should add 0.05 trust')
        })

        it('should accumulate safe night trust slowly', () => {
            const pawn1 = new Pawn('p20', 'Pawn20', 200, 200)
            const pawn2 = new Pawn('p21', 'Pawn21', 205, 205)
            const world = createWorldWith(pawn1, pawn2)

            pawn1.registerSafeNightTrust([pawn2])
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.05) < 0.001, 'Night 1: +0.05')

            pawn1.registerSafeNightTrust([pawn2])
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.10) < 0.001, 'Night 2: +0.05 = 0.10')

            pawn1.registerSafeNightTrust([pawn2])
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.15) < 0.001, 'Night 3: +0.05 = 0.15')

            // 20 nights = 1.0 trust
            for (let i = 0; i < 17; i++) {
                pawn1.registerSafeNightTrust([pawn2])
            }

            const trust = pawn1.getGroupTrustIn(pawn2) ?? 0
            assert.ok(trust <= 1.0, 'Trust should cap at 1.0')
            assert.ok(Math.abs(trust - 1.0) < 0.001, 'Should reach 1.0 after 20 safe nights')
        })

        it('should handle multiple nearby pawns on safe nights', () => {
            const pawn1 = new Pawn('p22', 'Pawn22', 300, 300)
            const pawn2 = new Pawn('p23', 'Pawn23', 305, 305)
            const pawn3 = new Pawn('p24', 'Pawn24', 310, 310)
            const world = createWorldWith(pawn1, pawn2, pawn3)

            pawn1.registerSafeNightTrust([pawn2, pawn3])

            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn2) ?? 0) - 0.05) < 0.001, 'Pawn2 should gain +0.05')
            assert.ok(Math.abs((pawn1.getGroupTrustIn(pawn3) ?? 0) - 0.05) < 0.001, 'Pawn3 should gain +0.05')
        })
    })

    describe('Territorial Group Formation', () => {
        it('should detect territorial overlap when pawns share memory', () => {
            const pawn1 = new Pawn('p25', 'Pawn25', 100, 100)
            const pawn2 = new Pawn('p26', 'Pawn26', 105, 105)
            const world = createWorldWith(pawn1, pawn2)

            // Give them shared memory of landmarks (territory overlap)
            for (let i = 0; i < 6; i++) {
                pawn1.memoryMap.push({
                    x: 150 + i * 5,
                    y: 150 + i * 5,
                    type: 'resource',
                    lastSeen: 100
                })
                pawn2.memoryMap.push({
                    x: 150 + i * 5,
                    y: 150 + i * 5,
                    type: 'resource',
                    lastSeen: 100
                })
            }

            // Build sufficient trust
            pawn1.setGroupTrustIn(pawn2, 0.15)

            const trigger = pawn1.checkTerritorialOverlapTrigger()

            assert.ok(trigger, 'Should detect territorial overlap')
            assert.strictEqual(trigger.type, 'tribal', 'Should be tribal type')
            assert.ok(trigger.members.includes(pawn1), 'Should include self')
            assert.ok(trigger.members.includes(pawn2), 'Should include other pawn')
        })

        it('should require minimum trust for territorial overlap', () => {
            const pawn1 = new Pawn('p27', 'Pawn27', 200, 200)
            const pawn2 = new Pawn('p28', 'Pawn28', 205, 205)
            const world = createWorldWith(pawn1, pawn2)

            // Shared memory
            for (let i = 0; i < 6; i++) {
                pawn1.memoryMap.push({
                    x: 200 + i * 5,
                    y: 200 + i * 5,
                    type: 'resource',
                    lastSeen: 100
                })
                pawn2.memoryMap.push({
                    x: 200 + i * 5,
                    y: 200 + i * 5,
                    type: 'resource',
                    lastSeen: 100
                })
            }

            // Insufficient trust
            pawn1.setGroupTrustIn(pawn2, 0.10)

            const trigger = pawn1.checkTerritorialOverlapTrigger()

            assert.strictEqual(trigger, null, 'Should not trigger with trust < 0.15')
        })

        it('should return null with no overlapping memory', () => {
            const pawn1 = new Pawn('p29', 'Pawn29', 300, 300)
            const pawn2 = new Pawn('p30', 'Pawn30', 305, 305)
            const world = createWorldWith(pawn1, pawn2)

            // Different memory
            pawn1.memoryMap.push({ x: 100, y: 100, type: 'resource', lastSeen: 100 })
            pawn2.memoryMap.push({ x: 500, y: 500, type: 'resource', lastSeen: 100 })

            pawn1.setGroupTrustIn(pawn2, 0.20)

            const trigger = pawn1.checkTerritorialOverlapTrigger()

            assert.strictEqual(trigger, null, 'Should not trigger without memory overlap')
        })
    })

    describe('Mercantile Group Formation', () => {
        it('should detect complementary skills for mercantile group', () => {
            const pawn1 = new Pawn('p31', 'Pawn31', 100, 100)
            const pawn2 = new Pawn('p32', 'Pawn32', 105, 105)
            const world = createWorldWith(pawn1, pawn2)

            // Give them different skills
            pawn1.skills = { hunting: 0.5, tracking: 0.4 }
            pawn2.skills = { crafting: 0.5, smithing: 0.4 }

            pawn1.setGroupTrustIn(pawn2, 0.25)

            const trigger = pawn1.checkMercantileGroupFormationTrigger()

            assert.ok(trigger, 'Should detect complementary skills')
            assert.strictEqual(trigger.type, 'mercantile', 'Should be mercantile type')
            assert.ok(trigger.members.includes(pawn1), 'Should include self')
            assert.ok(trigger.members.includes(pawn2), 'Should include other pawn')
        })

        it('should require minimum trust for mercantile group', () => {
            const pawn1 = new Pawn('p33', 'Pawn33', 200, 200)
            const pawn2 = new Pawn('p34', 'Pawn34', 205, 205)
            const world = createWorldWith(pawn1, pawn2)

            pawn1.skills = { hunting: 0.5 }
            pawn2.skills = { crafting: 0.5 }

            pawn1.setGroupTrustIn(pawn2, 0.20)  // Below 0.25 threshold

            const trigger = pawn1.checkMercantileGroupFormationTrigger()

            assert.strictEqual(trigger, null, 'Should not trigger with trust < 0.25')
        })

        it('should work with moderate skill diversity', () => {
            const pawn1 = new Pawn('p35', 'Pawn35', 300, 300)
            const pawn2 = new Pawn('p36', 'Pawn36', 305, 305)
            const world = createWorldWith(pawn1, pawn2)

            // Moderate diversity: 2 overlapping from 5 total = 60% diversity
            pawn1.skills = { hunting: 0.5, tracking: 0.4, archery: 0.3, survival: 0.5 }
            pawn2.skills = { hunting: 0.6, tracking: 0.5, archery: 0.4 }

            pawn1.setGroupTrustIn(pawn2, 0.30)

            const trigger = pawn1.checkMercantileGroupFormationTrigger()

            assert.ok(trigger, 'Should trigger with moderate skill diversity')
            assert.strictEqual(trigger.type, 'mercantile', 'Should be mercantile type')
        })

        it('should require sufficient skill level (>0.3)', () => {
            const pawn1 = new Pawn('p37', 'Pawn37', 400, 400)
            const pawn2 = new Pawn('p38', 'Pawn38', 405, 405)
            const world = createWorldWith(pawn1, pawn2)

            // Low skill levels
            pawn1.skills = { hunting: 0.2 }  // Below threshold
            pawn2.skills = { crafting: 0.2 }

            pawn1.setGroupTrustIn(pawn2, 0.30)

            const trigger = pawn1.checkMercantileGroupFormationTrigger()

            assert.strictEqual(trigger, null, 'Should not trigger with low skill levels')
        })
    })

    describe('Trust Scaling and Balance', () => {
        it('should reflect trust priority: hunts > shared cache > single cache > safe nights', () => {
            const pawn1 = new Pawn('p39', 'Pawn39', 100, 100)
            const pawn2 = new Pawn('p40', 'Pawn40', 105, 105)
            const pawn3 = new Pawn('p41', 'Pawn41', 110, 110)
            const pawn4 = new Pawn('p42', 'Pawn42', 115, 115)
            const pawn5 = new Pawn('p57', 'Pawn57', 120, 120)
            const world = createWorldWith(pawn1, pawn2, pawn3, pawn4, pawn5)

            // Hunt: 0.15 per success
            pawn1.registerHuntSuccess([pawn2])
            const huntTrust = pawn1.getGroupTrustIn(pawn2) ?? 0

            // Shared cache contribution: 0.12 per contribution
            pawn1.registerSharedCacheContribution('cache-1', [pawn3])
            const sharedCacheTrust = pawn1.getGroupTrustIn(pawn3) ?? 0

            // Single cache use: 0.10 per use
            pawn1.notifyCacheSharing(pawn4.id)
            const cacheTrust = pawn1.getGroupTrustIn(pawn4) ?? 0

            // Safe night: 0.05 per night
            pawn1.registerSafeNightTrust([pawn5])
            const nightTrust = pawn1.getGroupTrustIn(pawn5) ?? 0

            assert.ok(huntTrust > sharedCacheTrust, 'Hunt trust should exceed shared cache trust')
            assert.ok(sharedCacheTrust > cacheTrust, 'Shared cache trust should exceed single cache trust')
            assert.ok(cacheTrust > nightTrust, 'Cache trust should exceed night trust')
            assert.ok(Math.abs(huntTrust - 0.15) < 0.001, `Hunt = 0.15, got ${huntTrust}`)
            assert.ok(Math.abs(sharedCacheTrust - 0.12) < 0.001, `Shared cache = 0.12, got ${sharedCacheTrust}`)
            assert.ok(Math.abs(cacheTrust - 0.10) < 0.001, `Cache = 0.10, got ${cacheTrust}`)
            assert.ok(Math.abs(nightTrust - 0.05) < 0.001, `Night = 0.05, got ${nightTrust}`)
        })

        it('should allow mixed trust sources to combine', () => {
            const pawn1 = new Pawn('p43', 'Pawn43', 200, 200)
            const pawn2 = new Pawn('p44', 'Pawn44', 205, 205)
            const world = createWorldWith(pawn1, pawn2)

            // Combine all trust sources
            pawn1.registerHuntSuccess([pawn2])  // +0.15 = 0.15
            pawn1.registerProximityTrustGain([pawn2])  // +0.08 = 0.23
            pawn1.registerSharedCacheContribution('cache-1', [pawn2])  // +0.12 = 0.35
            pawn1.notifyCacheSharing(pawn2.id)  // +0.10 = 0.45
            pawn1.registerSafeNightTrust([pawn2])  // +0.05 = 0.50

            const trust = pawn1.getGroupTrustIn(pawn2) ?? 0
            assert.ok(Math.abs(trust - 0.50) < 0.001, `All trust sources should combine to 0.50, got ${trust}`)
        })
    })

    describe('Runtime Wiring', () => {
        it('should grant contribution trust when stashing into an already-contributed shared cache', () => {
            const pawn1 = new Pawn('p58', 'Pawn58', 100, 100)
            const pawn2 = new Pawn('p59', 'Pawn59', 104, 104)
            const cache = new ResourceCache('cache_rt_1', 'Shared Cache', 102, 102, { ownerId: pawn2.id, shared: true })
            const world = createWorldWith(pawn1, pawn2, cache)

            pawn2.addItemToInventory({ id: 'stick_rt_a', type: 'stick', name: 'Stick' })
            pawn2.stashInventoryInCache({ cache, itemTypes: ['stick'], maxItems: 1 })

            pawn1.addItemToInventory({ id: 'stick_rt_b', type: 'stick', name: 'Stick' })
            pawn1.stashInventoryInCache({ cache, itemTypes: ['stick'], maxItems: 1 })

            const trust = pawn1.getGroupTrustIn(pawn2) ?? 0
            assert.ok(Math.abs(trust - 0.12) < 0.001, `Shared contribution should add 0.12 trust, got ${trust}`)
        })

        it('should grant cache-sharing trust when retrieving from another pawn\'s cache', () => {
            const pawn1 = new Pawn('p60', 'Pawn60', 200, 200)
            const pawn2 = new Pawn('p61', 'Pawn61', 203, 203)
            const cache = new ResourceCache('cache_rt_2', 'Owner Cache', 202, 202, { ownerId: pawn2.id, shared: true })
            const world = createWorldWith(pawn1, pawn2, cache)

            cache.addItem({ id: 'stick_rt_1', type: 'stick', name: 'Stick' }, world.clock.currentTick)
            const retrieved = pawn1.retrieveFromCache({ cache, itemType: 'stick', count: 1 })

            assert.strictEqual(retrieved, 1, 'Pawn should retrieve one item from cache')
            const trust = pawn1.getGroupTrustIn(pawn2) ?? 0
            assert.ok(Math.abs(trust - 0.10) < 0.001, `Cache retrieval should add 0.10 trust, got ${trust}`)
        })

        it('should share social landmarks when a socialize goal completes', () => {
            const speaker = new Pawn('p62', 'Speaker', 300, 300)
            const listener = new Pawn('p63', 'Listener', 303, 303)
            const world = createWorldWith(speaker, listener)

            speaker.rememberLandmark({
                x: 320,
                y: 315,
                type: 'resource_cache',
                significance: 6,
                name: 'North Cache',
                event: 'stashed'
            })

            speaker.goals.currentGoal = {
                type: 'socialize',
                description: 'Interact with others',
                target: listener,
                completionReward: { social: -10 }
            }

            speaker.goals.completeCurrentGoal()

            const sharedLandmark = listener.memoryMap.find(lm => lm.type === 'resource_cache' && lm.event === 'shared_social')
            assert.ok(sharedLandmark, 'Listener should receive a shared social landmark')
        })
    })
})
