import Entity from '../../Entity.js'
import {
    getTerrainMoveContext,
    terrainSpeedFactor,
    impedimentText,
    clampTargetToPassable
} from './MovementTerrain.js'

class MobileEntity extends Entity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.type = 'mobile'
        this.tags = ['mobile']  // Add tags array for mobile entities
        
        // Movement properties
        this.prevX = this.x
        this.prevY = this.y
        this.targetX = this.x
        this.targetY = this.y
        this.speed = 1.5   // ~3.0 m/s (moderate animal pace)
        this.moveRange = 50
        this.moving = false
        this.distanceThreshold = 1
        
        // Reset the nextTarget variables - they should be undefined by default
        this.nextTargetX = undefined
        this.nextTargetY = undefined
    }
    
    move() {
        // Store previous position for rendering interpolation
        this.prevX = this.x
        this.prevY = this.y
        
        // Check if already moving toward a target
        if (this.moving && this.targetX !== undefined && this.targetY !== undefined) {
            const dx = this.targetX - this.x
            const dy = this.targetY - this.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            // If we haven't reached the target yet
            if (distance > this.distanceThreshold) {
                // Terrain-aware movement cost (#84)
                const terrain = terrainSpeedFactor(getTerrainMoveContext(this.world, this.x, this.y))
                if (terrain.factor <= 0) {
                    this._noteMovementImpediment(terrain.reason)
                    return this.moving
                }
                if (terrain.factor < 1) this._noteMovementImpediment(terrain.reason)

                // Move by at most (speed * factor) units toward target
                const moveDistance = Math.min(distance, this.speed * terrain.factor)
                
                // Avoid division by zero
                if (distance > 0) {
                    const ratio = moveDistance / distance
                    this.x += dx * ratio
                    this.y += dy * ratio
                }
                
                // Ensure we stay within world bounds if world exists
                if (this.world) {
                    this.x = Math.max(0, Math.min(this.world.width, this.x))
                    this.y = Math.max(0, Math.min(this.world.height, this.y))
                }
                
                return true
            }
            
            // We've reached the target
            this.x = this.targetX
            this.y = this.targetY
            this.moving = false
        }
        
        // If not moving anymore, process the next target or decide on a new move
        if (!this.moving) {
            // Use next target if available
            if (this.nextTargetX !== undefined && this.nextTargetY !== undefined) {
                // Validate and limit target distance
                this.setValidatedTarget(this.nextTargetX, this.nextTargetY)
                this.nextTargetX = undefined
                this.nextTargetY = undefined
            } else {
                // No next target, so decide on a new move
                this.decideNextMove()
                
                // If decideNextMove set a next target, use it
                if (this.nextTargetX !== undefined && this.nextTargetY !== undefined) {
                    this.setValidatedTarget(this.nextTargetX, this.nextTargetY)
                    this.nextTargetX = undefined
                    this.nextTargetY = undefined
                }
            }
        }
        
        return this.moving
    }
    
    // Helper to validate and set targets with proper distance limits
    setValidatedTarget(x, y) {
        const dx = x - this.x
        const dy = y - this.y
        let distance = Math.sqrt(dx * dx + dy * dy)

        // If the target is too far away, limit it to the move range
        if (distance > this.moveRange) {
            const ratio = this.moveRange / distance
            x = this.x + dx * ratio
            y = this.y + dy * ratio
            distance = this.moveRange
        }

        // Ensure targets are within world bounds
        if (this.world) {
            x = Math.max(0, Math.min(this.world.width, x))
            y = Math.max(0, Math.min(this.world.height, y))
        }

        // Never plan a move that ends in impassable terrain (#84)
        const safe = clampTargetToPassable(this.world, this.x, this.y, x, y)
        if (safe.clamped) {
            this._noteMovementImpediment('blocked_path')
            x = safe.x
            y = safe.y
        }

        this.targetX = x
        this.targetY = y
        this.moving = true
    }

    /**
     * Record terrain impediment for UI feedback (#84). Notifies the pawn's
     * thought stream when the reason changes or after a cooldown.
     */
    _noteMovementImpediment(reason) {
        if (!reason) return
        const tick = this.world?.tick ?? this.age ?? 0
        const prev = this._movementImpediment
        this._movementImpediment = { reason, tick, notifiedAt: prev?.notifiedAt ?? -Infinity }
        if (prev?.reason !== reason || tick - this._movementImpediment.notifiedAt > 240) {
            this._movementImpediment.notifiedAt = tick
            const text = impedimentText(reason)
            if (text) this.addThought?.(text, 'movement')
        }
    }
    
    update(tick) {
        super.update(tick)
        
        // For animals with behavior system, update drives and calculate behavior
        if (this.drives) {
            this.updateDrives(tick)
            this.evaluatePriorities()
            this.executeBehavior()
        }
        
        // Execute movement - this now handles the actual position updates
        this.move()
        
        return true
    }
    
    decideNextMove() {
        // To be implemented by specific mobile entity types
    }
}

export default MobileEntity
