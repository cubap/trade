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
        this.nextTargetX = this.x
        this.nextTargetY = this.y
        this.speed = 20
        this.moveRange = 50
        this.moving = false
        this.distanceThreshold = 1
        this.tickPredictionFactor = 1.2
    }
    
    move() {
        // Current position becomes the previous position
        this.prevX = this.x
        this.prevY = this.y
        
        // Current target becomes current position
        this.x = this.targetX
        this.y = this.targetY
        
        // Calculate distance to next target
        const distanceToNext = this.distanceTo({x: this.nextTargetX, y: this.nextTargetY})
        
        // Predict if we'll reach the target within the next tick
        const willReachTarget = distanceToNext <= this.speed * this.tickPredictionFactor
        
        if (willReachTarget) {
            // We'll reach the target soon, set current target and calculate new next target
            this.targetX = this.nextTargetX
            this.targetY = this.nextTargetY
            this.decideNextMove()
        } else {
            // Continue moving toward next target
            const moveRatio = Math.min(this.speed / distanceToNext, 1)
            const dx = this.nextTargetX - this.x
            const dy = this.nextTargetY - this.y
            
            this.targetX = Math.round(this.x + dx * moveRatio)
            this.targetY = Math.round(this.y + dy * moveRatio)
        }
        
        this.moving = true
    }
    
    decideNextMove() {
        // To be implemented by specific mobile entity types
        this.nextTargetX = this.x
        this.nextTargetY = this.y
    }
    
    update(tick) {
        super.update(tick)
        this.move()
        return true
    }
}

export default MobileEntity
