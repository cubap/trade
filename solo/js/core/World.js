import ActionQueue from './ActionQueue.js'
import GameClock from './GameClock.js'

class World {
    constructor(width = 2000, height = 2000) {
        this.width = width
        this.height = height
        this.entitiesMap = new Map()
        this.actionQueue = new ActionQueue()
        this.clock = new GameClock(500)  // 500ms per tick
    }

    addEntity(entity) {
        this.entitiesMap.set(entity.id || entity.name, entity)
        entity.world = this  // Set reference to world
        entity.spawned = this.clock.currentTick
    }

    update(timestamp) {
        // Check if we should process a new tick
        if (!this.clock.update(timestamp)) return false
        
        // Process scheduled actions for this tick
        this.actionQueue.processTick(this.clock.currentTick)
        
        // Update all entities
        const currentTick = this.clock.currentTick
        const entitiesToRemove = []
        
        for (const [id, entity] of this.entitiesMap.entries()) {
            // Call the entity's update method
            const entityAlive = entity.update(currentTick)
            
            // If entity returns false from update, it should be removed
            if (entityAlive === false) {
                entitiesToRemove.push(id)
                continue
            }
            
            // Keep entity in bounds
            this.keepEntityInBounds(entity)
        }
        
        // Remove any entities marked for removal
        for (const id of entitiesToRemove) {
            this.entitiesMap.delete(id)
        }
        
        // Only log occasional ticks to avoid console spam
        if (this.clock.currentTick % 20 === 0) {
            console.log(`Tick: ${this.clock.currentTick}, Entities: ${this.entitiesMap.size}`)
        }
        
        return true
    }

    keepEntityInBounds(entity) {
        // Keep current position in bounds
        if (entity.x < 0) entity.x = 0
        if (entity.y < 0) entity.y = 0
        if (entity.x > this.width) entity.x = this.width
        if (entity.y > this.height) entity.y = this.height
        
        // For mobile entities, also keep target position in bounds
        if (entity.type === 'mobile') {
            if (entity.targetX < 0) entity.targetX = 0
            if (entity.targetY < 0) entity.targetY = 0
            if (entity.targetX > this.width) entity.targetX = this.width
            if (entity.targetY > this.height) entity.targetY = this.height
            
            if (entity.nextTargetX < 0) entity.nextTargetX = 0
            if (entity.nextTargetY < 0) entity.nextTargetY = 0
            if (entity.nextTargetX > this.width) entity.nextTargetX = this.width
            if (entity.nextTargetY > this.height) entity.nextTargetY = this.height
        }
    }
    
    getNearbyEntities(x, y, radius) {
        const nearby = []
        
        for (const entity of this.entitiesMap.values()) {
            const dx = entity.x - x
            const dy = entity.y - y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance <= radius) {
                nearby.push(entity)
            }
        }
        
        return nearby
    }
}

export default World
