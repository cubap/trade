import Resource from './Resource.js'

class FoodSource extends Resource {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'food'
        this.tags.add('food')
        this.color = '#7CFC00'  // Bright green
        this.size = 8
    }
}

export default FoodSource
