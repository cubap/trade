import Entity from '../../Entity.js'

class ImmobileEntity extends Entity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.type = 'immobile'
        this.health = 100
    }
    
    update(tick) {
        super.update(tick)
        // Immobile entities don't move but may have other behaviors
        return true
    }
}

export default ImmobileEntity
