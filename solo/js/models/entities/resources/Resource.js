import Entity from '../../Entity.js'

class Resource extends Entity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.type = 'resource'
        this.tags = ['resource']  // Use array instead of Set for consistency
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
    
    canConsume() {
        return this.quantity > 0 && !this.depleted
    }
    
    gather(amount) {
        // For basic resources, gathering is same as consuming
        // But returns an item object instead of just amount
        const gathered = this.consume(amount)
        
        if (gathered > 0) {
            return {
                type: this.subtype || 'resource',
                quantity: gathered,
                source: this.name
            }
        }
        
        return null
    }
    
    canGather() {
        return this.canConsume()
    }
}

export default Resource
