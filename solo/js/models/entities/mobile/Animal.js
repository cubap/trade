import MobileEntity from './MobileEntity.js'

class Animal extends MobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'animal'
        this.color = '#e74c3c'  // Red color for animals
        
        // Animal-specific attributes
        this.species = 'generic'
        this.diet = 'omnivore'  // herbivore, carnivore, omnivore
        this.hunger = 0
        this.lifeStage = 'adult'  // baby, juvenile, adult, elder
        this.predator = false
        this.flockBehavior = false
    }
    
    decideNextMove() {
        if (this.flockBehavior) {
            this.flockingBehavior()
            return
        }
        
        // Basic animal movement
        const angle = Math.random() * Math.PI * 2
        const distance = this.moveRange * 0.7  // Animals move less than pawns
        
        this.nextTargetX = Math.round(this.x + Math.cos(angle) * distance)
        this.nextTargetY = Math.round(this.y + Math.sin(angle) * distance)
    }
    
    flockingBehavior() {
        // To be implemented - flock with similar animals
    }
    
    update(tick) {
        super.update(tick)
        
        // Update animal state
        this.hunger += 0.2  // Animals get hungry faster than pawns
        
        return true
    }
}

export default Animal
