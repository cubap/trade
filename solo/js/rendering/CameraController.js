class CameraController {
    constructor(canvas, world) {
        this.canvas = canvas
        this.world = world
        
        // Zoom settings
        this.zoomLevel = 1
        this.minZoom = 0.1
        this.maxZoom = 5
        this.zoomSpeed = 0.1
        
        // Center view position 
        this.viewX = world.width / 2
        this.viewY = world.height / 2
        
        // Follow camera settings
        this.followMode = false
        this.followedEntity = null
        this.followSmoothing = 0.1  // How smoothly the camera follows (0-1)
        
        // Panning state
        this.isPanning = false
        this.lastMouseX = 0
        this.lastMouseY = 0
        
        this.setupEventHandlers()
    }
    
    setupEventHandlers() {
        this.setupZoomHandlers()
        this.setupPanningHandlers()
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
            if (!this.isPanning || this.followMode) return  // Disable panning in follow mode
            
            // Calculate distance moved
            const deltaX = event.clientX - this.lastMouseX
            const deltaY = event.clientY - this.lastMouseY
            
            // Update view position (invert delta to match drag direction)
            this.viewX -= deltaX / this.zoomLevel
            this.viewY -= deltaY / this.zoomLevel
            
            // Keep view within bounds
            this.constrainView()
            
            // Update mouse position for next move
            this.lastMouseX = event.clientX
            this.lastMouseY = event.clientY
        })
        
        // Mouse up event - stop panning
        window.addEventListener('mouseup', (event) => {
            if (event.button === 1) {
                this.isPanning = false
            }
        })
    }
    
    constrainView() {
        // Keep view within world bounds with some padding
        const padding = 100
        
        this.viewX = Math.max(-padding, Math.min(this.world.width + padding, this.viewX))
        this.viewY = Math.max(-padding, Math.min(this.world.height + padding, this.viewY))
    }
    
    // Follow camera methods
    setFollowEntity(entity) {
        this.followedEntity = entity
        this.followMode = entity !== null
        
        if (entity) {
            // Immediately center on the entity
            this.viewX = entity.x
            this.viewY = entity.y
            console.log(`Now following: ${entity.name || entity.id}`)
        } else {
            console.log('Follow mode disabled')
        }
    }
    
    updateFollowCamera() {
        if (this.followMode && this.followedEntity) {
            // Smoothly move camera to follow the entity
            const targetX = this.followedEntity.x
            const targetY = this.followedEntity.y
            
            // Use linear interpolation for smooth following
            this.viewX += (targetX - this.viewX) * this.followSmoothing
            this.viewY += (targetY - this.viewY) * this.followSmoothing
        }
    }
    
    // Apply camera transformations to rendering context
    applyTransform(context) {
        context.translate(this.canvas.width / 2, this.canvas.height / 2)
        context.scale(this.zoomLevel, this.zoomLevel)
        context.translate(-this.viewX, -this.viewY)
    }

    // Adjust zoom so that a given world radius fits within the viewport (using the shorter dimension)
    setZoomToShowRadius(radius, marginFactor = 0.9) {
        if (!radius || radius <= 0) return
        const minDim = Math.min(this.canvas.width, this.canvas.height)
        const desired = (minDim * marginFactor) / (radius * 2)
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, desired))
    }
}

export default CameraController
