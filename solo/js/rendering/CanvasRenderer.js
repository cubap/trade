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

export default CanvasRenderer
