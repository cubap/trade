import ImmobileEntity from './ImmobileEntity.js'

class Structure extends ImmobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'structure'
        this.color = '#9b59b6'  // Purple color for structures
        
        // Structure-specific attributes
        this.condition = 100  // Condition (deteriorates)
        this.maxCondition = 100
        this.deteriorationRate = 0.01
        this.providedBuffs = []
        this.size = 20  // Structures are bigger
    }
    
    update(tick) {
        super.update(tick)
        
        // Deteriorate over time
        this.condition -= this.deteriorationRate
        if (this.condition <= 0) {
            // Structure is destroyed
            return false
        }
        
        return true
    }
    
    repair(amount) {
        this.condition = Math.min(this.maxCondition, this.condition + amount)
    }
    
    applyBuffsToEntity(entity) {
        // Apply this structure's buffs to nearby entity
    }
}

export default Structure
