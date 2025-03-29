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
        this.entitiesMap.set(entity.name, entity)
    }

    update(timestamp) {
        // Check if we should process a new tick
        if (!this.clock.update(timestamp)) return false
        
        // Process scheduled actions for this tick
        this.actionQueue.processTick(this.clock.currentTick)
        
        // Move all entities for this tick
        for (const entity of this.entitiesMap.values()) {
            entity.move()
            this.keepEntityInBounds(entity)
        }
        
        // Only log occasional ticks to avoid console spam
        if (this.clock.currentTick % 5 === 0) {
            console.log(`Tick: ${this.clock.currentTick}, Entities:`, 
                       Array.from(this.entitiesMap.values()))
        }
        
        return true
    }

    keepEntityInBounds(entity) {
        // Keep current position in bounds
        if (entity.x < 0) entity.x = 0
        if (entity.y < 0) entity.y = 0
        if (entity.x > this.width) entity.x = this.width
        if (entity.y > this.height) entity.y = this.height
        
        // Keep target position in bounds too
        if (entity.targetX < 0) entity.targetX = 0
        if (entity.targetY < 0) entity.targetY = 0
        if (entity.targetX > this.width) entity.targetX = this.width
        if (entity.targetY > this.height) entity.targetY = this.height
    }
}

export default World
