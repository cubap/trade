class Entity {
    constructor(id, name, x, y) {
        this.id = id
        this.name = name
        this.x = Math.round(x)
        this.y = Math.round(y)
        this.size = 10
        this.world = null  // Reference to the world, set when added
        this.type = 'entity'  // Base type
        this.subtype = null   // For more specific categorization
        this.tags = new Set()  // For flexible categorization
        this.color = '#888888'  // Default color
        this.spawned = 0  // Will be set when added to world
        this.age = 0
    }
    
    update(tick) {
        this.age = tick - this.spawned
        // Base update functionality
        return true
    }
    
    render(context, progress) {
        // Base rendering (can be overridden)
    }
    
    distanceTo(entity) {
        if (!entity) return Infinity
        
        const dx = entity.x - this.x
        const dy = entity.y - this.y
        return Math.sqrt(dx * dx + dy * dy)
    }
    
    canInteractWith(entity) {
        // Base interaction check
        return false
    }
}

export default Entity
