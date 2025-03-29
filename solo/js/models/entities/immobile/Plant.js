import ImmobileEntity from './ImmobileEntity.js'

class Plant extends ImmobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'plant'
        this.color = '#2ecc71'  // Green color for plants
        
        // Plant-specific attributes
        this.growthStage = 'seed'  // seed, sprout, mature, flowering, dying
        this.growthRate = 0.1
        this.growthProgress = 0
        this.resourceValue = 10
        this.seedingChance = 0.01
        this.seedingRange = 100
    }
    
    update(tick) {
        super.update(tick)
        
        // Grow over time
        this.grow()
        
        // Potentially create seeds
        this.trySeeding()
        
        // Check if plant has died of old age
        if (this.growthStage === 'dying' && this.growthProgress >= 100) {
            return false  // Plant dies and should be removed
        }
        
        return true
    }
    
    grow() {
        this.growthProgress += this.growthRate
        
        // Update growth stage based on progress
        if (this.growthProgress < 100) return
        
        switch(this.growthStage) {
            case 'seed':
                this.growthStage = 'sprout'
                this.growthProgress = 0
                this.size = 5
                break
            case 'sprout':
                this.growthStage = 'mature'
                this.growthProgress = 0
                this.size = 8
                break
            case 'mature':
                this.growthStage = 'flowering'
                this.growthProgress = 0
                this.size = 10
                break
            case 'flowering':
                this.growthStage = 'dying'
                this.growthProgress = 0
                this.resourceValue /= 2
                break
        }
    }
    
    trySeeding() {
        if (this.growthStage !== 'flowering') return
        if (Math.random() >= this.seedingChance || !this.world) return
        
        // Create new seed
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * this.seedingRange
        
        const seedX = this.x + Math.cos(angle) * distance
        const seedY = this.y + Math.sin(angle) * distance
        
        // Create a new plant of the same kind
        const newPlant = new Plant(
            `${this.name}Seed${Math.floor(Math.random() * 1000)}`,
            `${this.name} Seedling`,
            seedX,
            seedY
        )
        
        // Add to world
        this.world.addEntity(newPlant)
    }
    
    harvest() {
        // Returns resources and kills the plant
        const resources = this.resourceValue
        this.growthStage = 'dying'
        this.growthProgress = 90  // Nearly dead after harvesting
        return resources
    }
}

export default Plant
