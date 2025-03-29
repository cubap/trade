import Entity from '../../Entity.js'

class MobileEntity extends Entity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.type = 'mobile'
        
        // Movement properties
        this.prevX = this.x
        this.prevY = this.y
        this.targetX = this.x
        this.targetY = this.y
        this.speed = 20
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
                // Move by at most speed units toward target
                const moveDistance = Math.min(distance, this.speed)
                
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
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // If the target is too far away, limit it to the move range
        if (distance > this.moveRange) {
            const ratio = this.moveRange / distance
            this.targetX = this.x + dx * ratio
            this.targetY = this.y + dy * ratio
        } else {
            this.targetX = x
            this.targetY = y
        }
        
        // Ensure targets are within world bounds
        if (this.world) {
            this.targetX = Math.max(0, Math.min(this.world.width, this.targetX))
            this.targetY = Math.max(0, Math.min(this.world.height, this.targetY))
        }
        
        this.moving = true
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
