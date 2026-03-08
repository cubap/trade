class UIRenderer {
    constructor(context, world) {
        this.context = context
        this.world = world
        
        // UI settings
        this.showGrid = true
        this.showChunks = false
        this.showMinimap = false
        this.showCompass = false
        this.minimapMode = 'none'
        this.overrideBadgeText = ''
        this.labelsModeText = ''
        this.mapOverlayText = ''
        this.gridSpacing = 100
        this.gridMinorLines = 5
        this.capabilities = null
        this.waypointProvider = null
        this.routeTraceProvider = null
    }

    setCapabilities(payload) {
        this.capabilities = payload || null
        const modules = payload?.modules
        this.showCompass = !!modules?.compass && modules.compass !== 'none'
        this.showMinimap = !!modules?.minimap && modules.minimap !== 'none'
        this.minimapMode = modules?.minimap ?? 'none'
        this.overrideBadgeText = payload?.overrideActive ? `OVERRIDE: ${payload.phase}` : ''
        this.labelsModeText = modules?.labels ? `labels: ${String(modules.labels).replaceAll('_', ' ')}` : ''
        this.mapOverlayText = Array.isArray(modules?.mapOverlay) && modules.mapOverlay.length > 0
            ? `overlay: ${modules.mapOverlay.map(item => String(item).replaceAll('_', ' ')).join(', ')}`
            : 'overlay: none'
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

        const config = this.getMinimapRenderConfig(this.minimapMode)
        this.renderMinimapEntities(minimapX, minimapY, minimapSize, config)
        this.renderMinimapOverlays(minimapX, minimapY, minimapSize)

        if (config.scanRing) {
            const centerX = minimapX + minimapSize / 2
            const centerY = minimapY + minimapSize / 2
            this.context.strokeStyle = 'rgba(147, 197, 253, 0.65)'
            this.context.lineWidth = 1
            this.context.beginPath()
            this.context.arc(centerX, centerY, minimapSize * 0.24, 0, Math.PI * 2)
            this.context.stroke()
        }

        // Stage label for incremental minimap/radar progression visibility.
        const modeLabel = this.minimapMode.replaceAll('_', ' ')
        this.context.fillStyle = 'rgba(255, 255, 255, 0.9)'
        this.context.font = '11px Arial'
        this.context.textAlign = 'left'
        this.context.textBaseline = 'top'
        this.context.fillText(modeLabel, minimapX + 6, minimapY + minimapSize + 4)
    }

    getMinimapRenderConfig(mode) {
        const configs = {
            radar_blips: { maxEntities: 20, includeImmobile: false, dotSize: 1.8, alpha: 0.85, scanRing: true },
            radar_icons: { maxEntities: 28, includeImmobile: false, dotSize: 2.1, alpha: 0.95, scanRing: true },
            partial_recall_map: { maxEntities: 80, includeImmobile: true, dotSize: 1.6, alpha: 0.7, scanRing: false },
            local_full_map: { maxEntities: 240, includeImmobile: true, dotSize: 1.6, alpha: 0.92, scanRing: false },
            strategic_map: { maxEntities: 320, includeImmobile: true, dotSize: 1.5, alpha: 0.9, scanRing: false }
        }
        return configs[mode] ?? { maxEntities: 0, includeImmobile: false, dotSize: 1.6, alpha: 0.8, scanRing: false }
    }

    renderMinimapEntities(minimapX, minimapY, minimapSize, config) {
        if (!config || config.maxEntities <= 0) return
        if (!this.world?.entitiesMap || this.world.width <= 0 || this.world.height <= 0) return

        let count = 0
        const entities = this.world.entitiesMap.values()

        for (const entity of entities) {
            if (count >= config.maxEntities) break
            if (!config.includeImmobile && entity?.type !== 'mobile') continue

            const x = Number.isFinite(entity?.x) ? entity.x : null
            const y = Number.isFinite(entity?.y) ? entity.y : null
            if (x === null || y === null) continue

            const px = minimapX + (x / this.world.width) * minimapSize
            const py = minimapY + (y / this.world.height) * minimapSize

            this.context.fillStyle = entity?.type === 'mobile'
                ? `rgba(74, 222, 128, ${config.alpha})`
                : `rgba(248, 250, 252, ${Math.max(0.35, config.alpha - 0.3)})`
            this.context.beginPath()
            this.context.arc(px, py, config.dotSize, 0, Math.PI * 2)
            this.context.fill()
            count += 1
        }
    }

    getActiveMapOverlays() {
        const overlays = this.capabilities?.modules?.mapOverlay
        return new Set(Array.isArray(overlays) ? overlays : [])
    }

    renderMinimapOverlays(minimapX, minimapY, minimapSize) {
        const overlays = this.getActiveMapOverlays()
        if (overlays.size === 0) return

        if (overlays.has('biome_edges')) {
            this.renderMinimapChunkEdges(minimapX, minimapY, minimapSize)
        }

        if (overlays.has('resource_class') || overlays.has('resource_known_types')) {
            this.renderMinimapResourceMarkers(minimapX, minimapY, minimapSize)
        }

        if (overlays.has('route_traces')) {
            this.renderMinimapRouteTraces(minimapX, minimapY, minimapSize)
        }

        if (overlays.has('waypoints_local')) {
            this.renderMinimapWaypoints(minimapX, minimapY, minimapSize)
        }
    }

    renderMinimapChunkEdges(minimapX, minimapY, minimapSize) {
        const chunkManager = this.world?.chunkManager
        if (!chunkManager?.chunksX || !chunkManager?.chunksY) return

        const stepX = minimapSize / chunkManager.chunksX
        const stepY = minimapSize / chunkManager.chunksY

        this.context.save()
        this.context.strokeStyle = 'rgba(148, 163, 184, 0.45)'
        this.context.lineWidth = 1

        for (let cx = 1; cx < chunkManager.chunksX; cx += 1) {
            const x = minimapX + stepX * cx
            this.context.beginPath()
            this.context.moveTo(x, minimapY)
            this.context.lineTo(x, minimapY + minimapSize)
            this.context.stroke()
        }

        for (let cy = 1; cy < chunkManager.chunksY; cy += 1) {
            const y = minimapY + stepY * cy
            this.context.beginPath()
            this.context.moveTo(minimapX, y)
            this.context.lineTo(minimapX + minimapSize, y)
            this.context.stroke()
        }

        this.context.restore()
    }

    renderMinimapResourceMarkers(minimapX, minimapY, minimapSize) {
        if (!this.world?.entitiesMap || this.world.width <= 0 || this.world.height <= 0) return

        this.context.save()
        this.context.fillStyle = 'rgba(251, 191, 36, 0.7)'
        let count = 0

        for (const entity of this.world.entitiesMap.values()) {
            if (count >= 80) break
            if (entity?.type !== 'immobile') continue
            if (!Number.isFinite(entity?.x) || !Number.isFinite(entity?.y)) continue

            const px = minimapX + (entity.x / this.world.width) * minimapSize
            const py = minimapY + (entity.y / this.world.height) * minimapSize
            this.context.fillRect(px - 1, py - 1, 2, 2)
            count += 1
        }

        this.context.restore()
    }

    renderMinimapRouteTraces(minimapX, minimapY, minimapSize) {
        const traces = this.routeTraceProvider?.() ?? []
        if (!Array.isArray(traces) || traces.length === 0) return

        this.context.save()
        this.context.strokeStyle = 'rgba(34, 197, 94, 0.7)'
        this.context.lineWidth = 1

        for (const trace of traces) {
            const points = Array.isArray(trace?.points) ? trace.points : []
            if (points.length < 2) continue

            let started = false
            this.context.beginPath()
            for (const point of points) {
                const projected = this.projectToMinimap(point, minimapX, minimapY, minimapSize)
                if (!projected) continue
                if (!started) {
                    this.context.moveTo(projected.x, projected.y)
                    started = true
                } else {
                    this.context.lineTo(projected.x, projected.y)
                }
            }
            if (started) this.context.stroke()
        }

        this.context.restore()
    }

    renderMinimapWaypoints(minimapX, minimapY, minimapSize) {
        const waypoints = this.waypointProvider?.() ?? []
        if (!Array.isArray(waypoints) || waypoints.length === 0) return

        this.context.save()
        this.context.strokeStyle = 'rgba(251, 146, 60, 0.95)'
        this.context.lineWidth = 1
        this.context.fillStyle = 'rgba(251, 146, 60, 0.85)'

        for (const waypoint of waypoints) {
            const projected = this.projectToMinimap(waypoint, minimapX, minimapY, minimapSize)
            if (!projected) continue

            this.context.beginPath()
            this.context.arc(projected.x, projected.y, 2.4, 0, Math.PI * 2)
            this.context.stroke()
            this.context.beginPath()
            this.context.arc(projected.x, projected.y, 1.2, 0, Math.PI * 2)
            this.context.fill()
        }

        this.context.restore()
    }

    projectToMinimap(point, minimapX, minimapY, minimapSize) {
        if (!this.world || this.world.width <= 0 || this.world.height <= 0) return null
        if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null
        return {
            x: minimapX + (point.x / this.world.width) * minimapSize,
            y: minimapY + (point.y / this.world.height) * minimapSize
        }
    }
    
    drawUI() {
        this.renderCompass()
        this.renderOverrideBadge()
        this.renderCapabilityPanel()
    }

    renderCapabilityPanel() {
        if (!this.labelsModeText && !this.mapOverlayText) return

        const x = 10
        const y = this.overrideBadgeText ? 206 : 170
        const panelWidth = 310
        const panelHeight = 46

        this.context.save()
        this.context.fillStyle = 'rgba(15, 23, 42, 0.65)'
        this.context.fillRect(x, y, panelWidth, panelHeight)
        this.context.strokeStyle = 'rgba(148, 163, 184, 0.8)'
        this.context.lineWidth = 1
        this.context.strokeRect(x, y, panelWidth, panelHeight)
        this.context.fillStyle = '#e2e8f0'
        this.context.font = '11px Arial'
        this.context.textAlign = 'left'
        this.context.textBaseline = 'top'

        if (this.labelsModeText) {
            this.context.fillText(this.labelsModeText, x + 8, y + 7)
        }
        if (this.mapOverlayText) {
            this.context.fillText(this.mapOverlayText, x + 8, y + 24)
        }
        this.context.restore()
    }

    renderCompass() {
        if (!this.showCompass) return

        const x = this.context.canvas.width - 72
        const y = 26
        this.context.save()
        this.context.fillStyle = 'rgba(0, 0, 0, 0.55)'
        this.context.fillRect(x - 18, y - 16, 56, 28)
        this.context.fillStyle = '#f8fafc'
        this.context.font = 'bold 14px Arial'
        this.context.textAlign = 'left'
        this.context.textBaseline = 'middle'
        this.context.fillText('N ↑', x, y)
        this.context.restore()
    }

    renderOverrideBadge() {
        if (!this.overrideBadgeText) return

        const x = 10
        const y = 170
        this.context.save()
        this.context.fillStyle = 'rgba(127, 29, 29, 0.8)'
        this.context.fillRect(x, y, 210, 28)
        this.context.strokeStyle = '#fca5a5'
        this.context.lineWidth = 1
        this.context.strokeRect(x, y, 210, 28)
        this.context.fillStyle = '#fee2e2'
        this.context.font = '12px Arial'
        this.context.textAlign = 'left'
        this.context.textBaseline = 'middle'
        this.context.fillText(this.overrideBadgeText, x + 8, y + 14)
        this.context.restore()
    }
    
    // Setter method for zoom level reference
    setZoomLevelGetter(zoomGetter) {
        this.getCurrentZoomLevel = zoomGetter
    }

    setWaypointProvider(provider) {
        this.waypointProvider = typeof provider === 'function' ? provider : null
    }

    setRouteTraceProvider(provider) {
        this.routeTraceProvider = typeof provider === 'function' ? provider : null
    }
}

export default UIRenderer
