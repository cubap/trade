import Entity from './models/Entity.js'
import World from './core/World.js'
import CanvasRenderer from './rendering/CanvasRenderer.js'
import setupControls from './ui/controls.js'

// Create the world and renderer
const world = new World(800, 600)
const renderer = new CanvasRenderer(world, 'game-canvas')

// Setup initial entities
world.addEntity(new Entity('Entity1', 100, 100, 20))
world.addEntity(new Entity('Entity2', 200, 200, 30))
world.addEntity(new Entity('Entity3', 300, 150, 15))

// Setup UI controls
const controls = setupControls(world, renderer)

// Animation loop
function simulationLoop(timestamp) {
    if (!controls.isPaused()) {
        world.update(timestamp)
    }
    
    // Always render to show animations
    renderer.render()
    
    // Continue the animation loop
    requestAnimationFrame(simulationLoop)
}

// Start the simulation
requestAnimationFrame(simulationLoop)
