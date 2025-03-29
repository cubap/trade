class Entity {
    constructor(name, x, y, speed) {
        this.name = name
        this.x = Math.round(x)
        this.y = Math.round(y)
        this.prevX = this.x
        this.prevY = this.y
        this.targetX = this.x
        this.targetY = this.y
        this.nextTargetX = this.x  // Add next target for continuous motion
        this.nextTargetY = this.y
        this.speed = speed
        this.moving = false
    }

    move() {
        // Current position becomes the previous position
        this.prevX = this.x
        this.prevY = this.y
        
        // Current target becomes current position
        this.x = this.targetX
        this.y = this.targetY
        
        // Next target becomes current target
        this.targetX = this.nextTargetX
        this.targetY = this.nextTargetY
        
        // Calculate next target position
        this.nextTargetX = Math.round(this.targetX + (Math.random() - 0.5) * this.speed)
        this.nextTargetY = Math.round(this.targetY + (Math.random() - 0.5) * this.speed)
        
        this.moving = true
    }
}

export default Entity
