class Entity {
    constructor(name, x, y, speed) {
        this.name = name
        this.x = Math.round(x)
        this.y = Math.round(y)
        this.prevX = this.x
        this.prevY = this.y
        this.targetX = this.x
        this.targetY = this.y
        this.nextTargetX = this.x  // Add next target for continuous motion
        this.nextTargetY = this.y
        this.speed = speed
        this.moving = false
    }

    move() {
        // Current position becomes the previous position
        this.prevX = this.x
        this.prevY = this.y
        
        // Current target becomes current position
        this.x = this.targetX
        this.y = this.targetY
        
        // Next target becomes current target
        this.targetX = this.nextTargetX
        this.targetY = this.nextTargetY
        
        // Calculate next target position
        this.nextTargetX = Math.round(this.targetX + (Math.random() - 0.5) * this.speed)
        this.nextTargetY = Math.round(this.targetY + (Math.random() - 0.5) * this.speed)
        
        this.moving = true
    }
}

class ActionQueue {
    constructor() {
        this.queue = []
        this.scheduledActions = new Map()  // Map ticks to actions
    }

    addAction(action) {
        this.queue.push(action)
    }

    scheduleAction(action, executionTick) {
        if (!this.scheduledActions.has(executionTick)) {
            this.scheduledActions.set(executionTick, [])
        }
        this.scheduledActions.get(executionTick).push(action)
    }

    processActions() {
        // Process immediate actions
        for (const action of this.queue) {
            action()
        }
        this.queue = []
    }
    
    processTick(currentTick) {
        // Process immediate actions
        this.processActions()
        
        // Process scheduled actions for this tick
        if (this.scheduledActions.has(currentTick)) {
            const tickActions = this.scheduledActions.get(currentTick)
            for (const action of tickActions) {
                action()
            }
            this.scheduledActions.delete(currentTick)
        }
    }
}

class World {
    constructor(width, height) {
        this.width = width
        this.height = height
        this.entitiesMap = new Map()
        this.actionQueue = new ActionQueue()
        this.clock = new GameClock(500)  // 500ms per tick
    }

    addEntity(entity) {
        this.entitiesMap.set(entity.name, entity)
    }

    update(timestamp) {
        // Check if we should process a new tick
        if (!this.clock.update(timestamp)) return false
        
        // Process scheduled actions for this tick
        this.actionQueue.processTick(this.clock.currentTick)
        
        // Move all entities for this tick
        for (const entity of this.entitiesMap.values()) {
            entity.move()
            this.keepEntityInBounds(entity)
        }
        
        // Only log occasional ticks to avoid console spam
        if (this.clock.currentTick % 5 === 0) {
            console.log(`Tick: ${this.clock.currentTick}, Entities:`, 
                       Array.from(this.entitiesMap.values()))
        }
        
        return true
    }

    keepEntityInBounds(entity) {
        // Keep current position in bounds
        if (entity.x < 0) entity.x = 0
        if (entity.y < 0) entity.y = 0
        if (entity.x > this.width) entity.x = this.width
        if (entity.y > this.height) entity.y = this.height
        
        // Keep target position in bounds too
        if (entity.targetX < 0) entity.targetX = 0
        if (entity.targetY < 0) entity.targetY = 0
        if (entity.targetX > this.width) entity.targetX = this.width
        if (entity.targetY > this.height) entity.targetY = this.height
    }
}

class GameClock {
    constructor(tickRate = 1000) {
        this.currentTick = 0
        this.tickRate = tickRate
        this.lastTickTime = performance.now()
        this.accumulator = 0
        this.lastProgress = 0 // Track last progress value for detection of resets
    }

    update(currentTime) {
        // Calculate time delta since last update
        const delta = currentTime - this.lastTickTime
        this.lastTickTime = currentTime
        
        // Add to accumulator
        this.accumulator += delta
        
        // If we've accumulated enough time for a tick
        if (this.accumulator >= this.tickRate) {
            this.currentTick++
            this.accumulator -= this.tickRate  // Keep remainder for smooth transitions
            return true
        }
        return false
    }
    
    getProgress() {
        const progress = this.accumulator / this.tickRate
        // Detect if we've reset (new tick) and notify renderer
        const reset = progress < this.lastProgress && this.lastProgress > 0.8
        this.lastProgress = progress
        return { progress, reset }
    }
}

class CanvasRenderer {
    constructor(world, canvasId) {
        this.world = world
        this.canvas = document.getElementById(canvasId)
        
        if (!this.canvas) {
            this.canvas = document.createElement('canvas')
            this.canvas.id = canvasId
            document.body.appendChild(this.canvas)
        }
        
        // Set canvas dimensions to match the world dimensions
        this.canvas.width = world.width
        this.canvas.height = world.height
        
        this.context = this.canvas.getContext('2d')
        this.justReset = false // Initialize justReset flag
        
        // Define color palettes for more visually cohesive looks
        this.colorPalettes = {
            vivid: ['#FF5555', '#55FF55', '#5555FF', '#FFFF55', '#FF55FF', '#55FFFF', '#FF9955', '#9955FF'],
            pastel: ['#FFB3B3', '#B3FFB3', '#B3B3FF', '#FFFFB3', '#FFB3FF', '#B3FFFF', '#FFCC99', '#CC99FF'],
            grayscale: ['#333', '#555', '#777', '#999', '#BBB', '#DDD'],
            forest: ['#2E4600', '#486B00', '#A2C523', '#7D4427', '#D6AA50'],
            ocean: ['#1A3E59', '#2E738A', '#46CDCF', '#ABEDD8', '#0D0D0D']
        }
        
        // Choose default palette
        this.activePalette = 'vivid'
    }

    render() {
        // Calculate interpolation factor (0 to 1)
        const { progress, reset } = this.world.clock.getProgress()
        
        // If we just reset, remember that for animation continuity
        if (reset) {
            this.justReset = true
        }
        
        // Clear the canvas
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        
        // Draw each entity
        for (const entity of this.world.entitiesMap.values()) {
            // Interpolate position between current and target
            // Use continuous easing for entities that are continuously moving
            const easing = entity.moving ? this.continuousEase(progress) : this.easeOut(progress)
            
            // Calculate interpolated position
            const x = this.lerp(entity.x, entity.targetX, easing)
            const y = this.lerp(entity.y, entity.targetY, easing)
            
            // Draw entity (position only rounded during rendering)
            this.context.beginPath()
            this.context.arc(Math.round(x), Math.round(y), 10, 0, 2 * Math.PI)
            this.context.fillStyle = this.getColorForEntity(entity)
            this.context.fill()
            
            // Draw entity name
            this.context.fillStyle = 'black'
            this.context.font = '12px Arial'
            this.context.fillText(entity.name, Math.round(x) - 20, Math.round(y) - 15)
        }
        
        // Display current tick
        this.context.fillStyle = 'black'
        this.context.font = '14px Arial'
        this.context.fillText(`Tick: ${this.world.clock.currentTick}`, 10, 20)
    }
    
    // Remove calculateTickProgress since we're getting progress directly

    // Linear interpolation without rounding for smoother motion
    lerp(start, end, progress) {
        return start + (end - start) * progress
    }
    
    // Continuous easing function that doesn't pause at endpoints
    continuousEase(t) {
        // No pausing at the beginning or end
        if (this.justReset) {
            // If we just reset, start with velocity
            this.justReset = false
            return t * 0.8 + 0.2 // Start at higher velocity
        }
        
        // Minimal easing that maintains velocity throughout
        return t
    }

    // Regular easing for non-continuous animations
    easeOut(t) {
        return 1 - Math.pow(1 - t, 2)
    }
    
    getColorForEntity(entity) {
        // Get a consistent index based on entity name
        const hash = entity.name.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0)
            return a & a
        }, 0)
        
        const palette = this.colorPalettes[this.activePalette]
        return palette[Math.abs(hash) % palette.length]
    }
}

const world = new World(800, 600)
const renderer = new CanvasRenderer(world, 'game-canvas')
let isPaused = false // Track pause state

world.addEntity(new Entity('Entity1', 100, 100, 20))
world.addEntity(new Entity('Entity2', 200, 200, 30))
world.addEntity(new Entity('Entity3', 300, 150, 15))

function simulationLoop(timestamp) {
    if (!isPaused) {
        world.update(timestamp)
    }
    
    // Always render to show animations
    renderer.render()
    
    // Continue the animation loop
    requestAnimationFrame(simulationLoop)
}

// Add UI controls
function setupControls() {
    const controlPanel = document.createElement('div')
    controlPanel.style.margin = '10px 0'
    
    // Add entity button
    const addButton = document.createElement('button')
    addButton.textContent = 'Add Entity'
    addButton.onclick = () => {
        const entityCount = world.entitiesMap.size + 1
        const entity = new Entity(
            `Entity${entityCount}`,
            Math.random() * world.width,
            Math.random() * world.height,
            1 + Math.random() * 30
        )
        world.addEntity(entity)
    }
    
    // Add pause button
    const pauseButton = document.createElement('button')
    pauseButton.textContent = 'Pause'
    pauseButton.style.marginLeft = '10px'
    pauseButton.onclick = () => {
        isPaused = !isPaused
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause'
    }
    
    // Add palette selector
    const paletteSelect = document.createElement('select')
    paletteSelect.style.marginLeft = '10px'
    
    for (const paletteName in renderer.colorPalettes) {
        const option = document.createElement('option')
        option.value = paletteName
        option.textContent = paletteName.charAt(0).toUpperCase() + paletteName.slice(1)
        paletteSelect.appendChild(option)
    }
    
    paletteSelect.value = renderer.activePalette
    paletteSelect.onchange = () => {
        renderer.activePalette = paletteSelect.value
    }
    
    controlPanel.appendChild(addButton)
    controlPanel.appendChild(pauseButton)
    controlPanel.appendChild(paletteSelect)
    document.body.insertBefore(controlPanel, document.getElementById('canvas-container'))
}

setupControls()

// Start the simulation
requestAnimationFrame(simulationLoop)
