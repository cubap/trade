import ImmobileEntity from './ImmobileEntity.js'

class Plant extends ImmobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'plant'
        this.color = '#2ecc71'  // Green color for plants
        this.tags.add('plant')

        // Plant-specific attributes
        this.growthStage = 'seed'  // seed, sprout, mature, flowering, dying
        this.growthRate = 0.1
        this.growthProgress = 0
        this.resourceValue = 10
        this.seedingChance = 0.01
        this.seedingRange = 100
        this.seasonalModifier = 1  // Modifier based on current season

        // Domestication/farming
        this.domesticated = false
        this.farmType = null // orchard, patch, field, garden

        // Persistent drops
        this.hasPersistentDrops = false
        this.persistentDrops = [] // e.g. fruit, branches

        // Poisonous traits
        this.poisonous = false
        this.poisonType = null // 'consumption', 'contact', etc.
    }

    update(tick, currentSeason) {
        super.update(tick)

        // Adjust growth rate based on season (do not permanently mutate base rate)
        this.seasonalModifier = this.getSeasonalModifier(currentSeason)
        const effectiveGrowthRate = this.growthRate * this.seasonalModifier

        // Grow over time (no-op for subclasses that override or ignore)
        this.grow?.(effectiveGrowthRate)

        // Potentially create seeds
        this.trySeeding?.()

        // Check if plant has died of old age (basic lifecycle path)
        if (this.growthStage === 'dying' && this.growthProgress >= 100) {
            return false  // Plant dies and should be removed
        }

        return true
    }

    // Default growth progression for generic plants; subclasses can override.
    grow(rate = this.growthRate) {
        // Basic staged growth using growthProgress [0..100)
        this.growthProgress += rate
        if (this.growthProgress < 100) return

        // Advance lifecycle stage and reset progress
        if (this.growthStage === 'seed') {
            this.growthStage = 'sprout'
            this.growthProgress = 0
            return
        }
        if (this.growthStage === 'sprout') {
            this.growthStage = 'mature'
            this.growthProgress = 0
            return
        }
        if (this.growthStage === 'mature') {
            this.growthStage = 'flowering'
            this.growthProgress = 0
            return
        }
        if (this.growthStage === 'flowering') {
            this.growthStage = 'dying'
            this.growthProgress = 0
        }
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

    setDomesticated(type) {
        this.domesticated = true
        this.farmType = type
    }

    setPersistentDrops(drops) {
        this.hasPersistentDrops = true
        this.persistentDrops = drops
    }

    setPoisonous(type = 'consumption') {
        this.poisonous = true
        this.poisonType = type
    }

    collectDrop(dropType) {
        if (!this.hasPersistentDrops) return null
        const drop = this.persistentDrops.find(d => d.type === dropType)
        if (drop && drop.amount > 0) {
            drop.amount--
            return { ...drop, amount: 1 }
        }
        return null
    }

    harvest() {
        // Returns resources and kills the plant
        const resources = this.resourceValue
        if (this.hasPersistentDrops && this.persistentDrops.length > 0) {
            // Collect all remaining persistent drops
            const drops = this.persistentDrops.filter(d => d.amount > 0)
            drops.forEach(d => d.amount = 0)
            return { resources, drops }
        }
        this.growthStage = 'dying'
        this.growthProgress = 90  // Nearly dead after harvesting
        return resources
    }
}

export default Plant
