class EntityRenderer {
    constructor(context, colorPalettes) {
        this.context = context
        this.colorPalettes = colorPalettes
        this.activePalette = 'vivid'
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
        const size = entity.size || 10
        
        this.context.fillStyle = this.getColorForEntity(entity)
        
        // Different shapes based on entity type
        if (entity.tags?.includes('food')) {
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
        } else if (entity.tags?.includes('water')) {
            // Water sources are blue circles with wavy effect
            this.context.beginPath()
            this.context.arc(x, y, size, 0, Math.PI * 2)
            this.context.fill()
            
            // Add water effect
            this.context.strokeStyle = '#4169E1'
            this.context.lineWidth = 2
            for (let i = 0; i < 3; i++) {
                this.context.beginPath()
                this.context.arc(x, y, size - (i * 3), 0, Math.PI * 2)
                this.context.stroke()
            }
        } else if (entity.tags?.includes('cover')) {
            // Cover/shelter are squares
            this.context.fillRect(x - size, y - size, size * 2, size * 2)
            
            // Add occupancy indicator
            if (entity.currentOccupants > 0) {
                this.context.fillStyle = '#FFD700'
                this.context.font = '8px Arial'
                this.context.textAlign = 'center'
                this.context.fillText(entity.currentOccupants.toString(), x, y + 3)
            }
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
