class CanvasRenderer {
    constructor(world, canvasId) {
        this.world = world
        this.canvas = document.getElementById(canvasId)
        
        if (!this.canvas) {
            this.canvas = document.createElement('canvas')
            this.canvas.id = canvasId
            document.body.appendChild(this.canvas)
        }
        
        // Set up resize handler for fullscreen canvas
        this.setupResizeHandler()
        
        // Initial canvas sizing to match window
        this.resizeCanvas()
        
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
        
        // Set up panning event listeners
        this.setupPanningHandlers()
        
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
        
        // Grid settings
        this.showGrid = true
        this.gridSpacing = 100
        this.gridMinorLines = 5 // Number of minor lines between major lines
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => {
            this.resizeCanvas()
        })
    }

    resizeCanvas() {
        // Set canvas to window size
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        
        // Apply styling to ensure it fills the window
        this.canvas.style.position = 'absolute'
        this.canvas.style.top = '0'
        this.canvas.style.left = '0'
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
    
    setupPanningHandlers() {
        // Track panning state
        this.isPanning = false
        this.lastMouseX = 0
        this.lastMouseY = 0
        
        // Mouse down event - start panning on middle button
        this.canvas.addEventListener('mousedown', (event) => {
            // Middle mouse button (button 1)
            if (event.button !== 1) return
            
            this.isPanning = true
            this.lastMouseX = event.clientX
            this.lastMouseY = event.clientY
            
            // Prevent default browser behavior of middle-click scrolling
            event.preventDefault()
        })
        
        // Mouse move event - pan if middle button is pressed
        window.addEventListener('mousemove', (event) => {
            if (!this.isPanning) return
            
            // Calculate distance moved
            const deltaX = event.clientX - this.lastMouseX
            const deltaY = event.clientY - this.lastMouseY
            
            // Update view position (invert delta to match drag direction)
            this.viewX -= deltaX / this.zoomLevel
            this.viewY -= deltaY / this.zoomLevel
            
            // Keep view within bounds
            this.constrainView()
            
            // Update last position
            this.lastMouseX = event.clientX
            this.lastMouseY = event.clientY
        })
        
        // Mouse up event - stop panning
        window.addEventListener('mouseup', (event) => {
            if (event.button !== 1) return
            this.isPanning = false
        })
        
        // Mouse leave event - stop panning if cursor leaves window
        window.addEventListener('mouseleave', () => {
            this.isPanning = false
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
        
        // Draw world boundaries
        this.context.strokeStyle = '#888'
        this.context.lineWidth = 2
        this.context.strokeRect(0, 0, this.world.width, this.world.height)
        
        // Draw grid if enabled
        if (this.showGrid) {
            this.renderGrid()
        }
        
        // Draw each entity
        for (const entity of this.world.entitiesMap.values()) {
            // Different rendering based on entity type
            if (entity.type === 'mobile') {
                this.renderMobileEntity(entity, progress)
            } else {
                this.renderImmobileEntity(entity)
            }
        }
        
        // Restore context state
        this.context.restore()
        
        // Draw UI elements that shouldn't be affected by zoom
        this.drawUI()
        
        // Draw minimap if enabled
        if (this.showMinimap) {
            this.renderMinimap()
        }
    }

    renderMobileEntity(entity, progress) {
        // For mobile entities, interpolate position between current and target
        const easing = entity.moving ? this.continuousEase(progress) : this.easeOut(progress)
        
        // Calculate interpolated position
        let x = entity.x
        let y = entity.y
        
        // Only interpolate if the entity has target positions
        if (entity.targetX !== undefined && entity.targetY !== undefined) {
            x = this.lerp(entity.x, entity.targetX, easing)
            y = this.lerp(entity.y, entity.targetY, easing)
        }
        
        // Draw entity (position only rounded during rendering)
        this.context.beginPath()
        
        // Size can be entity-specific or default
        const size = entity.size || 10
        
        this.context.arc(Math.round(x), Math.round(y), size, 0, 2 * Math.PI)
        this.context.fillStyle = this.getColorForEntity(entity)
        this.context.fill()
        
        // Draw entity name
        this.context.fillStyle = 'black'
        this.context.font = '12px Arial'
        this.context.fillText(
            entity.name || entity.subtype || entity.type,
            Math.round(x) - 20, 
            Math.round(y) - size - 5
        )
    }

    renderImmobileEntity(entity) {
        // For immobile entities, just draw at their fixed position
        const x = entity.x
        const y = entity.y
        
        // Size can be entity-specific or default
        const size = entity.size || 10
        
        // Draw different shapes based on subtype
        this.context.fillStyle = this.getColorForEntity(entity)
        
        if (entity.subtype === 'structure') {
            // Structures are squares
            this.context.fillRect(
                Math.round(x) - size/2, 
                Math.round(y) - size/2, 
                size, 
                size
            )
        } else if (entity.subtype === 'plant') {
            // Plants are triangles
            this.context.beginPath()
            this.context.moveTo(Math.round(x), Math.round(y) - size)
            this.context.lineTo(Math.round(x) - size/2, Math.round(y) + size/2)
            this.context.lineTo(Math.round(x) + size/2, Math.round(y) + size/2)
            this.context.closePath()
            this.context.fill()
        } else {
            // Default to circle for other immobile entities
            this.context.beginPath()
            this.context.arc(Math.round(x), Math.round(y), size, 0, 2 * Math.PI)
            this.context.fill()
        }
        
        // Draw entity name
        this.context.fillStyle = 'black'
        this.context.font = '12px Arial'
        this.context.fillText(
            entity.name || entity.subtype || entity.type,
            Math.round(x) - 20, 
            Math.round(y) - size - 5
        )
    }

    drawUI() {
        this.context.fillStyle = 'black'
        this.context.font = '14px Arial'
        this.context.fillText(`Tick: ${this.world.clock.currentTick}`, 10, 20)
        this.context.fillText(`Zoom: ${this.zoomLevel.toFixed(2)}x`, 10, 40)
        this.context.fillText(`Entities: ${this.world.entitiesMap.size}`, 10, 60)
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
        // Guard against invalid entities or missing name
        if (!entity) return this.colorPalettes[this.activePalette][0]
        
        // Use entity's color if available
        if (entity.color) return entity.color
        
        // Determine color based on entity type if name is not available
        if (!entity.name || typeof entity.name !== 'string') {
            // Fallback to type/subtype based coloring
            const typeHash = (entity.type || 'entity').charCodeAt(0) * 13
            const palette = this.colorPalettes[this.activePalette]
            return palette[Math.abs(typeHash) % palette.length]
        }
        
        // Original logic for string names
        const hash = entity.name.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0)
            return a & a
        }, 0)
        
        const palette = this.colorPalettes[this.activePalette]
        return palette[Math.abs(hash) % palette.length]
    }
    
    renderGrid() {
        if (!this.showGrid) return
        
        // Calculate grid spacing based on zoom level
        const baseGridSpacing = this.gridSpacing
        
        // Calculate visible area in world coordinates
        const visibleMinX = this.viewX - this.canvas.width / (2 * this.zoomLevel)
        const visibleMaxX = this.viewX + this.canvas.width / (2 * this.zoomLevel)
        const visibleMinY = this.viewY - this.canvas.height / (2 * this.zoomLevel)
        const visibleMaxY = this.viewY + this.canvas.height / (2 * this.zoomLevel)
        
        // Calculate grid line start and end points
        const startX = Math.floor(visibleMinX / baseGridSpacing) * baseGridSpacing
        const endX = Math.ceil(visibleMaxX / baseGridSpacing) * baseGridSpacing
        const startY = Math.floor(visibleMinY / baseGridSpacing) * baseGridSpacing
        const endY = Math.ceil(visibleMaxY / baseGridSpacing) * baseGridSpacing
        
        // Draw major grid lines
        this.context.strokeStyle = 'rgba(100, 100, 100, 0.4)'
        this.context.lineWidth = 1
        
        // Vertical lines
        for (let x = startX; x <= endX; x += baseGridSpacing) {
            this.context.beginPath()
            this.context.moveTo(x, startY)
            this.context.lineTo(x, endY)
            this.context.stroke()
            
            // Draw coordinate label if zoom level is sufficient
            if (this.zoomLevel > 0.5) {
                this.context.fillStyle = 'rgba(80, 80, 80, 0.7)'
                this.context.font = '10px Arial'
                this.context.fillText(x.toString(), x + 5, visibleMinY + 15)
            }
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY; y += baseGridSpacing) {
            this.context.beginPath()
            this.context.moveTo(startX, y)
            this.context.lineTo(endX, y)
            this.context.stroke()
            
            // Draw coordinate label if zoom level is sufficient
            if (this.zoomLevel > 0.5) {
                this.context.fillStyle = 'rgba(80, 80, 80, 0.7)'
                this.context.font = '10px Arial'
                this.context.fillText(y.toString(), visibleMinX + 5, y + 15)
            }
        }
        
        // Draw minor grid lines if zoom level is sufficient
        if (this.zoomLevel > 0.7) {
            const minorSpacing = baseGridSpacing / this.gridMinorLines
            this.context.strokeStyle = 'rgba(100, 100, 100, 0.2)'
            
            // Vertical minor lines
            for (let x = startX; x <= endX; x += minorSpacing) {
                // Skip major lines
                if (x % baseGridSpacing === 0) continue
                
                this.context.beginPath()
                this.context.moveTo(x, startY)
                this.context.lineTo(x, endY)
                this.context.stroke()
            }
            
            // Horizontal minor lines
            for (let y = startY; y <= endY; y += minorSpacing) {
                // Skip major lines
                if (y % baseGridSpacing === 0) continue
                
                this.context.beginPath()
                this.context.moveTo(startX, y)
                this.context.lineTo(endX, y)
                this.context.stroke()
            }
        }
    }
}

export default CanvasRenderer
