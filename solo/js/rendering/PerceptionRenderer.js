import { sightRangeFor as coreSightRangeFor, classifyPin, isRememberedNear, resourceKindOf, REMEMBER_RADIUS } from '../core/SightRange.js'

class PerceptionRenderer {
    constructor(world) {
        this.world = world
        this.perceptionMode = false
    }

    /**
     * The radius to draw/cull at: whatever #80's line-of-sight pass actually
     * reached for this follower, else its nominal detection trait. Deliberately
     * not a second constant - one definition of "how far can it see" (#90).
     */
    sightRangeFor(entity) {
        return coreSightRangeFor(entity)
    }

    /** 'seen' | 'remembered' | 'hidden' | 'unknown' for one entity. */
    classify(entity, follower) {
        return classifyPin(follower, entity, { tick: this.world?.clock?.currentTick ?? 0 })
    }
    
    togglePerceptionMode() {
        this.perceptionMode = !this.perceptionMode
        console.log(`Perception mode: ${this.perceptionMode ? 'ON' : 'OFF'}`)
    }
    
    // Get entities to render based on perception mode
    getEntitiesToRender(followedEntity) {
        if (!followedEntity) {
            return Array.from(this.world.entitiesMap.values())
        }

        const chunkRadius = this.world?.renderChunkRadius ?? 3
        const baseEntities = this.world.chunkManager?.getEntitiesInChunkRadiusAtPosition
            ? this.world.chunkManager.getEntitiesInChunkRadiusAtPosition(followedEntity.x, followedEntity.y, chunkRadius, true)
            : Array.from(this.world.entitiesMap.values())

        if (!this.perceptionMode) {
            const visible = [...baseEntities]
            if (!visible.includes(followedEntity)) visible.push(followedEntity)
            return visible
        }
        
        // In perception mode, only render entities the followed entity can perceive
        const follower = followedEntity
        const detectionRange = this.sightRangeFor(follower)
        
        // Get entities within detection range
        const nearbyEntities = this.world.getNearbyEntities(follower.x, follower.y, detectionRange)
        
        // Always include the followed entity
        if (!nearbyEntities.includes(follower)) {
            nearbyEntities.push(follower)
        }
        
        // Also include entities the follower remembers from an earlier pass
        for (const entity of this.getRememberedEntities(follower)) {
            if (!nearbyEntities.includes(entity)) {
                nearbyEntities.push(entity)
            }
        }

        // Anything the last observation pass recorded as blocked drops out even
        // though it is inside the radius - hidden is not the same as absent, but
        // it is not visible either (#90).
        return nearbyEntities.filter(entity => this.classify(entity, follower) !== 'hidden')
    }
    
    /**
     * Entities the follower remembers. A Pawn files what it spots into
     * `resourceMemory` as `{type, x, y}` where `type` is the resource *subtype*,
     * while an Animal uses `memory.knownFood`-style id lists; both shapes mean
     * "remembered" here, which is why the pawn path used to return nothing (#90).
     */
    getRememberedEntities(follower) {
        const remembered = []
        const seenIds = new Set()
        const add = entity => {
            if (!entity || entity === follower || seenIds.has(entity)) return
            seenIds.add(entity)
            remembered.push(entity)
        }

        const memories = Array.isArray(follower?.resourceMemory) ? follower.resourceMemory : []
        const lookup = this.world?.chunkManager?.getEntitiesInRadius
            ? (x, y, r) => this.world.chunkManager.getEntitiesInRadius(x, y, r)
            : (this.world?.getNearbyEntities ? (x, y, r) => this.world.getNearbyEntities(x, y, r) : null)
        if (memories.length > 0 && lookup) {
            for (const memory of memories) {
                if (!Number.isFinite(memory?.x) || !Number.isFinite(memory?.y)) continue
                const nearby = lookup(memory.x, memory.y, REMEMBER_RADIUS) ?? []
                for (const entity of nearby) {
                    if (!memory.type || resourceKindOf(entity) === memory.type) add(entity)
                }
            }
        }

        // Legacy id-keyed memory lists (animals).
        const memoryLists = follower?.memory
            ? [
                ...(follower.memory.knownFood || []),
                ...(follower.memory.knownWater || []),
                ...(follower.memory.knownShelter || [])
            ]
            : []
        if (memoryLists.length > 0) {
            const ids = new Set(memoryLists.map(entry => entry?.id).filter(id => id != null))
            for (const entity of this.world.entitiesMap?.values() ?? []) {
                if (ids.has(entity.id)) add(entity)
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

        // #90: something inside range that the pawn's last pass could not see is
        // not perceived, even though it is nearer than things it can.
        const state = this.classify(entity, follower)
        if (state === 'hidden') return 0
        
        // Calculate distance to follower
        const dx = entity.x - follower.x
        const dy = entity.y - follower.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        const detectionRange = this.sightRangeFor(follower)
        
        // Check if entity is currently visible (within detection range)
        if (state === 'seen' && distance <= detectionRange) {
            // Fade based on distance - closer entities are more visible
            const visibilityFactor = 1 - (distance / detectionRange)
            return Math.max(0.8, visibilityFactor)  // Min 80% opacity for detected entities
        }
        
        // Check if entity is remembered
        if (state === 'remembered' || this.isEntityRemembered(follower, entity)) {
            // Remembered entities are shown with reduced opacity
            return 0.3
        }
        
        // Entity is not perceived
        return 0
    }
    
    isEntityRemembered(follower, entity) {
        // Pawns remember places, not entity ids: a matching resource near a
        // remembered spot counts as remembered (#90).
        if (isRememberedNear(follower, entity?.x, entity?.y, resourceKindOf(entity))) return true

        const memory = follower?.memory
        if (!memory || typeof memory !== 'object') return false

        // Check if entity is in any memory category
        const allMemories = [
            ...(memory.knownFood || []),
            ...(memory.knownWater || []),
            ...(memory.knownShelter || [])
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
