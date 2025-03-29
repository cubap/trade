class CanvasRenderer {
    constructor(world, canvasId) {
        this.world = world
        this.canvas = document.getElementById(canvasId)
        
        if (!this.canvas) {
            this.canvas = document.createElement('canvas')
            this.canvas.id = canvasId
            document.body.appendChild(this.canvas)
        }
        
        // Fixed canvas size (display size)
        this.canvas.width = 800
        this.canvas.height = 600
        
        this.context = this.canvas.getContext('2d')
        this.justReset = false // Initialize justReset flag
        
        // Zoom settings
        this.zoomLevel = 1
        this.minZoom = 0.1
        this.maxZoom = 5
        this.zoomSpeed = 0.1
        
        // Center view position 
        this.viewX = world.width / 2
        this.viewY = world.height / 2
        
        // Set up zoom event listeners
        this.setupZoomHandlers()
        
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

    setupZoomHandlers() {
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault()
            
            // Calculate zoom direction
            const zoomDirection = event.deltaY > 0 ? -1 : 1
            
            // Get mouse position relative to canvas
            const rect = this.canvas.getBoundingClientRect()
            const mouseX = event.clientX - rect.left
            const mouseY = event.clientY - rect.top
            
            // Calculate world coordinates under mouse before zoom
            const worldX = this.viewX + (mouseX - this.canvas.width / 2) / this.zoomLevel
            const worldY = this.viewY + (mouseY - this.canvas.height / 2) / this.zoomLevel
            
            // Update zoom level
            this.zoomLevel += zoomDirection * this.zoomSpeed * this.zoomLevel
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel))
            
            // Update view position to zoom toward mouse position
            this.viewX = worldX - (mouseX - this.canvas.width / 2) / this.zoomLevel
            this.viewY = worldY - (mouseY - this.canvas.height / 2) / this.zoomLevel
            
            // Keep view within world bounds
            this.constrainView()
        })
    }
    
    constrainView() {
        // Calculate visible area in world coordinates
        const visibleWidth = this.canvas.width / this.zoomLevel
        const visibleHeight = this.canvas.height / this.zoomLevel
        
        // Calculate bounds
        const minX = visibleWidth / 2
        const maxX = this.world.width - visibleWidth / 2
        const minY = visibleHeight / 2
        const maxY = this.world.height - visibleHeight / 2
        
        // Apply constraints if world is larger than view
        if (maxX > minX) {
            this.viewX = Math.max(minX, Math.min(maxX, this.viewX))
        } else {
            this.viewX = this.world.width / 2
        }
        
        if (maxY > minY) {
            this.viewY = Math.max(minY, Math.min(maxY, this.viewY))
        } else {
            this.viewY = this.world.height / 2
        }
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
        
        // Save context state before transformations
        this.context.save()
        
        // Apply zoom and center view
        this.context.translate(this.canvas.width / 2, this.canvas.height / 2)
        this.context.scale(this.zoomLevel, this.zoomLevel)
        this.context.translate(-this.viewX, -this.viewY)
        
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
        
        // Draw world boundaries
        this.context.strokeStyle = '#888'
        this.context.lineWidth = 2
        this.context.strokeRect(0, 0, this.world.width, this.world.height)
        
        // Restore context state
        this.context.restore()
        
        // Draw UI elements that shouldn't be affected by zoom
        this.context.fillStyle = 'black'
        this.context.font = '14px Arial'
        this.context.fillText(`Tick: ${this.world.clock.currentTick}`, 10, 20)
        this.context.fillText(`Zoom: ${this.zoomLevel.toFixed(2)}x`, 10, 40)
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
