class PerceptionRenderer {
    constructor(world) {
        this.world = world
        this.perceptionMode = false
    }
    
    togglePerceptionMode() {
        this.perceptionMode = !this.perceptionMode
        console.log(`Perception mode: ${this.perceptionMode ? 'ON' : 'OFF'}`)
    }
    
    // Get entities to render based on perception mode
    getEntitiesToRender(followedEntity) {
        if (!this.perceptionMode || !followedEntity) {
            // Render all entities in normal mode
            return Array.from(this.world.entitiesMap.values())
        }
        
        // In perception mode, only render entities the followed entity can perceive
        const follower = followedEntity
        const detectionRange = follower.traits?.detection || 100
        
        // Get entities within detection range
        const nearbyEntities = this.world.getNearbyEntities(follower.x, follower.y, detectionRange)
        
        // Always include the followed entity
        if (!nearbyEntities.includes(follower)) {
            nearbyEntities.push(follower)
        }
        
        // Also include entities the follower remembers
        if (follower.memory) {
            const rememberedEntities = this.getRememberedEntities(follower)
            for (const entity of rememberedEntities) {
                if (!nearbyEntities.includes(entity)) {
                    nearbyEntities.push(entity)
                }
            }
        }
        
        return nearbyEntities
    }
    
    getRememberedEntities(follower) {
        const remembered = []
        
        if (follower.memory) {
            // Get remembered food sources
            if (follower.memory.knownFood) {
                for (const foodMemory of follower.memory.knownFood) {
                    const entity = Array.from(this.world.entitiesMap.values())
                        .find(e => e.id === foodMemory.id)
                    if (entity) remembered.push(entity)
                }
            }
            
            // Get remembered water sources
            if (follower.memory.knownWater) {
                for (const waterMemory of follower.memory.knownWater) {
                    const entity = Array.from(this.world.entitiesMap.values())
                        .find(e => e.id === waterMemory.id)
                    if (entity) remembered.push(entity)
                }
            }
            
            // Get remembered shelter
            if (follower.memory.knownShelter) {
                for (const shelterMemory of follower.memory.knownShelter) {
                    const entity = Array.from(this.world.entitiesMap.values())
                        .find(e => e.id === shelterMemory.id)
                    if (entity) remembered.push(entity)
                }
            }
        }
        
        return remembered
    }
    
    getEntityRenderAlpha(entity, followedEntity) {
        if (!this.perceptionMode || !followedEntity) {
            return 1.0  // Full opacity in normal mode
        }
        
        const follower = followedEntity
        
        // The followed entity is always fully visible
        if (entity === follower) {
            return 1.0
        }
        
        // Calculate distance to follower
        const dx = entity.x - follower.x
        const dy = entity.y - follower.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        const detectionRange = follower.traits?.detection || 100
        
        // Check if entity is currently visible (within detection range)
        if (distance <= detectionRange) {
            // Fade based on distance - closer entities are more visible
            const visibilityFactor = 1 - (distance / detectionRange)
            return Math.max(0.8, visibilityFactor)  // Min 80% opacity for detected entities
        }
        
        // Check if entity is remembered
        if (this.isEntityRemembered(follower, entity)) {
            // Remembered entities are shown with reduced opacity
            return 0.3
        }
        
        // Entity is not perceived
        return 0
    }
    
    isEntityRemembered(follower, entity) {
        if (!follower.memory) return false
        
        // Check if entity is in any memory category
        const allMemories = [
            ...(follower.memory.knownFood || []),
            ...(follower.memory.knownWater || []),
            ...(follower.memory.knownShelter || [])
        ]
        
        return allMemories.some(memory => memory.id === entity.id)
    }
    
    // Add Pawn memoryMap support for landmarks
    getVisibleLandmarksForPawn(pawn, range = 100) {
        if (!pawn?.memoryMap) return []
        return pawn.getVisibleLandmarks?.(pawn.x, pawn.y, range) ?? []
    }

    getLandmarkRenderStyle(landmark) {
        // Style based on faded/fog status
        if (landmark.fog) {
            return { opacity: 0.1, filter: 'grayscale(1) blur(2px)' }
        }
        if (landmark.faded) {
            return { opacity: 0.4, filter: 'grayscale(0.7)' }
        }
        return { opacity: 1, filter: 'none' }
    }
}

export default PerceptionRenderer
