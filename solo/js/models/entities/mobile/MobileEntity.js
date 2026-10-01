import Entity from '../../Entity.js'
import {
    getTerrainMoveContext,
    terrainSpeedFactor,
    impedimentText,
    clampTargetToPassable
} from './MovementTerrain.js'
import { trailFieldFor, TRAIL_FOOTFALL } from '../../../core/TrailField.js'

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

        // Pathways (#77): how much wear this entity leaves, and how strongly it
        // prefers worn ground. Default is "leaves tracks, ignores them" -
        // Pawns raise affinity with their trail skills, animals by species.
        this.trailWeight = 1
        this.trailAffinity = 0
    }

    /**
     * World tick for trail bookkeeping. Falls back to the entity's own age so a
     * world without a clock (unit tests, offline sims) still accumulates.
     */
    _trailTick() {
        return this.world?.tick ?? this.world?.clock?.currentTick ?? this.age ?? 0
    }

    /**
     * Wear left by the step just taken, spread over the cells actually crossed
     * so a fast entity cannot punch a dotted line through the ground.
     */
    _depositFootfall(fromX, fromY) {
        const world = this.world
        if (!world) return
        const dx = this.x - fromX
        const dy = this.y - fromY
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (!(distance > 0)) return
        // A step longer than anything walking can produce is a teleport or a
        // respawn; drawing a line across the map for it would fake a road.
        if (distance > Math.max(16, this.moveRange || 16)) return
        const field = trailFieldFor(world)
        if (!field) return
        const cellSize = field.cellSize
        const steps = Math.max(1, Math.ceil(distance / cellSize))
        const perStep = (TRAIL_FOOTFALL * this.trailWeight * distance) / steps
        const tick = this._trailTick()
        for (let i = 1; i <= steps; i++) {
            const t = i / steps
            field.deposit(fromX + dx * t, fromY + dy * t, perStep, tick, this.trailKind)
        }
    }

    /**
     * Drift a heading toward existing trails (#77). Returns the direction to
     * actually step, plus what the detour bought (`gain`) for skill feedback.
     * Entities with no trail affinity, and worlds with no wear yet, step exactly
     * as they did before.
     */
    _steerAlongTrails(dirX, dirY) {
        if (!(this.trailAffinity > 0)) return { dirX, dirY, gain: 0 }
        const field = trailFieldFor(this.world, { create: false })
        if (!field) return { dirX, dirY, gain: 0 }
        const bias = field.followBias(this.x, this.y, dirX, dirY, {
            affinity: this.trailAffinity,
            tick: this._trailTick()
        })
        if (!bias.turn) return { dirX, dirY, gain: 0 }
        this.onTrailFollowed?.(bias)
        return bias
    }
    
    move() {
        // Store previous position for rendering interpolation
        this.prevX = this.x
        this.prevY = this.y
        const stepFromX = this.x
        const stepFromY = this.y
        
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
                    // Pathways (#77): walk the worn ground when the entity knows
                    // how to read it. Purely a heading nudge - the destination
                    // is untouched, so goals still complete, just along trails.
                    // Skipped for the last step or two, which must land on the
                    // target rather than curve around it.
                    const roomToCurve = distance > moveDistance * 2
                    const steer = roomToCurve
                        ? this._steerAlongTrails(dx / distance, dy / distance)
                        : { dirX: dx / distance, dirY: dy / distance }
                    this.x += steer.dirX * moveDistance
                    this.y += steer.dirY * moveDistance
                }

                this._depositFootfall(stepFromX, stepFromY)
                
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
            this._depositFootfall(stepFromX, stepFromY)
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
