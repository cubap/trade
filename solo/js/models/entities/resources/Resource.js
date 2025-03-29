import Entity from '../../Entity.js'

class Resource extends Entity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.type = 'resource'
        this.tags = new Set(['resource'])
        this.quantity = 100
        this.replenishRate = 0.1
        this.maxQuantity = 100
        this.depleted = false
        this.lastReplenished = 0
    }
    
    update(tick) {
        super.update(tick)
        
        // Replenish over time
        if (this.quantity < this.maxQuantity && tick - this.lastReplenished > 10) {
            this.quantity = Math.min(this.maxQuantity, this.quantity + this.replenishRate)
            this.lastReplenished = tick
            
            // No longer depleted if we've replenished
            if (this.depleted && this.quantity > this.maxQuantity * 0.1) {
                this.depleted = false
            }
        }
        
        return true
    }
    
    consume(amount) {
        const available = Math.min(amount, this.quantity)
        this.quantity -= available
        
        // Mark as depleted if too low
        if (this.quantity < this.maxQuantity * 0.1) {
            this.depleted = true
        }
        
        return available
    }
}

export default Resource
