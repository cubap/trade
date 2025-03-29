import Entity from './Entity.js'

// =========== MOBILE ENTITIES ===========
class MobileEntity extends Entity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.type = 'mobile'
        
        // Movement properties
        this.prevX = this.x
        this.prevY = this.y
        this.targetX = this.x
        this.targetY = this.y
        this.nextTargetX = this.x
        this.nextTargetY = this.y
        this.speed = 20
        this.moveRange = 50
        this.moving = false
        this.distanceThreshold = 1
        this.tickPredictionFactor = 1.2
    }
    
    move() {
        // Current position becomes the previous position
        this.prevX = this.x
        this.prevY = this.y
        
        // Current target becomes current position
        this.x = this.targetX
        this.y = this.targetY
        
        // Calculate distance to next target
        const distanceToNext = this.distanceTo({x: this.nextTargetX, y: this.nextTargetY})
        
        // Predict if we'll reach the target within the next tick
        const willReachTarget = distanceToNext <= this.speed * this.tickPredictionFactor
        
        if (willReachTarget) {
            // We'll reach the target soon, set current target and calculate new next target
            this.targetX = this.nextTargetX
            this.targetY = this.nextTargetY
            this.decideNextMove()
        } else {
            // Continue moving toward next target
            const moveRatio = Math.min(this.speed / distanceToNext, 1)
            const dx = this.nextTargetX - this.x
            const dy = this.nextTargetY - this.y
            
            this.targetX = Math.round(this.x + dx * moveRatio)
            this.targetY = Math.round(this.y + dy * moveRatio)
        }
        
        this.moving = true
    }
    
    decideNextMove() {
        // To be implemented by specific mobile entity types
        this.nextTargetX = this.x
        this.nextTargetY = this.y
    }
    
    update(tick) {
        super.update(tick)
        this.move()
        return true
    }
}

// ---------- Pawn ----------
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

// ---------- Animal ----------
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

// =========== IMMOBILE ENTITIES ===========
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

// ---------- Structure ----------
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

// ---------- Plant ----------
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
        if (this.growthProgress >= 100) {
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
    }
    
    trySeeding() {
        if (this.growthStage !== 'flowering') return
        
        // Random chance to create a new seed
        if (Math.random() < this.seedingChance && this.world) {
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
    }
    
    harvest() {
        // Returns resources and kills the plant
        const resources = this.resourceValue
        this.growthStage = 'dying'
        this.growthProgress = 90  // Nearly dead after harvesting
        return resources
    }
}

export { 
    MobileEntity, 
    Pawn, 
    Animal, 
    ImmobileEntity, 
    Structure, 
    Plant 
}
