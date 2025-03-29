import MobileEntity from './MobileEntity.js'

class Pawn extends MobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'pawn'
        this.color = '#3498db'  // Blue color for pawns
        
        // Pawn-specific attributes
        this.inventory = []
        this.skills = {}
        this.needs = {
            hunger: 0,
            energy: 100,
            social: 50
        }
        
        // Decision making
        this.goal = null
        this.memory = []
    }
    
    decideNextMove() {
        // Simple random movement for now
        const angle = Math.random() * Math.PI * 2
        const distance = this.moveRange * (0.5 + Math.random() * 0.5)
        
        this.nextTargetX = Math.round(this.x + Math.cos(angle) * distance)
        this.nextTargetY = Math.round(this.y + Math.sin(angle) * distance)
    }
    
    update(tick) {
        super.update(tick)
        
        // Update needs based on time
        this.needs.hunger += 0.1
        this.needs.energy -= 0.05
        
        // Potentially change goal based on needs
        this.evaluateGoals()
        
        return true
    }
    
    evaluateGoals() {
        // TBD: Goal setting logic based on needs
    }
}

export default Pawn
