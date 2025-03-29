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
}

// Call initialization
initializeEntities()

// Setup UI controls
const controls = setupControls(world, renderer)

// Animation loop
function simulationLoop(timestamp) {
    // Only update the world if not paused
    if (!controls.isPaused()) {
        world.update(timestamp)
    } else {
        // When paused, ensure the clock doesn't accumulate time
        world.clock.lastTimestamp = timestamp
    }
    
    // Always render to show current state
    renderer.render()
    
    // Continue the animation loop
    requestAnimationFrame(simulationLoop)
}

// Start the simulation
requestAnimationFrame(simulationLoop)
