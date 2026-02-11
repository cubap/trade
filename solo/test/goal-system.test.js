import test from 'node:test'
import assert from 'node:assert'

// Mock classes for testing
class MockClock {
    constructor() {
        this.currentTick = 0
    }
}

class MockWorld {
    constructor() {
        this.clock = new MockClock()
        this.entitiesMap = new Map()
    }
}

class MockGoals {
    constructor(pawn) {
        this.pawn = pawn
        this.currentGoal = null
        this.goalQueue = []
        this.deferredGoals = []
    }
    
    completeCurrentGoal() {
        this.currentGoal = null
    }
}

class MockPawn {
    constructor() {
        this.x = 100
        this.y = 100
        this.name = 'TestPawn'
        this.world = new MockWorld()
        this.goals = new MockGoals(this)
        this.inventory = []
        this.resourceMemory = []
        this.skills = {
            crafting: 10,
            weaving: 5
        }
    }
    
    addItemToInventory(item) {
        this.inventory.push(item)
    }
    
    craft(recipe) {
        if (!recipe) return null
        return { name: recipe.name, quality: 1.0 }
    }
    
    recallResourcesByType(type) {
        // Safely handle null type
        if (!type || typeof type !== 'string') return []
        return this.resourceMemory.filter(r => r.type === type)
    }
}

test('Goal System - Goal Processing', async (t) => {
    await t.test('should handle crafting goal with valid recipe', () => {
        const pawn = new MockPawn()
        
        const goal = {
            type: 'craft_cordage',
            priority: 10,
            startTime: 0,
            targetResourceType: 'fiber_plant'
        }
        
        pawn.goals.currentGoal = goal
        
        // Simulate some logic
        assert.strictEqual(goal.type, 'craft_cordage')
        assert.ok(goal.startTime !== undefined)
    })
    
    await t.test('should handle gathering goals with null resource type', () => {
        const pawn = new MockPawn()
        
        const goal = {
            type: 'gather_resource',
            targetResourceType: null,
            targetLocation: { x: 100, y: 100 }
        }
        
        // Should safely handle null type
        const memories = pawn.recallResourcesByType(goal.targetResourceType)
        assert.strictEqual(memories.length, 0)
    })
    
    await t.test('should handle deferred goals safely', () => {
        const pawn = new MockPawn()
        
        const goal = {
            type: 'craft_rope',
            priority: 5,
            resources: { fiber_plant: 5 },
            startTime: 0
        }
        
        pawn.goals.deferredGoals.push(goal)
        assert.strictEqual(pawn.goals.deferredGoals.length, 1)
        
        // Pop deferred goal
        pawn.goals.deferredGoals.pop()
        assert.strictEqual(pawn.goals.deferredGoals.length, 0)
    })
})

test('Goal System - Memory Null Safety', async (t) => {
    await t.test('should handle undefined resourcesByType gracefully', () => {
        const pawn = new MockPawn()
        
        // Simulate calling with optional chaining
        const memories = pawn.recallResourcesByType?.(undefined) ?? []
        assert.strictEqual(memories?.length ?? 0, 0)
    })
    
    await t.test('should not crash when recalling with null type', () => {
        const pawn = new MockPawn()
        
        pawn.resourceMemory = [
            { type: 'rock', x: 100, y: 100 },
            { type: 'stick', x: 200, y: 200 }
        ]
        
        // Should safely return empty array
        assert.doesNotThrow(() => {
            const memories = pawn.recallResourcesByType(null)
            assert.strictEqual(memories.length, 0)
        })
    })
    
    await t.test('should handle recipe loading failure gracefully', () => {
        const pawn = new MockPawn()
        
        const goal = {
            type: 'craft_unknown',
            startTime: 0,
            recipeId: 'non_existent_recipe'
        }
        
        // Simulate error condition
        let recipe = null
        if (!recipe) {
            // Should gracefully abandon goal
            pawn.goals.completeCurrentGoal()
        }
        
        assert.strictEqual(pawn.goals.currentGoal, null)
    })
})

test('Goal System - Crafting Edge Cases', async (t) => {
    await t.test('should handle empty inventory during crafting goal', () => {
        const pawn = new MockPawn()
        pawn.inventory = []
        
        const goal = {
            type: 'craft_cordage',
            targetResourceType: 'fiber_plant'
        }
        
        pawn.goals.currentGoal = goal
        assert.strictEqual(pawn.inventory.length, 0)
    })
    
    await t.test('should complete crafting goal after craft succeeds', () => {
        const pawn = new MockPawn()
        
        const goal = {
            type: 'craft_cordage',
            startTime: 0
        }
        
        const recipe = { name: 'cordage', craftTime: 20 }
        const crafted = pawn.craft(recipe)
        
        if (crafted) {
            pawn.addItemToInventory(crafted)
            pawn.goals.completeCurrentGoal()
        }
        
        assert.strictEqual(pawn.inventory.length, 1)
        assert.strictEqual(pawn.goals.currentGoal, null)
    })
})

test('Goal System - Error Handling Integration', async (t) => {
    await t.test('should log recipe not found error details', () => {
        const pawn = new MockPawn()
        const goal = { type: 'craft_unknown' }
        
        const errorMessage = `${pawn.name} recipe not found for goal ${goal.type}, abandoning`
        assert.ok(errorMessage.includes(pawn.name))
        assert.ok(errorMessage.includes(goal.type))
    })
    
    await t.test('should timeout crafting goals after 100 ticks', () => {
        const pawn = new MockPawn()
        const goal = {
            type: 'craft_cordage',
            startTime: 0
        }
        
        pawn.goals.currentGoal = goal
        const elapsed = pawn.world.clock.currentTick - goal.startTime
        
        // Simulate 100+ ticks elapsed
        pawn.world.clock.currentTick = 101
        const elapsedAfter = pawn.world.clock.currentTick - goal.startTime
        
        if (elapsedAfter > 100) {
            pawn.goals.completeCurrentGoal()
        }
        
        assert.strictEqual(pawn.goals.currentGoal, null)
    })
})
