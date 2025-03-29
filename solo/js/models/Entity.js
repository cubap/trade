class Entity {
    constructor(name, x, y, speed) {
        this.name = name
        this.x = Math.round(x)
        this.y = Math.round(y)
        this.prevX = this.x
        this.prevY = this.y
        this.targetX = this.x
        this.targetY = this.y
        this.nextTargetX = this.x  
        this.nextTargetY = this.y
        this.speed = speed
        this.moving = false
        this.distanceThreshold = 1  // Distance threshold to consider a target reached
        this.moveRange = 50  // Longer distance movements
        this.tickPredictionFactor = 1.2  // Predict slightly ahead to prevent pauses
    }

    move() {
        // Current position becomes the previous position
        this.prevX = this.x
        this.prevY = this.y
        
        // Current target becomes current position
        this.x = this.targetX
        this.y = this.targetY
        
        // Calculate distance to next target
        const distanceToNext = this.distanceTo(this.x, this.y, this.nextTargetX, this.nextTargetY)
        
        // Predict if we'll reach the target within the next tick
        const willReachTarget = distanceToNext <= this.speed * this.tickPredictionFactor
        
        if (willReachTarget) {
            // We'll reach the target soon, so set current target and calculate new next target
            this.targetX = this.nextTargetX
            this.targetY = this.nextTargetY
            this.calculateNewTarget()
        } else {
            // Continue moving toward next target
            // Calculate a position along the path to the next target
            const moveRatio = Math.min(this.speed / distanceToNext, 1)
            const dx = this.nextTargetX - this.x
            const dy = this.nextTargetY - this.y
            
            this.targetX = Math.round(this.x + dx * moveRatio)
            this.targetY = Math.round(this.y + dy * moveRatio)
        }
        
        this.moving = true
    }
    
    calculateNewTarget() {
        // Calculate a new target with a longer distance
        const angle = Math.random() * Math.PI * 2  // Random direction
        const distance = this.moveRange * (0.5 + Math.random() * 0.5)  // 50-100% of moveRange
        
        this.nextTargetX = Math.round(this.x + Math.cos(angle) * distance)
        this.nextTargetY = Math.round(this.y + Math.sin(angle) * distance)
    }
    
    distanceTo(x1, y1, x2, y2) {
        const dx = x2 - x1
        const dy = y2 - y1
        return Math.sqrt(dx * dx + dy * dy)
    }
}

export default Entity
