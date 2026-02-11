import test from 'node:test'
import assert from 'node:assert'

// Mock Pawn class for testing memory system
class MockWorld {
    constructor() {
        this.clock = {
            currentTick: 0
        }
    }
}

class MockPawn {
    constructor() {
        this.x = 500
        this.y = 500
        this.name = 'TestPawn'
        this.resourceMemory = []
        this.world = new MockWorld()
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
        this.maxResourceMemory = 50
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
            memoryPhase: 1
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
                
                return (distA + ageA * 0.1 - confA * 100) - (distB + ageB * 0.1 - confB * 100)
            })
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
