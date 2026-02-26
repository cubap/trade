class EntityRenderer {
    constructor(context, colorPalettes) {
        this.context = context
        this.colorPalettes = colorPalettes
        this.activePalette = 'vivid'
    }
    
    // Helper to read tags whether Set or Array
    hasTag(entity, tag) {
        const t = entity?.tags
        if (!t) return false
        if (Array.isArray(t)) return t.includes(tag)
        return typeof t.has === 'function' ? t.has(tag) : false
    }
    
    renderMobileEntity(entity, progress) {
        // For mobile entities, we need to interpolate between previous and current positions
        let x = entity.x
        let y = entity.y
        
        // Check if entity has movement data for interpolation
        if (entity.prevX !== undefined && entity.prevY !== undefined && progress !== undefined) {
            // Interpolate between previous and current positions
            x = entity.prevX + (entity.x - entity.prevX) * progress
            y = entity.prevY + (entity.y - entity.prevY) * progress
        }
        
        // Continue with rendering at the interpolated position
        
        // Animal-specific rendering
        if (entity.subtype === 'animal') {
            this.renderAnimal(entity, x, y)
        } else if (entity.subtype === 'pawn') {
            this.renderPawn(entity, x, y)
        } else {
            // Default rendering for other mobile entities
            this.renderDefaultMobile(entity, x, y)
        }
        
        // Store interpolated position for any additional rendering
        entity._renderX = x
        entity._renderY = y
    }
    
    renderAnimal(animal, x, y) {
        // Set drawing style based on animal properties
        this.context.fillStyle = this.getColorForEntity(animal)
        this.context.strokeStyle = '#333'
        this.context.lineWidth = 1
        
        // Draw animal body - use diet to determine shape
        const size = animal.size || 8
        
        if (animal.diet === 'carnivore') {
            // Draw triangle for carnivores (more angular)
            this.context.beginPath()
            this.context.moveTo(x, y - size)
            this.context.lineTo(x - size, y + size)
            this.context.lineTo(x + size, y + size)
            this.context.closePath()
            this.context.fill()
            this.context.stroke()
        } else {
            // Draw circle for herbivores and omnivores (more rounded)
            this.context.beginPath()
            this.context.arc(x, y, size, 0, Math.PI * 2)
            this.context.fill()
            this.context.stroke()
        }
        
        // Draw direction indicator
        if (animal.nextTargetX !== undefined && animal.nextTargetY !== undefined) {
            const dx = animal.nextTargetX - animal.x
            const dy = animal.nextTargetY - animal.y
            const angle = Math.atan2(dy, dx)
            
            // Draw small arrow indicating direction
            this.context.strokeStyle = '#000'
            this.context.lineWidth = 2
            this.context.beginPath()
            this.context.moveTo(x, y)
            this.context.lineTo(
                x + Math.cos(angle) * size * 0.8,
                y + Math.sin(angle) * size * 0.8
            )
            this.context.stroke()
        }
        
        // Draw behavior state indicator
        if (animal.behaviorState) {
            this.context.fillStyle = this.getBehaviorColor(animal.behaviorState)
            this.context.beginPath()
            this.context.arc(x, y - size - 8, 3, 0, Math.PI * 2)
            this.context.fill()
        }
        
        // Draw species label
        if (animal.species) {
            this.context.fillStyle = '#000'
            this.context.font = '10px Arial'
            this.context.textAlign = 'center'
            this.context.fillText(animal.species, x, y + size + 15)
        }
        
        // Draw drive indicators if they exist
        if (animal.drives) {
            this.renderDriveIndicators(animal, x, y, size)
        }
        
        // Draw entity (position only rounded during rendering)
        this.context.fillStyle = this.getColorForEntity(animal)
        
        // Draw name/ID
        this.context.fillStyle = '#000'
        this.context.font = '10px Arial'
        this.context.textAlign = 'center'
        this.context.fillText(animal.name || animal.id, x, y + size + 25)
    }
    
    renderDefaultMobile(entity, x, y) {
        this.context.fillStyle = this.getColorForEntity(entity)
        
        // Draw entity (position only rounded during rendering)
        this.context.fillRect(x - (entity.size || 10) / 2, y - (entity.size || 10) / 2, entity.size || 10, entity.size || 10)
        
        // Draw name/ID
        this.context.fillStyle = '#000'
        this.context.font = '10px Arial'
        this.context.textAlign = 'center'
        this.context.fillText(entity.name || entity.id, x, y + (entity.size || 10) + 15)
    }
    
    renderImmobileEntity(entity) {
        // Basic rendering for immobile entities
        const x = entity.x
        const y = entity.y
    const size = Math.max(0, entity.size ?? 10)
        
        this.context.fillStyle = this.getColorForEntity(entity)
        
        // Different shapes based on entity type
        if (entity.type === 'grass') {
            this.renderGrassPatch(entity)
        } else if (entity.type === 'bush') {
            this.renderBush(entity)
        } else if (entity.type === 'tree') {
            this.renderTree(entity)
        } else if (this.hasTag(entity, 'food')) {
            // Food sources are circles
            this.context.beginPath()
            this.context.arc(x, y, size, 0, Math.PI * 2)
            this.context.fill()
            
            // Add depletion indicator
            if (entity.depleted) {
                this.context.strokeStyle = '#FF0000'
                this.context.lineWidth = 2
                this.context.beginPath()
                this.context.moveTo(x - size, y - size)
                this.context.lineTo(x + size, y + size)
                this.context.moveTo(x + size, y - size)
                this.context.lineTo(x - size, y + size)
                this.context.stroke()
            }
        } else if (this.hasTag(entity, 'water')) {
            // Water sources are blue circles with wavy effect
            if (size > 0) {
                this.context.beginPath()
                this.context.arc(x, y, size, 0, Math.PI * 2)
                this.context.fill()
            }
            
            // Add water effect (skip rings with non-positive radius)
            this.context.strokeStyle = '#4169E1'
            this.context.lineWidth = 2
            for (let i = 0; i < 3; i++) {
                const r = size - (i * 3)
                if (r <= 0) continue
                this.context.beginPath()
                this.context.arc(x, y, r, 0, Math.PI * 2)
                this.context.stroke()
            }
        } else if (this.hasTag(entity, 'school')) {
            // School structure: stylized building with roof
            const w = size * 2
            const h = size * 1.6
            this.context.fillStyle = '#6b8e23'
            this.context.fillRect(x - w/2, y - h/2, w, h)
            // Roof
            this.context.fillStyle = '#556b2f'
            this.context.beginPath()
            this.context.moveTo(x - w/2, y - h/2)
            this.context.lineTo(x, y - h/2 - size * 0.6)
            this.context.lineTo(x + w/2, y - h/2)
            this.context.closePath()
            this.context.fill()
            // Occupancy indicator
            if (entity.occupants?.size) {
                this.context.fillStyle = '#FFD700'
                this.context.font = '8px Arial'
                this.context.textAlign = 'center'
                this.context.fillText(String(entity.occupants.size), x, y + 4)
            }
        } else if (this.hasTag(entity, 'cover')) {
            // Cover/shelter are squares
            this.context.fillRect(x - size, y - size, size * 2, size * 2)
            
            // Add occupancy indicator
            if (entity.currentOccupants > 0) {
                this.context.fillStyle = '#FFD700'
                this.context.font = '8px Arial'
                this.context.textAlign = 'center'
                this.context.fillText(entity.currentOccupants.toString(), x, y + 3)
            }
        } else if (this.hasTag(entity, 'resource_cache') || entity.subtype === 'cache') {
            // Resource cache: stacked pile silhouette
            this.context.beginPath()
            this.context.moveTo(x - size, y + size * 0.7)
            this.context.lineTo(x, y - size)
            this.context.lineTo(x + size, y + size * 0.7)
            this.context.closePath()
            this.context.fill()

            this.context.fillStyle = '#2d2418'
            this.context.font = '8px Arial'
            this.context.textAlign = 'center'
            const count = typeof entity.totalItems === 'function' ? entity.totalItems() : (entity.items?.length ?? 0)
            this.context.fillText(String(count), x, y + 3)
        } else {
            // Default rendering - rectangle
            this.context.fillRect(x - size / 2, y - size / 2, size, size)
        }
        
        // Draw name for important entities
        if (entity.name && (entity.name !== entity.id)) {
            this.context.fillStyle = '#000'
            this.context.font = '8px Arial'
            this.context.textAlign = 'center'
            this.context.fillText(entity.name, x, y + size + 12)
        }
    }

    // Specialized plant renderers
    renderGrassPatch(grass) {
        const ctx = this.context
        const x = grass.x
        const y = grass.y
        const pop = Math.max(0, Math.min(100, grass.population ?? 0))
        // Base radius and alpha scale with population
        const r = 10 // patch radius in world units
        const alpha = Math.min(0.75, 0.12 + (pop / 100) * 0.6)
        // Base fill (background-like)
        ctx.fillStyle = `rgba(60, 130, 60, ${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()

        // Dithered blades/dots proportional to population (deterministic per id)
        const dots = Math.min(18, Math.floor(pop / 6))
        let h = 0
        const idStr = String(grass.id ?? `${x},${y}`)
        for (let i = 0; i < idStr.length; i++) h = idStr.charCodeAt(i) + ((h << 5) - h)
        const rand = () => {
            h = (h * 9301 + 49297) % 233280
            return h / 233280
        }
        ctx.fillStyle = 'rgba(34, 139, 34, 0.6)'
        for (let i = 0; i < dots; i++) {
            const ang = rand() * Math.PI * 2
            const rad = rand() * r
            const px = x + Math.cos(ang) * rad
            const py = y + Math.sin(ang) * rad
            ctx.fillRect(px - 0.5, py - 0.5, 1, 1)
        }
    }

    renderBush(bush) {
        const ctx = this.context
        const x = bush.x
        const y = bush.y
        const stage = bush.stage || 'mature' // sprout, growing, mature
        const sizeMap = { sprout: 6, growing: 10, mature: 14 }
        const r = sizeMap[stage] ?? 12
        // Main clump
        ctx.fillStyle = '#3d7a3d'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        // Textured edge
        ctx.strokeStyle = '#2e6a2e'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, r - 1, 0, Math.PI * 2)
        ctx.stroke()
        // Berries if food-bearing
        if (this.hasTag(bush, 'food')) {
            ctx.fillStyle = '#b03060' // berry accent
            for (let i = 0; i < 3; i++) {
                const ang = (i * 2 * Math.PI) / 3
                ctx.beginPath()
                ctx.arc(x + Math.cos(ang) * (r * 0.5), y + Math.sin(ang) * (r * 0.5), 2, 0, Math.PI * 2)
                ctx.fill()
            }
        }
    }

    renderTree(tree) {
        const ctx = this.context
        const x = tree.x
        const y = tree.y
        const stage = tree.stage || 'adult' // seedling, sapling, adult
        // Sizes by stage
        const canopyMap = { seedling: 6, sapling: 10, adult: 16 }
        const trunkHMap = { seedling: 6, sapling: 10, adult: 16 }
        const trunkWMap = { seedling: 2, sapling: 3, adult: 4 }
        const canopyR = canopyMap[stage] ?? 14
        const trunkH = trunkHMap[stage] ?? 14
        const trunkW = trunkWMap[stage] ?? 3
        // Trunk
        ctx.fillStyle = '#8B5A2B'
        ctx.fillRect(x - trunkW / 2, y, trunkW, trunkH)
        // Canopy
        ctx.fillStyle = '#2e8b57'
        ctx.beginPath()
        ctx.arc(x, y, canopyR, 0, Math.PI * 2)
        ctx.fill()
        // Food-bearing accent (fruit) if tagged as food
        if (this.hasTag(tree, 'food')) {
            ctx.fillStyle = '#ffbf00'
            for (let i = 0; i < 4; i++) {
                const ang = (i * 2 * Math.PI) / 4 + 0.5
                ctx.beginPath()
                ctx.arc(x + Math.cos(ang) * (canopyR * 0.6), y + Math.sin(ang) * (canopyR * 0.4), 2, 0, Math.PI * 2)
                ctx.fill()
            }
        }
    }
    
    renderFollowIndicator(entity) {
        // Draw a special indicator around the followed entity
        this.context.strokeStyle = '#FFD700'  // Gold color
        this.context.lineWidth = 3
        this.context.setLineDash([5, 5])
        
        const radius = (entity.size || 10) + 15
        
        this.context.beginPath()
        this.context.arc(entity.x, entity.y, radius, 0, Math.PI * 2)
        this.context.stroke()
        
        // Reset line style
        this.context.setLineDash([])
        this.context.lineWidth = 1
        
        // Add "FOLLOWING" text above the entity
        this.context.fillStyle = '#FFD700'
        this.context.font = '14px Arial'
        this.context.textAlign = 'center'
        this.context.fillText('FOLLOWING', entity.x, entity.y - radius - 10)
    }
    
    renderHighlight(entity) {
        // Draw highlight effect around entity
        this.context.strokeStyle = '#FFD700'
        this.context.lineWidth = 3
        this.context.setLineDash([10, 5])
        
        const size = entity.size || 10
        const padding = 5
        
        if (entity.type === 'mobile') {
            // For mobile entities, draw circle
            this.context.beginPath()
            this.context.arc(entity.x, entity.y, size + padding, 0, Math.PI * 2)
            this.context.stroke()
        } else {
            // For immobile entities, draw rectangle
            this.context.strokeRect(
                entity.x - size - padding,
                entity.y - size - padding,
                (size + padding) * 2,
                (size + padding) * 2
            )
        }
        
        // Reset line style
        this.context.setLineDash([])
        this.context.lineWidth = 1
    }
    
    // Helper methods
    getColorForEntity(entity) {
        const palette = this.colorPalettes[this.activePalette] || this.colorPalettes.vivid
        
        // Use entity color if specified
        if (entity.color) {
            return entity.color
        }
        
        // Generate consistent color based on entity ID
        let hash = 0
        const str = entity.id || entity.name || 'default'
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        
        return palette[Math.abs(hash) % palette.length]
    }
    
    getBehaviorColor(behaviorState) {
        const behaviorColors = {
            'idle': '#808080',
            'foraging': '#90EE90',
            'seeking_water': '#4169E1',
            'fleeing': '#FF4500',
            'resting': '#DDA0DD',
            'exploring': '#FFD700'
        }
        
        return behaviorColors[behaviorState] || '#808080'
    }
    
    renderDriveIndicators(animal, x, y, size) {
        // Draw small bars above the animal showing drive levels
        const barWidth = 20
        const barHeight = 3
        const barSpacing = 5
        let barY = y - size - 20
        
        const criticalDrives = ['hunger', 'thirst', 'rest']
        
        for (let i = 0; i < criticalDrives.length; i++) {
            const drive = criticalDrives[i]
            const value = animal.drives[drive] || 0
            
            // Background bar
            this.context.fillStyle = '#333'
            this.context.fillRect(x - barWidth / 2, barY, barWidth, barHeight)
            
            // Drive level bar
            const driveColor = this.getDriveColor(drive, value)
            this.context.fillStyle = driveColor
            this.context.fillRect(x - barWidth / 2, barY, (barWidth * value) / 100, barHeight)
            
            barY += barHeight + 2
        }
    }
    
    getDriveColor(drive, value) {
        // Color based on drive urgency
        if (value > 80) {
            return '#FF0000'  // Red - critical
        } else if (value > 60) {
            return '#FFA500'  // Orange - high
        } else if (value > 40) {
            return '#FFFF00'  // Yellow - medium
        } else {
            return '#00FF00'  // Green - low
        }
    }
    
    renderPawn(pawn, x, y) {
        // Set drawing style for pawns
        this.context.fillStyle = this.getColorForEntity(pawn)
        this.context.strokeStyle = '#333'
        this.context.lineWidth = 2
        
        // Draw pawn body - use square with rounded corners
        const size = pawn.size || 10
        
        // Draw the main body
        this.context.beginPath()
        
        // Use roundRect if available, otherwise use regular rect
        if (this.context.roundRect) {
            this.context.roundRect(x - size/2, y - size/2, size, size, size/4)
        } else {
            this.context.rect(x - size/2, y - size/2, size, size)
        }
        
        this.context.fill()
        this.context.stroke()
        
        // Draw direction indicator
        if (pawn.nextTargetX !== undefined && pawn.nextTargetY !== undefined) {
            const dx = pawn.nextTargetX - pawn.x
            const dy = pawn.nextTargetY - pawn.y
            const angle = Math.atan2(dy, dx)
            
            // Draw arrow indicating direction
            this.context.strokeStyle = '#FFF'
            this.context.lineWidth = 2
            this.context.beginPath()
            this.context.moveTo(x, y)
            this.context.lineTo(
                x + Math.cos(angle) * size * 0.6,
                y + Math.sin(angle) * size * 0.6
            )
            this.context.stroke()
        }
        
        // Draw behavior state indicator
        if (pawn.behaviorState) {
            this.context.fillStyle = this.getBehaviorColor(pawn.behaviorState)
            this.context.beginPath()
            this.context.arc(x, y - size - 8, 3, 0, Math.PI * 2)
            this.context.fill()
        }
        
        // Draw needs indicators (safely)
        if (pawn.needs && pawn.needs.getMostUrgentNeed) {
            try {
                this.renderNeedsIndicators(pawn, x, y, size)
            } catch (error) {
                // If needs rendering fails, skip it
                console.warn('Needs rendering failed:', error)
            }
        }
        
        // Draw current goal indicator (safely)
        if (pawn.goals && pawn.goals.currentGoal) {
            try {
                this.renderGoalIndicator(pawn, x, y, size)
            } catch (error) {
                // If goal rendering fails, skip it
                console.warn('Goal rendering failed:', error)
            }
        }
        
        // Draw name/ID
        this.context.fillStyle = '#000'
        this.context.font = '10px Arial'
        this.context.textAlign = 'center'
        this.context.fillText(pawn.name || pawn.id, x, y + size + 25)
    }
    
    renderNeedsIndicators(pawn, x, y, size) {
        const mostUrgent = pawn.needs.getMostUrgentNeed()
        
        if (mostUrgent.urgency > 0) {
            // Draw urgent need indicator
            const colors = {
                1: '#FFFF00', // Yellow for low urgency
                2: '#FFA500', // Orange for medium urgency
                3: '#FF6600', // Red-orange for high urgency
                4: '#FF0000'  // Red for critical urgency
            }
            
            this.context.fillStyle = colors[mostUrgent.urgency] || '#FFFF00'
            this.context.beginPath()
            this.context.arc(x + size/2 + 5, y - size/2 - 5, 4, 0, Math.PI * 2)
            this.context.fill()
            
            // Draw need type indicator (first letter)
            this.context.fillStyle = '#000'
            this.context.font = '8px Arial'
            this.context.textAlign = 'center'
            this.context.fillText(
                mostUrgent.need.charAt(0).toUpperCase(), 
                x + size/2 + 5, 
                y - size/2 - 2
            )
        }
    }
    
    renderGoalIndicator(pawn, x, y, size) {
        const goal = pawn.goals.currentGoal
        
        // Draw goal type indicator
        const goalColors = {
            'find_food': '#00FF00',
            'find_water': '#0088FF',
            'rest': '#800080',
            'seek_shelter': '#8B4513',
            'socialize': '#FFB6C1',
            'work': '#FFD700',
            'explore': '#32CD32'
        }
        
        this.context.fillStyle = goalColors[goal.type] || '#808080'
        this.context.beginPath()
        this.context.arc(x - size/2 - 5, y - size/2 - 5, 3, 0, Math.PI * 2)
        this.context.fill()
    }
}

export default EntityRenderer
