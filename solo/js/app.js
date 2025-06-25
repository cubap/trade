import World from './core/World.js'
import CanvasRenderer from './rendering/CanvasRenderer.js'
import setupControls from './ui/controls.js'
import { Pawn, Animal } from './models/entities/index.js'
import ResourceGenerator from './core/ResourceGenerator.js'

// Create a larger world
const world = new World(2000, 2000)
const renderer = new CanvasRenderer(world, 'game-canvas')

// Add after world initialization and before other entities
const resourceGenerator = new ResourceGenerator(world)
resourceGenerator.generateResources()

// Initialize only mobile entities
function initializeEntities() {
    // Add some pawns
    const pawn1 = new Pawn('pawn1', 'Explorer', 200, 200)
    const pawn2 = new Pawn('pawn2', 'Builder', 400, 300)
    const pawn3 = new Pawn('pawn3', 'Scout', 800, 500)
    
    // Add some animals
    const animal1 = new Animal('animal1', 'Rabbit', 300, 400)
    animal1.species = 'rabbit'
    animal1.diet = 'herbivore'
    
    const animal2 = new Animal('animal2', 'Fox', 600, 700)
    animal2.species = 'fox'
    animal2.diet = 'carnivore'
    animal2.predator = true
    
    // Add all entities to world
    world.addEntity(pawn1)
    world.addEntity(pawn2)
    world.addEntity(pawn3)
    world.addEntity(animal1)
    world.addEntity(animal2)
    
    console.log('Initialized entities:', world.entitiesMap.size)
    console.log('Pawn1 type:', pawn1.type, 'subtype:', pawn1.subtype)
    console.log('Entities list:')
    for (const [id, entity] of world.entitiesMap.entries()) {
        console.log(`  ${id}: ${entity.name} (${entity.type}/${entity.subtype})`)
    }
}

// Call initialization
initializeEntities()

// Setup UI controls
const controls = setupControls(world, renderer)

// Animation loop
function simulationLoop(timestamp) {
    try {
        // Only update the world if not paused
        if (!controls.isPaused()) {
            world.update(timestamp)
            updatePawnStatus()  // Update status display
        } else {
            // When paused, ensure the clock doesn't accumulate time
            world.clock.lastTimestamp = timestamp
        }
        
        // Always render to show current state
        renderer.render()
        
        // Continue the animation loop
        requestAnimationFrame(simulationLoop)
    } catch (error) {
        console.error('Error in simulation loop:', error)
        // Try to continue despite errors
        setTimeout(() => requestAnimationFrame(simulationLoop), 100)
    }
}

// Update pawn status display
function updatePawnStatus() {
    const statusPanel = document.getElementById('pawn-status')
    if (!statusPanel) return
    
    let statusHTML = ''
    
    // Debug: Show total entities
    statusHTML += `<div><strong>Total Entities: ${world.entitiesMap.size}</strong></div>`
    
    // Find all pawns and display their status
    for (const [id, entity] of world.entitiesMap.entries()) {
        if (entity.subtype === 'pawn') {
            try {
                const status = entity.getStatus()
                const mostUrgent = entity.needs.getMostUrgentNeed()
                
                let needClass = 'need-low'
                if (mostUrgent.urgency >= 4) needClass = 'need-critical'
                else if (mostUrgent.urgency >= 3) needClass = 'need-high'
                else if (mostUrgent.urgency >= 2) needClass = 'need-medium'
                
                statusHTML += `
                    <div class="pawn-info">
                        <strong>${entity.name}</strong> (${Math.round(entity.x)}, ${Math.round(entity.y)})<br>
                        <small>State: ${status.behaviorState}</small><br>
                        <small>Goal: ${status.currentGoal}</small><br>
                        <span class="${needClass}">
                            Most Urgent: ${mostUrgent.need} (${Math.round(mostUrgent.value)})
                        </span><br>
                        <small>Inventory: ${status.inventoryCount} items</small>
                    </div>
                `
            } catch (error) {
                statusHTML += `<div class="pawn-info">Error with ${entity.name}: ${error.message}</div>`
            }
        } else {
            // Show other entity types for debugging
            statusHTML += `<div><small>${entity.name} (${entity.type}/${entity.subtype})</small></div>`
        }
    }
    
    statusPanel.innerHTML = statusHTML
}

// Start the simulation
requestAnimationFrame(simulationLoop)
