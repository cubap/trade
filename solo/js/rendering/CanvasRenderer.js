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
            
            // If this is the highlighted entity, draw highlight
            if (entity === this.highlightedEntity) {
                this.renderHighlight(entity)
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

    // Update the renderMobileEntity method to correctly interpolate
    renderMobileEntity(entity, progress) {
        // For mobile entities, we need to interpolate between previous and current positions
        let x, y
        
        if (entity.moving) {
            // If entity is moving, interpolate between current position and target
            // using a smooth easing function
            const easing = this.easeInOutQuad(progress)
            x = this.lerp(entity.prevX, entity.x, easing)
            y = this.lerp(entity.prevY, entity.y, easing)
        } else {
            // If not moving, just use current position
            x = entity.x
            y = entity.y
        }
        
        // Continue with rendering at the interpolated position
        this.context.save()
        
        // Animal-specific rendering
        if (entity.subtype === 'animal') {
            this.renderAnimal(entity, x, y)
        } else {
            // Default rendering for other mobile entities
            this.renderDefaultMobile(entity, x, y)
        }
        
        this.context.restore()
    }

    // Smooth quadratic easing function for animations
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    }

    renderAnimal(animal, x, y) {
        const size = animal.size || 10
        
        // Base color from animal color or species
        let baseColor = animal.color
        if (!baseColor) {
            // Species-based coloring
            switch(animal.species) {
                case 'rabbit':
                    baseColor = '#BBBBBB' // Gray
                    break
                case 'fox':
                    baseColor = '#D67D3E' // Orange/red
                    break
                case 'deer':
                    baseColor = '#A68064' // Brown
                    break
                case 'wolf':
                    baseColor = '#6D695E' // Dark gray
                    break
                default:
                    baseColor = '#AAAAAA' // Default gray
            }
        }
        
        // Modify display based on behavior state
        let shapeFunction = this.drawOval
        let behaviorIndicator = null
        let indicatorColor = null
        
        switch(animal.behaviorState) {
            case 'foraging':
                // When foraging, draw a small food indicator
                behaviorIndicator = () => {
                    this.context.beginPath()
                    this.context.arc(x + size * 0.7, y - size * 0.7, size * 0.3, 0, Math.PI * 2)
                    this.context.fillStyle = '#7CFC00' // Bright green for food
                    this.context.fill()
                }
                break
                
            case 'seeking_water':
                // When seeking water, draw a water droplet
                behaviorIndicator = () => {
                    this.context.beginPath()
                    this.context.arc(x + size * 0.7, y - size * 0.7, size * 0.3, 0, Math.PI * 2)
                    this.context.fillStyle = '#1E90FF' // Blue for water
                    this.context.fill()
                }
                break
                
            case 'resting':
                // Resting animals are slightly transparent
                baseColor = this.adjustAlpha(baseColor, 0.7)
                // And have a "Z" indicator
                behaviorIndicator = () => {
                    this.context.font = `${size * 0.8}px Arial`
                    this.context.fillStyle = '#FFFFFF'
                    this.context.fillText('z', x + size * 0.5, y - size * 0.5)
                }
                break
                
            case 'fleeing':
                // Fleeing animals are drawn with motion lines
                behaviorIndicator = () => {
                    // Draw motion lines
                    this.context.strokeStyle = '#FF5555'
                    this.context.lineWidth = 1
                    
                    // Calculate direction of motion
                    const dx = animal.targetX - animal.x
                    const dy = animal.targetY - animal.y
                    const angle = Math.atan2(dy, dx)
                    
                    // Draw opposite to movement direction
                    const backAngle = angle + Math.PI
                    
                    // Three motion lines
                    for (let i = -1; i <= 1; i++) {
                        const offsetAngle = backAngle + i * 0.3
                        this.context.beginPath()
                        this.context.moveTo(x, y)
                        this.context.lineTo(
                            x + Math.cos(offsetAngle) * size * 1.2, 
                            y + Math.sin(offsetAngle) * size * 1.2
                        )
                        this.context.stroke()
                    }
                }
                
                // Make fleeing animals appear more vibrant
                baseColor = this.brightenColor(baseColor, 1.2)
                break
                
            default:
                // Default idle behavior
                break
        }
        
        // Draw direction indicator if moving
        if (animal.moving && animal.targetX !== animal.x && animal.targetY !== animal.y) {
            const dx = animal.targetX - animal.x
            const dy = animal.targetY - animal.y
            const angle = Math.atan2(dy, dx)
            
            // Rotate the animal shape in the direction of movement
            this.context.translate(x, y)
            this.context.rotate(angle)
            this.context.translate(-x, -y)
        }
        
        // Draw animal shape based on species
        switch(animal.species) {
            case 'rabbit':
                this.drawRabbit(x, y, size, baseColor)
                break
            case 'fox':
                this.drawFox(x, y, size, baseColor)
                break
            case 'deer':
                this.drawDeer(x, y, size, baseColor)
                break
            case 'wolf':
                this.drawWolf(x, y, size, baseColor)
                break
            default:
                // Default oval shape
                this.drawOval(x, y, size, baseColor)
        }
        
        // Draw behavior indicator if applicable
        if (behaviorIndicator) {
            behaviorIndicator()
        }
        
        // Draw needs indicators - small bars showing hunger/thirst/etc
        this.drawNeedsIndicators(animal, x, y, size)
        
        // Draw entity name
        this.drawEntityName(animal, x, y, size)
    }

    // Helper methods for drawing animal shapes
    drawOval(x, y, size, color) {
        this.context.beginPath()
        this.context.ellipse(x, y, size, size * 0.8, 0, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        this.context.strokeStyle = this.darkenColor(color, 0.7)
        this.context.lineWidth = 1
        this.context.stroke()
    }

    drawRabbit(x, y, size, color) {
        // Body
        this.context.beginPath()
        this.context.ellipse(x, y, size * 0.8, size * 1.2, 0, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Ears
        this.context.beginPath()
        this.context.ellipse(x - size * 0.3, y - size * 1.3, size * 0.2, size * 0.6, 0, 0, Math.PI * 2)
        this.context.ellipse(x + size * 0.3, y - size * 1.3, size * 0.2, size * 0.6, 0, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Face details
        this.context.beginPath()
        this.context.arc(x - size * 0.3, y - size * 0.2, size * 0.15, 0, Math.PI * 2) // Eye
        this.context.arc(x + size * 0.3, y - size * 0.2, size * 0.15, 0, Math.PI * 2) // Eye
        this.context.fillStyle = 'black'
        this.context.fill()
    }

    drawFox(x, y, size, color) {
        // Body
        this.context.beginPath()
        this.context.ellipse(x, y, size, size * 0.8, 0, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Head
        this.context.beginPath()
        this.context.ellipse(x + size * 0.8, y, size * 0.6, size * 0.5, 0, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Tail
        this.context.beginPath()
        this.context.ellipse(x - size * 1.2, y, size * 0.8, size * 0.4, 0, 0, Math.PI * 2)
        this.context.fillStyle = this.brightenColor(color, 1.1)
        this.context.fill()
        
        // Face details
        this.context.beginPath()
        this.context.arc(x + size * 1.1, y - size * 0.2, size * 0.1, 0, Math.PI * 2) // Eye
        this.context.arc(x + size * 1.1, y + size * 0.2, size * 0.1, 0, Math.PI * 2) // Eye
        this.context.fillStyle = 'black'
        this.context.fill()
    }

    drawDeer(x, y, size, color) {
        // Body
        this.context.beginPath()
        this.context.ellipse(x, y, size * 1.2, size * 0.9, 0, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Head
        this.context.beginPath()
        this.context.ellipse(x + size, y - size * 0.3, size * 0.6, size * 0.4, Math.PI * 0.2, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Antlers (only for adult deer)
        this.context.beginPath()
        this.context.moveTo(x + size * 1.2, y - size * 0.6)
        this.context.lineTo(x + size * 1.6, y - size * 1.3)
        this.context.lineTo(x + size * 1.9, y - size * 1.0)
        
        this.context.moveTo(x + size * 1.2, y - size * 0.6)
        this.context.lineTo(x + size * 1.0, y - size * 1.3)
        this.context.lineTo(x + size * 0.7, y - size * 1.0)
        
        this.context.strokeStyle = this.darkenColor(color, 0.8)
        this.context.lineWidth = size * 0.15
        this.context.stroke()
        
        // Eyes
        this.context.beginPath()
        this.context.arc(x + size * 1.3, y - size * 0.5, size * 0.1, 0, Math.PI * 2)
        this.context.fillStyle = 'black'
        this.context.fill()
    }

    drawWolf(x, y, size, color) {
        // Body
        this.context.beginPath()
        this.context.ellipse(x, y, size * 1.2, size * 0.8, 0, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Head
        this.context.beginPath()
        this.context.ellipse(x + size * 1.1, y, size * 0.7, size * 0.5, Math.PI * 0.1, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Ears (pointed)
        this.context.beginPath()
        this.context.moveTo(x + size * 1.1, y - size * 0.4)
        this.context.lineTo(x + size * 1.5, y - size * 0.9)
        this.context.lineTo(x + size * 1.3, y - size * 0.3)
        
        this.context.moveTo(x + size * 1.1, y - size * 0.4)
        this.context.lineTo(x + size * 0.8, y - size * 0.9)
        this.context.lineTo(x + size * 0.9, y - size * 0.3)
        
        this.context.fillStyle = this.darkenColor(color, 0.8)
        this.context.fill()
        
        // Tail
        this.context.beginPath()
        this.context.ellipse(x - size * 1.3, y, size * 0.8, size * 0.3, Math.PI * 0.2, 0, Math.PI * 2)
        this.context.fillStyle = color
        this.context.fill()
        
        // Nose and eyes
        this.context.beginPath()
        this.context.arc(x + size * 1.6, y + size * 0.1, size * 0.12, 0, Math.PI * 2) // Nose
        this.context.fillStyle = 'black'
        this.context.fill()
        
        this.context.beginPath()
        this.context.arc(x + size * 1.3, y - size * 0.2, size * 0.1, 0, Math.PI * 2) // Eye
        this.context.fillStyle = 'yellow'
        this.context.fill()
        
        this.context.beginPath()
        this.context.arc(x + size * 1.3, y - size * 0.2, size * 0.05, 0, Math.PI * 2) // Pupil
        this.context.fillStyle = 'black'
        this.context.fill()
    }

    drawDefaultMobile(entity, x, y) {
        // Size can be entity-specific or default
        const size = entity.size || 10
        
        // Draw entity (position only rounded during rendering)
        this.context.beginPath()
        this.context.arc(Math.round(x), Math.round(y), size, 0, 2 * Math.PI)
        this.context.fillStyle = entity.color || this.getColorForEntity(entity)
        this.context.fill()
        
        // Draw entity name
        this.drawEntityName(entity, x, y, size)
    }

    renderDefaultMobile(entity, x, y) {
        // Size can be entity-specific or default
        const size = entity.size || 10
        
        // Draw entity (position only rounded during rendering)
        this.context.beginPath()
        this.context.arc(Math.round(x), Math.round(y), size, 0, 2 * Math.PI)
        this.context.fillStyle = entity.color || this.getColorForEntity(entity)
        this.context.fill()
        
        // Add a border
        this.context.strokeStyle = 'rgba(0, 0, 0, 0.5)'
        this.context.lineWidth = 1
        this.context.stroke()
        
        // If entity has a role, indicate it visually
        if (entity.role) {
            // Draw a small indicator inside the entity
            this.context.beginPath()
            this.context.arc(Math.round(x), Math.round(y), size * 0.4, 0, 2 * Math.PI)
            
            // Different colors for different roles
            const roleColors = {
                explorer: '#5555FF',
                builder: '#FF5555',
                scout: '#55FF55',
                trader: '#FFFF55'
            }
            
            this.context.fillStyle = roleColors[entity.role] || '#FFFFFF'
            this.context.fill()
        }
        
        // Draw entity name
        this.drawEntityName(entity, x, y, size)
    }

    drawNeedsIndicators(animal, x, y, size) {
        if (!animal.drives) return
        
        const barWidth = size * 2
        const barHeight = size * 0.2
        const startY = y + size * 1.2
        const spacing = barHeight * 1.2
        
        // Draw hunger indicator
        if (animal.drives.hunger !== undefined) {
            this.drawNeedBar(x - barWidth/2, startY, barWidth, barHeight, 
                           animal.drives.hunger/100, '#F39C12', 'hunger')
        }
        
        // Draw thirst indicator
        if (animal.drives.thirst !== undefined) {
            this.drawNeedBar(x - barWidth/2, startY + spacing, barWidth, barHeight, 
                           animal.drives.thirst/100, '#3498DB', 'thirst')
        }
        
        // Draw rest indicator 
        if (animal.drives.rest !== undefined) {
            this.drawNeedBar(x - barWidth/2, startY + spacing * 2, barWidth, barHeight, 
                           animal.drives.rest/100, '#9B59B6', 'rest')
        }
    }

    drawNeedBar(x, y, width, height, fillPercent, color, needType) {
        // Draw background
        this.context.fillStyle = 'rgba(0, 0, 0, 0.3)'
        this.context.fillRect(x, y, width, height)
        
        // Draw fill based on need level
        this.context.fillStyle = color
        this.context.fillRect(x, y, width * fillPercent, height)
        
        // Add border
        this.context.strokeStyle = 'rgba(0, 0, 0, 0.5)'
        this.context.lineWidth = 0.5
        this.context.strokeRect(x, y, width, height)
    }

    drawEntityName(entity, x, y, size) {
        this.context.fillStyle = 'black'
        this.context.font = '12px Arial'
        this.context.textAlign = 'center'
        this.context.fillText(
            entity.name || entity.subtype || entity.type,
            x, 
            y - size - 5
        )
        this.context.textAlign = 'left' // Reset alignment
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

    // Color utility methods
    brightenColor(hexColor, factor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(1, 2), 16)
        const g = parseInt(hexColor.substr(3, 2), 16)
        const b = parseInt(hexColor.substr(5, 2), 16)
        
        // Brighten
        const newR = Math.min(255, Math.round(r * factor))
        const newG = Math.min(255, Math.round(g * factor))
        const newB = Math.min(255, Math.round(b * factor))
        
        // Convert back to hex
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
    }

    darkenColor(hexColor, factor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(1, 2), 16)
        const g = parseInt(hexColor.substr(3, 2), 16)
        const b = parseInt(hexColor.substr(5, 2), 16)
        
        // Darken
        const newR = Math.max(0, Math.round(r * factor))
        const newG = Math.max(0, Math.round(g * factor))
        const newB = Math.max(0, Math.round(b * factor))
        
        // Convert back to hex
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
    }

    adjustAlpha(hexColor, alpha) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(1, 2), 16)
        const g = parseInt(hexColor.substr(3, 2), 16)
        const b = parseInt(hexColor.substr(5, 2), 16)
        
        // Return with alpha
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    // Add this method to the CanvasRenderer class
    highlightEntity(entity, duration = 1000) {
        // Store the entity to highlight
        this.highlightedEntity = entity
        this.highlightEndTime = performance.now() + duration
        
        // Clear any existing highlight timeout
        if (this.highlightTimeout) {
            clearTimeout(this.highlightTimeout)
        }
        
        // Set timeout to clear the highlight
        this.highlightTimeout = setTimeout(() => {
            this.highlightedEntity = null
            this.highlightTimeout = null
        }, duration)
    }

    // Add method to render the highlight effect
    renderHighlight(entity) {
        // Calculate how long the highlight has been active (for animation)
        const timeRemaining = this.highlightEndTime - performance.now()
        const duration = 1000 // Same as default in highlightEntity
        const progress = 1 - (timeRemaining / duration)
        
        // Calculate pulsing effect (0 to 1 to 0)
        const pulseRate = 2 // Complete pulse cycles per highlight duration
        const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2 * pulseRate)
        
        // Draw highlight circle with pulsing opacity
        this.context.beginPath()
        this.context.arc(entity.x, entity.y, (entity.size || 10) * 1.5, 0, Math.PI * 2)
        this.context.strokeStyle = 'rgba(255, 255, 0, ' + (0.4 + 0.6 * pulse) + ')'
        this.context.lineWidth = 2 + pulse * 2
        this.context.stroke()
        
        // Draw connecting line to a metadata indicator
        this.context.beginPath()
        this.context.moveTo(entity.x, entity.y - (entity.size || 10))
        this.context.lineTo(entity.x, entity.y - (entity.size || 10) * 3)
        this.context.strokeStyle = 'rgba(255, 255, 0, 0.8)'
        this.context.lineWidth = 1
        this.context.stroke()
        
        // Draw small info badge
        this.context.fillStyle = 'rgba(0, 0, 0, 0.7)'
        this.context.beginPath()
        this.context.arc(entity.x, entity.y - (entity.size || 10) * 3, 8, 0, Math.PI * 2)
        this.context.fill()
        
        this.context.fillStyle = 'white'
        this.context.font = '12px Arial'
        this.context.textAlign = 'center'
        this.context.textBaseline = 'middle'
        this.context.fillText('i', entity.x, entity.y - (entity.size || 10) * 3)
        this.context.textAlign = 'left'
        this.context.textBaseline = 'alphabetic'
    }
}

export default CanvasRenderer
