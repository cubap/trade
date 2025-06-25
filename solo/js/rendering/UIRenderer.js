class UIRenderer {
    constructor(context, world) {
        this.context = context
        this.world = world
        
        // UI settings
        this.showGrid = true
        this.showChunks = false
        this.showMinimap = false
        this.gridSpacing = 100
        this.gridMinorLines = 5
    }
    
    renderGrid() {
        if (!this.showGrid) return
        
        // Major grid lines
        this.context.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        this.context.lineWidth = 1
        
        // Vertical lines
        for (let x = 0; x <= this.world.width; x += this.gridSpacing) {
            this.context.beginPath()
            this.context.moveTo(x, 0)
            this.context.lineTo(x, this.world.height)
            this.context.stroke()
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.world.height; y += this.gridSpacing) {
            this.context.beginPath()
            this.context.moveTo(0, y)
            this.context.lineTo(this.world.width, y)
            this.context.stroke()
        }
        
        // Minor grid lines
        this.context.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        this.context.lineWidth = 0.5
        
        const minorSpacing = this.gridSpacing / this.gridMinorLines
        
        // Minor vertical lines
        for (let x = minorSpacing; x < this.world.width; x += minorSpacing) {
            if (x % this.gridSpacing !== 0) {  // Skip major lines
                this.context.beginPath()
                this.context.moveTo(x, 0)
                this.context.lineTo(x, this.world.height)
                this.context.stroke()
            }
        }
        
        // Minor horizontal lines
        for (let y = minorSpacing; y < this.world.height; y += minorSpacing) {
            if (y % this.gridSpacing !== 0) {  // Skip major lines
                this.context.beginPath()
                this.context.moveTo(0, y)
                this.context.lineTo(this.world.width, y)
                this.context.stroke()
            }
        }
    }
    
    renderChunks() {
        if (!this.world?.chunkManager) return
        
        const chunkManager = this.world.chunkManager
        
        // Set style for chunk boundaries
        this.context.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        this.context.lineWidth = 2
        this.context.setLineDash([5, 10])
        
        // Draw chunk boundaries
        for (let x = 0; x < chunkManager.chunksX; x++) {
            for (let y = 0; y < chunkManager.chunksY; y++) {
                const chunk = chunkManager.getChunk(x, y)
                if (!chunk) continue
                
                // Draw chunk boundary
                this.context.strokeRect(
                    chunk.worldX, 
                    chunk.worldY, 
                    chunk.size, 
                    chunk.size
                )
                
                // Draw biome indicator
                this.context.fillStyle = this.getBiomeColor(chunk.biome)
                this.context.globalAlpha = 0.1
                this.context.fillRect(
                    chunk.worldX, 
                    chunk.worldY, 
                    chunk.size, 
                    chunk.size
                )
                this.context.globalAlpha = 1.0
                
                // Draw chunk label (if zoomed in enough)
                const currentZoom = this.getCurrentZoomLevel?.() || 1
                if (currentZoom > 0.5) {
                    this.context.fillStyle = 'rgba(255, 255, 255, 0.8)'
                    this.context.font = `${Math.max(12, 16 * currentZoom)}px Arial`
                    this.context.textAlign = 'center'
                    this.context.textBaseline = 'middle'
                    
                    const centerX = chunk.worldX + chunk.size / 2
                    const centerY = chunk.worldY + chunk.size / 2
                    
                    // Chunk coordinates and biome
                    this.context.fillText(
                        `${chunk.x},${chunk.y}`,
                        centerX,
                        centerY - 10
                    )
                    this.context.fillText(
                        chunk.biome,
                        centerX,
                        centerY + 10
                    )
                }
            }
        }
        
        // Reset line style
        this.context.setLineDash([])
        this.context.lineWidth = 1
    }
    
    getBiomeColor(biome) {
        const biomeColors = {
            'grassland': '#90EE90',    // Light green
            'forest': '#228B22',       // Forest green
            'plains': '#F0E68C',       // Khaki
            'wetland': '#4682B4',      // Steel blue
            'mountain': '#A0522D',     // Sienna
            'desert': '#F4A460'        // Sandy brown
        }
        return biomeColors[biome] || '#808080'  // Default gray
    }
    
    renderMinimap() {
        if (!this.showMinimap) return
        
        // Minimap implementation would go here
        // For now, just a placeholder
        const minimapSize = 150
        const minimapX = 10
        const minimapY = 10
        
        this.context.fillStyle = 'rgba(0, 0, 0, 0.5)'
        this.context.fillRect(minimapX, minimapY, minimapSize, minimapSize)
        
        this.context.strokeStyle = '#FFF'
        this.context.lineWidth = 2
        this.context.strokeRect(minimapX, minimapY, minimapSize, minimapSize)
    }
    
    drawUI() {
        // Any other UI elements that need to be drawn without world transformations
        // (This would be called after restoring context)
    }
    
    // Setter method for zoom level reference
    setZoomLevelGetter(zoomGetter) {
        this.getCurrentZoomLevel = zoomGetter
    }
}

export default UIRenderer
