import CameraController from './CameraController.js'
import PerceptionRenderer from './PerceptionRenderer.js'
import EntityRenderer from './EntityRenderer.js'
import UIRenderer from './UIRenderer.js'

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
        
        // Initialize component modules
        this.camera = new CameraController(this.canvas, this.world)
        this.perception = new PerceptionRenderer(this.world)
        this.entityRenderer = new EntityRenderer(this.context, this.colorPalettes)
        this.uiRenderer = new UIRenderer(this.context, this.world)
        
        // Pass zoom level getter to UI renderer for conditional rendering
        this.uiRenderer.setZoomLevelGetter(() => this.camera.zoomLevel)
        
        // Entity highlighting
        this.highlightedEntity = null
        this.highlightEndTime = 0
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
    
    // Delegation methods for camera control
    get zoomLevel() { return this.camera.zoomLevel }
    get viewX() { return this.camera.viewX }
    get viewY() { return this.camera.viewY }
    get followMode() { return this.camera.followMode }
    get followedEntity() { return this.camera.followedEntity }
    get isPanning() { return this.camera.isPanning }
    
    setFollowEntity(entity) {
        this.camera.setFollowEntity(entity)
    }
    
    // Delegation methods for perception
    get perceptionMode() { return this.perception.perceptionMode }
    
    togglePerceptionMode() {
        this.perception.togglePerceptionMode()
    }
    
    // Delegation methods for UI
    get showGrid() { return this.uiRenderer.showGrid }
    set showGrid(value) { this.uiRenderer.showGrid = value }
    
    get showChunks() { return this.uiRenderer.showChunks }
    set showChunks(value) { this.uiRenderer.showChunks = value }
    
    get showMinimap() { return this.uiRenderer.showMinimap }
    set showMinimap(value) { this.uiRenderer.showMinimap = value }

    render() {
        // Update follow camera if active
        this.camera.updateFollowCamera()
        
        // Calculate interpolation factor (0 to 1)
        const { progress, reset } = this.world.clock.getProgress()
        
        if (reset) {
            this.justReset = true
        }
        
        // Clear the canvas
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        
        // Set background
        this.context.fillStyle = '#2c5f2d'
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height)
        
        // Save context state before transformations
        this.context.save()
        
        // Apply camera transformations
        this.camera.applyTransform(this.context)
        
        // Draw world boundaries
        this.context.strokeStyle = '#888'
        this.context.lineWidth = 2
        this.context.strokeRect(0, 0, this.world.width, this.world.height)
        
        // Draw grid if enabled
        if (this.uiRenderer.showGrid) {
            this.uiRenderer.renderGrid()
        }
        
        // Draw chunk boundaries if enabled
        if (this.uiRenderer.showChunks) {
            this.uiRenderer.renderChunks()
        }
        
        // Get entities to render based on perception mode
        const entitiesToRender = this.perception.getEntitiesToRender(this.camera.followedEntity)
        
        // Debug: log entity count
        if (this.world.clock.currentTick % 60 === 0) { // Every ~1 second
            console.log(`Rendering ${entitiesToRender.length} entities out of ${this.world.entitiesMap.size} total`)
        }
        
        // Update entity renderer palette
        this.entityRenderer.activePalette = this.activePalette
        
        // Draw each entity
        for (const entity of entitiesToRender) {
            // Apply perception-based rendering if active
            const renderAlpha = this.perception.getEntityRenderAlpha(entity, this.camera.followedEntity)
            
            if (renderAlpha > 0) {
                this.context.globalAlpha = renderAlpha
                
                // Different rendering based on entity type
                if (entity.type === 'mobile') {
                    this.entityRenderer.renderMobileEntity(entity, progress)
                } else {
                    this.entityRenderer.renderImmobileEntity(entity)
                }
                
                // If this is the highlighted entity, draw highlight
                if (entity === this.highlightedEntity && Date.now() < this.highlightEndTime) {
                    this.entityRenderer.renderHighlight(entity)
                }
                
                // If this is the followed entity, draw special indicator
                if (entity === this.camera.followedEntity) {
                    this.entityRenderer.renderFollowIndicator(entity)
                }
                
                this.context.globalAlpha = 1.0
            }
        }
        
        // Restore context state
        this.context.restore()
        
        // Draw UI elements that shouldn't be affected by zoom/pan
        this.uiRenderer.drawUI()
        
        // Draw minimap if enabled
        if (this.uiRenderer.showMinimap) {
            this.uiRenderer.renderMinimap()
        }
        
        // Clear highlight if expired
        if (Date.now() >= this.highlightEndTime) {
            this.highlightedEntity = null
        }
    }
    
    // Entity highlighting
    highlightEntity(entity, duration = 2000) {
        this.highlightedEntity = entity
        this.highlightEndTime = Date.now() + duration
    }
    
    // World coordinate conversion methods
    screenToWorld(screenX, screenY) {
        return {
            x: this.camera.viewX + (screenX - this.canvas.width / 2) / this.camera.zoomLevel,
            y: this.camera.viewY + (screenY - this.canvas.height / 2) / this.camera.zoomLevel
        }
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.camera.viewX) * this.camera.zoomLevel + this.canvas.width / 2,
            y: (worldY - this.camera.viewY) * this.camera.zoomLevel + this.canvas.height / 2
        }
    }
}

export default CanvasRenderer
