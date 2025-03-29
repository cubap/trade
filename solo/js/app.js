import Entity from './models/Entity.js'
import World from './core/World.js'
import CanvasRenderer from './rendering/CanvasRenderer.js'
import setupControls from './ui/controls.js'

// Create a larger world
const world = new World(2000, 2000)
const renderer = new CanvasRenderer(world, 'game-canvas')

// Add more initial entities spread throughout the larger world
world.addEntity(new Entity('Entity1', 100, 100, 20))
world.addEntity(new Entity('Entity2', 500, 800, 30))
world.addEntity(new Entity('Entity3', 1200, 400, 15))
world.addEntity(new Entity('Entity4', 1500, 1300, 25))
world.addEntity(new Entity('Entity5', 800, 1800, 18))

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
