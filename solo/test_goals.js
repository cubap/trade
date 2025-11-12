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

function testMemorySystem() {
    console.log('=== Testing Memory Phase System ===')
    
    const pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
    if (!pawn) {
        console.error('No pawn found!')
        return
    }
    
    console.log(`Pawn: ${pawn.name}`)
    console.log(`Memory Phase: ${pawn.memoryPhase} (1=egocentric, 2=allocentric, 3=clusters, 4=conceptual)`)
    console.log(`Orienteering: ${pawn.skills.orienteering ?? 0}`)
    console.log(`Cartography: ${pawn.skills.cartography ?? 0}`)
    console.log(`Memory slots: ${pawn.resourceMemory.length}/${pawn.maxResourceMemory}`)
    console.log(`Memory origin: (${pawn.memoryOrigin.x}, ${pawn.memoryOrigin.y})`)
    
    console.log('\n--- Resource Memories ---')
    pawn.resourceMemory.forEach((mem, i) => {
        const conf = (mem.confidence ?? 0.5).toFixed(2)
        const succ = mem.successCount ?? 0
        const fail = mem.failCount ?? 0
        const dir = pawn.getResourceDirection(mem)
        console.log(`${i+1}. ${mem.type}: ${dir}, confidence: ${conf} (${succ}✓/${fail}✗)`)
    })
    
    // Test skill boost
    console.log('\n--- Testing Skill Progression ---')
    console.log('Increasing orienteering skill to 15...')
    pawn.skills.orienteering = 15
    pawn.updateMemoryPhase()
    console.log(`New phase: ${pawn.memoryPhase}, slots: ${pawn.maxResourceMemory}`)
    
    console.log('\nIncreasing cartography skill to 25...')
    pawn.skills.cartography = 25
    pawn.updateMemoryPhase()
    console.log(`New phase: ${pawn.memoryPhase}, slots: ${pawn.maxResourceMemory}`)
    
    // Show direction format changes
    if (pawn.resourceMemory.length > 0) {
        console.log('\n--- Direction Format (Phase ' + pawn.memoryPhase + ') ---')
        console.log(pawn.getResourceDirection(pawn.resourceMemory[0]))
    }
    
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

function testInventionSystem() {
    console.log('=== Testing Invention & Pondering System ===')
    
    const pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
    if (!pawn) {
        console.error('No pawn found!')
        return
    }
    
    console.log(`Pawn: ${pawn.name}`)
    console.log(`Invention skill: ${pawn.skills.invention ?? 0}`)
    console.log(`Experimentation skill: ${pawn.skills.experimentation ?? 0}`)
    console.log(`Pondering queue: ${pawn.ponderingQueue.length} problems`)
    console.log(`Discovered solutions: ${pawn.discoveredSolutions.size}`)
    
    // Show pondering queue
    if (pawn.ponderingQueue.length > 0) {
        console.log('\n--- Active Problems ---')
        pawn.ponderingQueue.forEach((p, i) => {
            console.log(`${i+1}. ${p.type} (${p.attempts} attempts)`)
        })
    }
    
    // Show discovered solutions
    if (pawn.discoveredSolutions.size > 0) {
        console.log('\n--- Discovered Solutions ---')
        Array.from(pawn.discoveredSolutions).forEach((sol, i) => {
            console.log(`${i+1}. ${sol}`)
        })
    }
    
    // Test triggering a problem
    console.log('\n--- Triggering Test Problem ---')
    console.log('Attempting to add item when inventory is full...')
    pawn.inventory = ['rock', 'stick'] // Fill inventory
    pawn.addItemToInventory('fiber_plant')
    
    console.log(`Pondering queue now: ${pawn.ponderingQueue.length} problems`)
    
    return pawn
}

function boostInventionSkills(pawn) {
    if (!pawn) {
        pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
    }
    if (!pawn) {
        console.error('No pawn found!')
        return
    }
    
    console.log('Boosting invention skills...')
    pawn.skills.invention = 20
    pawn.skills.experimentation = 15
    pawn.skills.gathering = 10
    pawn.skills.crafting = 15
    
    console.log(`Invention: ${pawn.skills.invention}`)
    console.log(`Experimentation: ${pawn.skills.experimentation}`)
    console.log(`Gathering: ${pawn.skills.gathering}`)
    console.log(`Crafting: ${pawn.skills.crafting}`)
    console.log('With these skills, discovery chance is much higher!')
    
    return pawn
}

function forcePonderingCycle(pawn) {
    if (!pawn) {
        pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
    }
    if (!pawn) {
        console.error('No pawn found!')
        return
    }
    
    console.log('=== Forcing Pondering Cycles ===')
    console.log(`Queue length: ${pawn.ponderingQueue.length}`)
    
    if (pawn.ponderingQueue.length === 0) {
        console.log('No problems to ponder. Try testInventionSystem() first.')
        return
    }
    
    let cycles = 0
    let discovered = []
    
    // Force multiple pondering attempts
    for (let i = 0; i < 50; i++) {
        pawn.ponderingCooldown = 0 // Reset cooldown
        const solution = pawn.processPonderingQueue()
        cycles++
        
        if (solution) {
            discovered.push(solution)
            console.log(`\n✨ Discovery after ${cycles} cycles: ${solution.name}`)
            console.log(`   Description: ${solution.description}`)
            console.log(`   Unlocks: ${solution.unlocks}`)
            
            if (pawn.ponderingQueue.length === 0) {
                console.log('\nAll problems solved!')
                break
            }
        }
    }
    
    if (discovered.length === 0) {
        console.log(`\nNo discoveries after ${cycles} cycles.`)
        console.log('Try boostInventionSkills() for better odds.')
    }
    
    console.log(`\nFinal state:`)
    console.log(`  Problems remaining: ${pawn.ponderingQueue.length}`)
    console.log(`  Total solutions discovered: ${pawn.discoveredSolutions.size}`)
    
    return { pawn, discovered }
}

function simulateInventoryProblem(pawn) {
    if (!pawn) {
        pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')
    }
    if (!pawn) {
        console.error('No pawn found!')
        return
    }
    
    console.log('=== Simulating Inventory Problem Scenario ===')
    
    // Boost skills so discovery is likely
    pawn.skills.invention = 25
    pawn.skills.experimentation = 20
    pawn.skills.gathering = 15
    
    // Fill inventory
    pawn.inventory = ['rock', 'stick']
    console.log('Inventory filled:', pawn.inventory)
    
    // Try to add more items
    console.log('\nAttempting to gather more items...')
    pawn.addItemToInventory('fiber_plant')
    pawn.addItemToInventory('rock')
    
    console.log(`Pondering queue: ${pawn.ponderingQueue.length} problems`)
    console.log('Problems:', pawn.ponderingQueue.map(p => p.type).join(', '))
    
    // Force pondering until solution found
    console.log('\n--- Pondering Solution ---')
    let attempts = 0
    while (pawn.ponderingQueue.length > 0 && attempts < 100) {
        pawn.ponderingCooldown = 0
        const solution = pawn.processPonderingQueue()
        attempts++
        
        if (solution) {
            console.log(`\n💡 ${pawn.name} discovered: ${solution.name}`)
            console.log(`   ${solution.description}`)
            console.log(`   This unlocks the recipe: ${solution.unlocks}`)
            break
        }
    }
    
    console.log(`\nTook ${attempts} pondering attempts`)
    console.log(`Solutions discovered: ${Array.from(pawn.discoveredSolutions).join(', ')}`)
    
    return pawn
}

// Export to window for easy access
window.goalTests = {
    testGoalDecomposition,
    testMemorySystem,
    watchPawnProgress,
    autoWatch,
    testResourceMemory,
    findNearbyResources,
    testInventionSystem,
    boostInventionSkills,
    forcePonderingCycle,
    simulateInventoryProblem
}

console.log('Goal testing functions loaded!')
console.log('Available commands:')
console.log('  goalTests.testGoalDecomposition() - Test craft goal decomposition')
console.log('  goalTests.testMemorySystem() - Test memory phase system and confidence tracking')
console.log('  goalTests.watchPawnProgress(pawn) - Show current pawn status')
console.log('  goalTests.autoWatch(pawn) - Auto-update pawn status every 5s')
console.log('  goalTests.testResourceMemory() - Force resource observation')
console.log('  goalTests.findNearbyResources(pawn, radius) - Show nearby harvestable resources')
console.log('  goalTests.testInventionSystem() - Test invention and pondering system')
console.log('  goalTests.boostInventionSkills(pawn) - Give pawn high invention skills')
console.log('  goalTests.forcePonderingCycle(pawn) - Run multiple pondering attempts')
console.log('  goalTests.simulateInventoryProblem(pawn) - Full simulation of inventory problem → discovery')
