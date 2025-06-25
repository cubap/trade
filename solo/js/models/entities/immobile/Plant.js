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
        this.seasonalModifier = 1  // Modifier based on current season
    }

    update(tick, currentSeason) {
        super.update(tick)

        // Adjust growth rate based on season
        this.seasonalModifier = this.getSeasonalModifier(currentSeason)
        this.growthRate *= this.seasonalModifier

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

    getSeasonalModifier(season) {
        const modifiers = {
            spring: 1.2,
            summer: 1,
            autumn: 0.8,
            winter: 0.5
        }
        return modifiers[season] ?? 1
    }

    sow() {
        this.growthStage = 'seed'
        this.growthProgress = 0
        this.growthRate = 0.2  // Faster growth when sowed
    }

    irrigate() {
        this.growthRate += 0.05  // Boost growth rate
    }

    tend() {
        this.resourceValue += 5  // Increase resource value
    }

    trySeeding() {
        if (this.growthStage !== 'flowering') return
        if (Math.random() >= this.seedingChance * this.seasonalModifier || !this.world) return

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
