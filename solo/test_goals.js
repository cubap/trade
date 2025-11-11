// Test Helper for Hierarchical Goal System
// Paste this into browser console after game loads

function testGoalDecomposition() {
    console.log('=== Testing Hierarchical Goal System ===')
    
    // Find a pawn
    const pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
    if (!pawn) {
        console.error('No pawn found in world!')
        return
    }
    
    console.log(`Found pawn: ${pawn.name}`)
    console.log(`Current inventory:`, pawn.inventory)
    console.log(`Resource memory:`, pawn.resourceMemory.length, 'locations')
    
    // Show remembered resources by type
    const rockMemories = pawn.recallResourcesByType('rock')
    const stickMemories = pawn.recallResourcesByType('stick')
    const fiberMemories = pawn.recallResourcesByType('fiber_plant')
    
    console.log(`Remembered rocks: ${rockMemories.length}`)
    console.log(`Remembered sticks: ${stickMemories.length}`)
    console.log(`Remembered fiber plants: ${fiberMemories.length}`)
    
    // Test crafting cordage (requires 3x fiber_plant)
    console.log('\n--- Testing Cordage Craft Goal ---')
    const cordageGoal = {
        type: 'craft_cordage',
        priority: 10,
        description: 'Test craft cordage with decomposition'
    }
    
    // This will trigger decomposition
    pawn.goals.goalQueue.push(cordageGoal)
    console.log('Cordage goal added to queue')
    console.log('Goal queue length:', pawn.goals.goalQueue.length)
    console.log('Deferred goals:', pawn.goals.deferredGoals.length)
    
    // Force evaluation
    pawn.goals.evaluateAndSetGoals()
    
    console.log('\nAfter evaluation:')
    console.log('Current goal:', pawn.goals.currentGoal?.type)
    console.log('Goal queue:', pawn.goals.goalQueue.map(g => g.type))
    console.log('Deferred goals:', pawn.goals.deferredGoals.map(g => g.type))
    
    return pawn
}

function watchPawnProgress(pawn) {
    if (!pawn) {
        const p = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
        if (!p) {
            console.error('No pawn found!')
            return
        }
        pawn = p
    }
    
    console.log(`\n=== ${pawn.name} Status ===`)
    console.log(`Behavior: ${pawn.behaviorState}`)
    console.log(`Current Goal: ${pawn.goals.currentGoal?.type || 'none'}`)
    if (pawn.goals.currentGoal) {
        console.log(`  - Description: ${pawn.goals.currentGoal.description}`)
        console.log(`  - Target: ${pawn.goals.currentGoal.targetResourceType || 'none'}`)
        console.log(`  - Progress: ${pawn.goals.currentGoal.gatheredCount || 0}/${pawn.goals.currentGoal.count || '?'}`)
    }
    console.log(`Goal Queue: ${pawn.goals.goalQueue.length} goals`)
    pawn.goals.goalQueue.slice(0, 5).forEach((g, i) => {
        console.log(`  ${i+1}. ${g.type} - ${g.description}`)
    })
    console.log(`Deferred Goals: ${pawn.goals.deferredGoals.length}`)
    console.log(`Inventory: ${pawn.inventory.length} items`)
    pawn.inventory.forEach(item => {
        console.log(`  - ${item.type}`)
    })
    console.log(`Resource Memory: ${pawn.resourceMemory.length} locations`)
}

function autoWatch(pawn, intervalMs = 5000) {
    if (!pawn) {
        const p = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
        if (!p) {
            console.error('No pawn found!')
            return
        }
        pawn = p
    }
    
    console.log('Starting auto-watch (every 5 seconds)...')
    const interval = setInterval(() => watchPawnProgress(pawn), intervalMs)
    
    // Return cleanup function
    return () => {
        clearInterval(interval)
        console.log('Auto-watch stopped')
    }
}

function testResourceMemory() {
    const pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
    if (!pawn) {
        console.error('No pawn found!')
        return
    }
    
    console.log('=== Resource Memory Test ===')
    console.log('Forcing resource observation...')
    
    // Force observe nearby resources
    pawn.observeNearbyResources(200)
    
    console.log(`Total remembered: ${pawn.resourceMemory.length}`)
    
    // Group by type
    const byType = {}
    pawn.resourceMemory.forEach(mem => {
        byType[mem.type] = (byType[mem.type] || 0) + 1
    })
    
    console.log('Resources by type:')
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`)
    })
    
    return pawn
}

function findNearbyResources(pawn, radius = 200) {
    if (!pawn) {
        const p = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
        if (!p) {
            console.error('No pawn found!')
            return
        }
        pawn = p
    }
    
    console.log('=== Nearby Resources ===')
    const entities = Array.from(world.entitiesMap.values())
    const nearby = entities.filter(e => {
        if (!e.gather && !e.tags?.includes('harvestable')) return false
        const dx = e.x - pawn.x
        const dy = e.y - pawn.y
        return Math.sqrt(dx * dx + dy * dy) <= radius
    })
    
    console.log(`Found ${nearby.length} harvestable resources within ${radius} units`)
    
    // Group by type
    const byType = {}
    nearby.forEach(e => {
        const type = e.subtype || e.type
        byType[type] = (byType[type] || 0) + 1
    })
    
    console.log('By type:')
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`)
    })
    
    // Show closest 5
    nearby.sort((a, b) => {
        const distA = Math.sqrt((a.x - pawn.x) ** 2 + (a.y - pawn.y) ** 2)
        const distB = Math.sqrt((b.x - pawn.x) ** 2 + (b.y - pawn.y) ** 2)
        return distA - distB
    })
    
    console.log('\nClosest 5 resources:')
    nearby.slice(0, 5).forEach((e, i) => {
        const dist = Math.sqrt((e.x - pawn.x) ** 2 + (e.y - pawn.y) ** 2)
        console.log(`  ${i+1}. ${e.subtype || e.type} at (${Math.round(e.x)}, ${Math.round(e.y)}) - ${Math.round(dist)} units away`)
    })
    
    return nearby
}

// Export to window for easy access
window.goalTests = {
    testGoalDecomposition,
    watchPawnProgress,
    autoWatch,
    testResourceMemory,
    findNearbyResources
}

console.log('Goal testing functions loaded!')
console.log('Available commands:')
console.log('  goalTests.testGoalDecomposition() - Test craft goal decomposition')
console.log('  goalTests.watchPawnProgress(pawn) - Show current pawn status')
console.log('  goalTests.autoWatch(pawn) - Auto-update pawn status every 5s')
console.log('  goalTests.testResourceMemory() - Force resource observation')
console.log('  goalTests.findNearbyResources(pawn, radius) - Show nearby harvestable resources')
