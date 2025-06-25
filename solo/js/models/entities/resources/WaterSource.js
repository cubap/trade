import Resource from './Resource.js'

class WaterSource extends Resource {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'water'
        this.tags.push('water')  // Add to existing array
        this.color = '#1E90FF'  // Blue
        this.size = 12
        this.quantity = 200     // More water available
        this.maxQuantity = 200
        this.replenishRate = 0.5  // Replenishes faster
    }
}

export default WaterSource
