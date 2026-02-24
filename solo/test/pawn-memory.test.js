import test from 'node:test'
import assert from 'node:assert'

// Mock Pawn class for testing memory system
class MockWorld {
    constructor() {
        this.clock = {
            currentTick: 0
        }
        this.entitiesMap = new Map()
    }
}

class MockPawn {
    constructor() {
        this.x = 500
        this.y = 500
        this.name = 'TestPawn'
        this.resourceMemory = []
        this.world = new MockWorld()
        this.memoryPhase = 3
        this.maxResourceMemory = 50
        this.skills = {
            memoryClustering: 0,
            routePlanning: 0,
            storytelling: 0
        }
        this.id = `pawn-${Math.random().toString(16).slice(2)}`
        this.subtype = 'pawn'
        this.world.entitiesMap.set(this.id, this)
    }

    increaseSkill(skill, amount = 1) {
        this.skills[skill] = (this.skills[skill] ?? 0) + amount
    }
    
    // Copy of the implementation we're testing
    rememberResource(entity) {
        if (!entity?.x || !entity?.y || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return
        
        const tick = this.world?.clock?.currentTick ?? 0
        const resourceType = entity.subtype || entity.type
        
        if (!resourceType || typeof resourceType !== 'string') {
            console.warn(`${this.name} tried to remember resource without valid type:`, entity)
            return
        }
        
        const canCluster = this.memoryPhase >= 3 || (this.skills.memoryClustering ?? 0) >= 10
        const clusterRadius = 20

        if (canCluster) {
            const cluster = this.resourceMemory.find(r => {
                if (r.type !== resourceType) return false
                const dx = r.x - entity.x
                const dy = r.y - entity.y
                return Math.sqrt(dx * dx + dy * dy) <= clusterRadius
            })

            if (cluster) {
                const priorCount = Math.max(1, cluster.clusterCount ?? 1)
                const nextCount = priorCount + 1
                cluster.x = ((cluster.x * priorCount) + entity.x) / nextCount
                cluster.y = ((cluster.y * priorCount) + entity.y) / nextCount
                cluster.clusterCount = nextCount
                cluster.lastSeen = tick
                cluster.amount = Math.max(cluster.amount ?? 1, entity.amount ?? 1)
                cluster.confidence = Math.min(1.0, (cluster.confidence ?? 0.5) + 0.03)
                this.increaseSkill('memoryClustering', 0.04)
                return
            }
        }

        // Check if already remembered (same location and type)
        const existing = this.resourceMemory.find(r => {
            const dx = Math.abs(r.x - entity.x)
            const dy = Math.abs(r.y - entity.y)
            return dx < 5 && dy < 5 && r.type === resourceType
        })
        
        if (existing) {
            existing.lastSeen = tick
            existing.amount = entity.amount ?? 1
            existing.x = entity.x
            existing.y = entity.y
            return
        }
        
        // Add new memory
        if (this.resourceMemory.length >= this.maxResourceMemory) {
            this.resourceMemory.sort((a, b) => {
                const confA = a.confidence ?? 0.5
                const confB = b.confidence ?? 0.5
                const ageA = tick - a.lastSeen
                const ageB = tick - b.lastSeen
                return (confA - ageA * 0.001) - (confB - ageB * 0.001)
            })
            const removed = this.resourceMemory.shift()
            if (!removed) return
        }
        
        const initialConfidence = 0.7
        this.resourceMemory.push({
            type: resourceType,
            tags: [],
            x: entity.x,
            y: entity.y,
            lastSeen: tick,
            amount: entity.amount ?? 1,
            id: entity.id,
            successCount: 0,
            failCount: 0,
            confidence: initialConfidence,
            memoryPhase: this.memoryPhase,
            clusterCount: 1,
            source: 'self'
        })
    }
    
    recallResourcesByType(type) {
        const tick = this.world?.clock?.currentTick ?? 0
        const maxAge = 2000
        const minConfidence = 0.2
        
        // Memory decay: remove very stale or low-confidence memories
        this.resourceMemory = this.resourceMemory.filter(r => {
            if ((tick - r.lastSeen) > maxAge) return false
            const conf = r.confidence ?? 0.5
            if (conf < 0.1) return false
            return true
        })
        
        return this.resourceMemory
            .filter(r => {
                const conf = r.confidence ?? 0.5
                return r.type === type && (tick - r.lastSeen) < maxAge && conf >= minConfidence
            })
            .sort((a, b) => {
                const distA = Math.sqrt((this.x - a.x) ** 2 + (this.y - a.y) ** 2)
                const distB = Math.sqrt((this.x - b.x) ** 2 + (this.y - b.y) ** 2)
                const ageA = tick - a.lastSeen
                const ageB = tick - b.lastSeen
                const confA = a.confidence ?? 0.5
                const confB = b.confidence ?? 0.5
                const clusterA = a.clusterCount ?? 1
                const clusterB = b.clusterCount ?? 1
                const observedSignalA = ((a.observedSuccessCount ?? 0) * 7) - ((a.observedFailCount ?? 0) * 4)
                const observedSignalB = ((b.observedSuccessCount ?? 0) * 7) - ((b.observedFailCount ?? 0) * 4)
                const routeSkill = this.skills.routePlanning ?? 0
                const clusterWeight = routeSkill >= 5 ? 6 : 0
                
                return (distA + ageA * 0.1 - confA * 100 - clusterA * clusterWeight - observedSignalA) - (distB + ageB * 0.1 - confB * 100 - clusterB * clusterWeight - observedSignalB)
            })
    }

    updateResourceMemoryConfidence(resource, success) {
        if (!resource?.x || !resource?.y) return

        const tick = this.world?.clock?.currentTick ?? 0
        const resourceType = resource.subtype || resource.type
        const memory = this.resourceMemory.find(r => {
            const dx = Math.abs(r.x - resource.x)
            const dy = Math.abs(r.y - resource.y)
            return dx < 5 && dy < 5 && r.type === resourceType
        })

        if (memory) {
            memory.lastVisited = tick

            if (success) {
                memory.successCount = (memory.successCount ?? 0) + 1
                memory.revisitFailStreak = 0
                const recoveryBoost = Math.min(0.06, (memory.failCount ?? 0) * 0.01)
                memory.confidence = Math.min(1.0, (memory.confidence ?? 0.5) + 0.12 + recoveryBoost)
            } else {
                memory.failCount = (memory.failCount ?? 0) + 1
                memory.revisitFailStreak = (memory.revisitFailStreak ?? 0) + 1
                const revisitPenalty = Math.min(0.35, 0.16 + memory.revisitFailStreak * 0.05)
                memory.confidence = Math.max(0.0, (memory.confidence ?? 0.5) - revisitPenalty)
            }
        }

        this.broadcastGatheringObservation(resource, success)
    }

    observeGatheringOutcome(outcome = {}, observerWeight = 1) {
        const type = outcome.type
        const x = outcome.x
        const y = outcome.y
        const success = outcome.success === true

        if (!type || typeof type !== 'string') return
        if (!Number.isFinite(x) || !Number.isFinite(y)) return

        const normalizedWeight = Math.max(0.5, Math.min(1.5, observerWeight))

        const memory = this.resourceMemory.find(r => {
            if (r.type !== type) return false
            const dx = r.x - x
            const dy = r.y - y
            return Math.sqrt(dx * dx + dy * dy) <= 20
        })

        if (!memory) {
            if (success) {
                this.learnResourceLocation({
                    type,
                    x,
                    y,
                    confidence: 0.4 * normalizedWeight,
                    clusterCount: 1,
                    sourcePawnId: outcome.sourcePawnId ?? null
                })
            }
            return
        }

        if (success) {
            memory.observedSuccessCount = (memory.observedSuccessCount ?? 0) + 1
            memory.confidence = Math.min(1.0, (memory.confidence ?? 0.5) + 0.05 * normalizedWeight)
        } else {
            memory.observedFailCount = (memory.observedFailCount ?? 0) + 1
            memory.confidence = Math.max(0.0, (memory.confidence ?? 0.5) - 0.04 * normalizedWeight)
        }
    }

    broadcastGatheringObservation(resource, success) {
        if (!this.world?.entitiesMap) return

        const type = resource.subtype || resource.type
        if (!type) return

        const outcome = {
            type,
            x: resource.x,
            y: resource.y,
            success,
            sourcePawnId: this.id
        }

        for (const entity of this.world.entitiesMap.values()) {
            if (entity === this || entity?.subtype !== 'pawn') continue
            entity.observeGatheringOutcome?.(outcome, 1)
        }
    }

    planGatheringRoute(requirements = []) {
        if (!Array.isArray(requirements) || requirements.length === 0) return []

        const routeSkill = this.skills.routePlanning ?? 0
        const usesOptimizedRoute = routeSkill >= 5
        const route = []

        let currentX = this.x
        let currentY = this.y

        for (const requirement of requirements) {
            const type = requirement?.type
            const count = requirement?.count ?? 1
            if (!type) continue

            const memories = this.recallResourcesByType(type)
            if (!memories.length) {
                route.push({ type, count, location: null })
                continue
            }

            let selected = memories[0]
            if (usesOptimizedRoute) {
                selected = [...memories].sort((a, b) => {
                    const distA = Math.sqrt((a.x - currentX) ** 2 + (a.y - currentY) ** 2)
                    const distB = Math.sqrt((b.x - currentX) ** 2 + (b.y - currentY) ** 2)
                    const scoreA = distA - ((a.confidence ?? 0.5) * 40) - ((a.clusterCount ?? 1) * 10)
                    const scoreB = distB - ((b.confidence ?? 0.5) * 40) - ((b.clusterCount ?? 1) * 10)
                    return scoreA - scoreB
                })[0]
            }

            route.push({ type, count, location: { x: selected.x, y: selected.y } })
            currentX = selected.x
            currentY = selected.y
        }

        if (route.length > 1) {
            this.increaseSkill('routePlanning', usesOptimizedRoute ? 0.05 : 0.02)
        }

        return route
    }

    learnResourceLocation(knowledge = {}) {
        const type = knowledge.type
        const x = knowledge.x
        const y = knowledge.y

        if (!type || typeof type !== 'string') return false
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false

        const tick = this.world?.clock?.currentTick ?? 0
        const incomingConfidence = Math.max(0, Math.min(1, knowledge.confidence ?? 0.5))
        const incomingClusterCount = Math.max(1, knowledge.clusterCount ?? 1)

        const existing = this.resourceMemory.find(mem => {
            if (mem.type !== type) return false
            const dx = mem.x - x
            const dy = mem.y - y
            return Math.sqrt(dx * dx + dy * dy) <= 20
        })

        if (existing) {
            existing.confidence = Math.min(1, (existing.confidence ?? 0.5) + incomingConfidence * 0.2)
            existing.clusterCount = Math.max(existing.clusterCount ?? 1, incomingClusterCount)
            existing.lastSeen = tick
            existing.source = 'shared'
            this.increaseSkill('memoryClustering', 0.02)
            return true
        }

        this.resourceMemory.push({
            type,
            x,
            y,
            lastSeen: tick,
            confidence: incomingConfidence,
            clusterCount: incomingClusterCount,
            source: 'shared'
        })
        this.increaseSkill('memoryClustering', 0.03)
        return true
    }

    shareResourceMemory(otherPawn, options = {}) {
        if (!otherPawn || otherPawn === this) return 0

        const maxShare = options.maxShare ?? 3
        const minConfidence = options.minConfidence ?? 0.6

        const sharable = this.resourceMemory
            .filter(mem => (mem.confidence ?? 0.5) >= minConfidence)
            .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
            .slice(0, maxShare)

        let sharedCount = 0
        for (const memory of sharable) {
            const accepted = otherPawn.learnResourceLocation({
                type: memory.type,
                x: memory.x,
                y: memory.y,
                confidence: Math.max(0.3, (memory.confidence ?? 0.5) * 0.85),
                clusterCount: memory.clusterCount ?? 1,
                sourcePawnId: this.id
            })
            if (accepted) sharedCount++
        }

        if (sharedCount > 0) {
            this.increaseSkill('storytelling', 0.03 * sharedCount)
            this.increaseSkill('routePlanning', 0.01 * sharedCount)
        }

        return sharedCount
    }
}

test('Pawn Memory System - Resource Validation', async (t) => {
    await t.test('should reject resources with invalid coordinates', () => {
        const pawn = new MockPawn()
        
        assert.strictEqual(pawn.resourceMemory.length, 0)
        
        // Try to remember with NaN coordinates
        pawn.rememberResource({ type: 'rock', x: NaN, y: 500 })
        assert.strictEqual(pawn.resourceMemory.length, 0, 'Should not remember resource with NaN x')
        
        // Try to remember with missing coordinates
        pawn.rememberResource({ type: 'rock' })
        assert.strictEqual(pawn.resourceMemory.length, 0, 'Should not remember resource without coordinates')
        
        // Try to remember with string coordinates
        pawn.rememberResource({ type: 'rock', x: 'invalid', y: 500 })
        assert.strictEqual(pawn.resourceMemory.length, 0, 'Should not remember resource with string x')
    })
    
    await t.test('should reject resources without valid type', () => {
        const pawn = new MockPawn()
        
        pawn.rememberResource({ x: 100, y: 100, type: '' })
        assert.strictEqual(pawn.resourceMemory.length, 0, 'Should not remember resource with empty type')
        
        pawn.rememberResource({ x: 100, y: 100, type: null })
        assert.strictEqual(pawn.resourceMemory.length, 0, 'Should not remember resource with null type')
        
        pawn.rememberResource({ x: 100, y: 100, type: 123 })
        assert.strictEqual(pawn.resourceMemory.length, 0, 'Should not remember resource with number type')
    })
    
    await t.test('should successfully remember valid resources', () => {
        const pawn = new MockPawn()
        
        pawn.rememberResource({ type: 'rock', x: 100, y: 100 })
        assert.strictEqual(pawn.resourceMemory.length, 1)
        assert.strictEqual(pawn.resourceMemory[0].type, 'rock')
        assert.strictEqual(pawn.resourceMemory[0].confidence, 0.7)
    })
})

test('Pawn Memory System - Memory Decay', async (t) => {
    await t.test('should remove stale memories (older than maxAge)', () => {
        const pawn = new MockPawn()
        
        // Add a memory
        pawn.rememberResource({ type: 'rock', x: 100, y: 100 })
        assert.strictEqual(pawn.resourceMemory.length, 1)
        
        // Simulate time passage
        pawn.world.clock.currentTick = 3000 // Older than maxAge (2000)
        
        // Recall should trigger decay
        const recalled = pawn.recallResourcesByType('rock')
        
        // Should remove the stale memory
        assert.strictEqual(recalled.length, 0, 'Should not recall memories older than maxAge')
    })
    
    await t.test('should remove very low confidence memories', () => {
        const pawn = new MockPawn()
        
        // Add memory with low confidence
        pawn.resourceMemory.push({
            type: 'rock',
            x: 100,
            y: 100,
            lastSeen: 0,
            confidence: 0.05,  // Very low confidence
            successCount: 0,
            failCount: 10
        })
        
        pawn.world.clock.currentTick = 100
        
        const recalled = pawn.recallResourcesByType('rock')
        assert.strictEqual(recalled.length, 0, 'Should not recall memories with confidence < 0.1')
    })
    
    await t.test('should keep recent memories with good confidence', () => {
        const pawn = new MockPawn()
        
        pawn.rememberResource({ type: 'rock', x: 100, y: 100 })
        pawn.world.clock.currentTick = 100  // Recent
        
        const recalled = pawn.recallResourcesByType('rock')
        assert.strictEqual(recalled.length, 1)
        assert.strictEqual(recalled[0].type, 'rock')
    })
    
    await t.test('should sort by confidence, distance, and recency', () => {
        const pawn = new MockPawn()
        
        // Add multiple memories
        pawn.resourceMemory = [
            { type: 'rock', x: 600, y: 600, lastSeen: 0, confidence: 0.5, successCount: 0, failCount: 0 },
            { type: 'rock', x: 500, y: 500, lastSeen: 0, confidence: 0.9, successCount: 0, failCount: 0 },
            { type: 'rock', x: 510, y: 510, lastSeen: 0, confidence: 0.3, successCount: 0, failCount: 0 }
        ]
        
        pawn.world.clock.currentTick = 100
        
        const recalled = pawn.recallResourcesByType('rock')
        
        // Should prefer high confidence
        assert.strictEqual(recalled[0].confidence, 0.9, 'First recalled should have highest confidence')
    })
})

test('Pawn Memory System - Duplicate Detection', async (t) => {
    await t.test('should update existing memory at same location', () => {
        const pawn = new MockPawn()
        
        pawn.rememberResource({ type: 'rock', x: 100, y: 100, amount: 5 })
        assert.strictEqual(pawn.resourceMemory.length, 1)
        
        pawn.world.clock.currentTick = 100
        
        // Remember same rock at same location
        pawn.rememberResource({ type: 'rock', x: 102, y: 102, amount: 10 })
        assert.strictEqual(pawn.resourceMemory.length, 1, 'Should update existing nearby memory')
        assert.strictEqual(pawn.resourceMemory[0].amount, 10, 'Amount should be updated')
        assert.strictEqual(pawn.resourceMemory[0].lastSeen, 100, 'lastSeen should be updated')
    })
})

test('Pawn Memory System - Clustering and Route Learning', async (t) => {
    await t.test('should merge nearby same-type memories into a cluster', () => {
        const pawn = new MockPawn()

        pawn.rememberResource({ type: 'rock', x: 100, y: 100 })
        pawn.rememberResource({ type: 'rock', x: 112, y: 108 })

        assert.strictEqual(pawn.resourceMemory.length, 1, 'Nearby resources should cluster into one memory')
        assert.strictEqual(pawn.resourceMemory[0].clusterCount, 2, 'Cluster count should increase')
        assert.ok((pawn.skills.memoryClustering ?? 0) > 0, 'Clustering skill should gain experience')
    })

    await t.test('should produce route stops and improve routePlanning skill', () => {
        const pawn = new MockPawn()
        pawn.skills.routePlanning = 6

        pawn.resourceMemory.push(
            { type: 'rock', x: 490, y: 500, lastSeen: 0, confidence: 0.9, clusterCount: 2 },
            { type: 'fiber_plant', x: 520, y: 500, lastSeen: 0, confidence: 0.8, clusterCount: 3 }
        )

        const route = pawn.planGatheringRoute([
            { type: 'rock', count: 1 },
            { type: 'fiber_plant', count: 2 }
        ])

        assert.strictEqual(route.length, 2, 'Route should include one stop per requirement')
        assert.ok(route[0].location && route[1].location, 'Route should include target locations from memory')
        assert.ok((pawn.skills.routePlanning ?? 0) > 6, 'Route planning skill should improve from use')
    })
})

test('Pawn Memory System - Social Memory Sharing', async (t) => {
    await t.test('should share high-confidence memories and improve learner confidence', () => {
        const teacher = new MockPawn()
        const learner = new MockPawn()

        teacher.resourceMemory.push(
            { type: 'rock', x: 300, y: 300, confidence: 0.9, clusterCount: 3, lastSeen: 0 },
            { type: 'stick', x: 340, y: 300, confidence: 0.8, clusterCount: 2, lastSeen: 0 }
        )

        const shared = teacher.shareResourceMemory(learner, { maxShare: 2, minConfidence: 0.6 })

        assert.strictEqual(shared, 2, 'Teacher should share both high-confidence memories')
        assert.strictEqual(learner.resourceMemory.length, 2, 'Learner should gain shared memories')
        assert.ok((learner.skills.memoryClustering ?? 0) > 0, 'Learner should gain memory skill from shared knowledge')
        assert.ok((teacher.skills.storytelling ?? 0) > 0, 'Teacher should gain storytelling from sharing')
    })
})

test('Pawn Memory System - Revisit Decay and Observation Weighting', async (t) => {
    await t.test('should apply stronger confidence decay on repeated failed revisits', () => {
        const pawn = new MockPawn()
        pawn.resourceMemory.push({
            type: 'rock',
            x: 200,
            y: 200,
            confidence: 0.9,
            failCount: 0,
            revisitFailStreak: 0,
            lastSeen: 0
        })

        pawn.updateResourceMemoryConfidence({ type: 'rock', x: 200, y: 200 }, false)
        const afterFirst = pawn.resourceMemory[0].confidence
        pawn.updateResourceMemoryConfidence({ type: 'rock', x: 200, y: 200 }, false)
        const afterSecond = pawn.resourceMemory[0].confidence

        assert.ok(afterSecond < afterFirst, 'Repeated failed revisits should continue reducing confidence')
        assert.ok((pawn.resourceMemory[0].revisitFailStreak ?? 0) >= 2, 'Revisit fail streak should accumulate')
    })

    await t.test('should increase observer confidence when witnessing successful gathering', () => {
        const gatherer = new MockPawn()
        const observer = new MockPawn()

        gatherer.world = observer.world
        observer.world.entitiesMap.set(gatherer.id, gatherer)
        observer.world.entitiesMap.set(observer.id, observer)

        observer.resourceMemory.push({
            type: 'stick',
            x: 260,
            y: 260,
            confidence: 0.4,
            lastSeen: 0
        })

        gatherer.updateResourceMemoryConfidence({ type: 'stick', x: 260, y: 260 }, true)

        assert.ok((observer.resourceMemory[0].confidence ?? 0) > 0.4, 'Observed success should improve confidence')
        assert.ok((observer.resourceMemory[0].observedSuccessCount ?? 0) >= 1, 'Observed success count should be tracked')
    })
})
