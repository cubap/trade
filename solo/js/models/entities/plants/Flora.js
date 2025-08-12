// Flora.js
// Base classes for Tree, Bush, and Grass entities
// Designed for extensibility and emergent ecological simulation

import Plant from '../immobile/Plant.js'

export class Tree extends Plant {
    constructor(props = {}) {
        super(props.id, props.name, props.x, props.y)
        this.type = 'tree'
        this.variety = props.variety || 'generic'
        this.stage = props.stage || 'seedling' // seedling, sapling, adult
        this.age = props.age || 0
        this.size = props.size || 1
        this.lastGrowth = props.lastGrowth || 0
        this.isAlive = true
        this.sticks = props.sticks || 0
        this.logs = props.logs || 0
    }

    update(tick) {
        super.update?.(tick)
        if (!this.isAlive) return true
        this.age++
        this.tryGrowth()
        if (this.stage === 'adult') {
            this.dropSticks()
            this.tryReproduce()
            this.checkForDeath()
        }
        return true
    }
    // Override Plant.grow: use stage-based growth instead
    grow() {}

    // Prevent base Plant default growth from interfering; trees use tryGrowth
    grow() { /* no-op; trees handle growth with stages */ }

    tryGrowth() {
        // Growth logic based on stage and crowding
        if (this.stage === 'seedling') {
            if (this.canGrowToSapling()) {
                this.stage = 'sapling'
                this.age = 0
            } else if (this.isCrowded() || this.isTooOld()) {
                this.die()
            }
        } else if (this.stage === 'sapling') {
            if (this.nearbyAdultTree()) {
                // Remain sapling
            } else if (this.canGrowToAdult()) {
                this.stage = 'adult'
                this.age = 0
            } else if (this.isCrowded() || this.isTooOld()) {
                this.die()
            }
        }
    }

    canGrowToSapling() {
        // No more than 3 seedlings per meter, no adult tree in same meter
        return !this.isCrowded() && !this.nearbyAdultTree() && this.age > 8
    }

    canGrowToAdult() {
        // No adult tree within 3m, only 1 sapling per meter
        return !this.isCrowded() && !this.nearbyAdultTree(3) && this.age > 16
    }

    isCrowded() {
        // Count same-type entities in the same meter (1x1 area)
        const neighbors = this.world?.queryEntitiesInRadius?.(this.x, this.y, 0.5) ?? []
        if (this.stage === 'seedling') {
            // No more than 3 seedlings per meter
            const seedlings = neighbors.filter(e => e.type === 'tree' && e.stage === 'seedling')
            return seedlings.length > 3
        }
        if (this.stage === 'sapling') {
            // Only 1 sapling per meter, not in same meter as adult tree
            const saplings = neighbors.filter(e => e.type === 'tree' && e.stage === 'sapling')
            const adults = neighbors.filter(e => e.type === 'tree' && e.stage === 'adult')
            return saplings.length > 1 || adults.length > 0
        }
        if (this.stage === 'adult') {
            // No other adult tree in same meter
            const adults = neighbors.filter(e => e.type === 'tree' && e.stage === 'adult')
            return adults.length > 1
        }
        return false
    }

    nearbyAdultTree(radius = 3) {
        // Returns true if any adult tree is within radius (meters)
        const neighbors = this.world?.queryEntitiesInRadius?.(this.x, this.y, radius) ?? []
        return neighbors.some(e => e.type === 'tree' && e.stage === 'adult' && e !== this)
    }

    isTooOld() {
        // Placeholder: trees die after 1000 turns
        return this.age > 1000
    }

    die() {
        this.isAlive = false
        this.logs++
        // Drop logs/sticks in world
    }

    dropSticks() {
        // Drop sticks regularly
        if (Math.random() < 0.05) this.sticks++
    }

    tryReproduce() {
        // Species-specific logic (to be overridden)
    }

    checkForDeath() {
        if (this.isTooOld()) this.die()
    }
}

export class Bush extends Plant {
    constructor(props = {}) {
        super(props.id, props.name, props.x, props.y)
        this.type = 'bush'
        this.stage = props.stage || 'sprout' // sprout, growing, mature
        this.age = props.age || 0
        this.berries = props.berries || 0
        this.isAlive = true
    }

    update(tick) {
        super.update?.(tick)
        if (!this.isAlive) return true
        this.age++
        this.tryGrowth()
        this.tryReproduce()
        this.checkForDeath()
        return true
    }
    // Override Plant.grow: use stage-based growth instead
    grow() {}

    // Prevent base Plant default growth from interfering; bushes use tryGrowth
    grow() { /* no-op; bushes handle growth with stages */ }

    tryGrowth() {
        // Growth logic for bush stages
        if (this.stage === 'sprout') {
            if (this.canGrowToGrowing()) {
                this.stage = 'growing'
                this.age = 0
            } else if (this.isTooOld()) {
                this.die()
            }
        } else if (this.stage === 'growing') {
            if (this.age > 30) {
                this.stage = 'mature'
                this.age = 0
            }
        }
    }

    canGrowToGrowing() {
        // If bush count < 3 in area, can grow
        const neighbors = this.world?.queryEntitiesInRadius?.(this.x, this.y, 1) ?? []
        const bushes = neighbors.filter(e => e.type === 'bush')
        return bushes.length < 3
    }

    isTooOld() {
        // Sprout idles for a month (30 turns)
        return this.stage === 'sprout' && this.age > 30
    }

    die() { this.isAlive = false }

    tryReproduce() {
        // Berry production and seed drop logic
    }

    checkForDeath() {
        // Bushes die after 3 years (placeholder: 1000 turns)
        if (this.stage === 'mature' && this.age > 1000) this.die()
    }
}

export class Grass extends Plant {
    constructor(props = {}) {
        super(props.id, props.name, props.x, props.y)
        this.type = 'grass'
        this.population = props.population || 10 // per meter
    }

    update(tick) {
        super.update?.(tick)
        this.grow()
        this.handleTrampling()
        return true
    }

    grow() {
        // 2% chance to grow each hour, spread if >40/m
        if (Math.random() < 0.02) this.population = Math.min(100, this.population + 1)
        if (this.population > 40 && Math.random() < 0.2) {
            // Spread to neighbor: find a nearby meter with less grass
        const neighbors = this.world?.queryEntitiesInRadius?.(this.x, this.y, 1) ?? []
            const grassPatches = neighbors.filter(e => e.type === 'grass')
            // Find a patch with less than 40/m
            const sparse = grassPatches.find(g => g.population < 40)
            if (sparse) sparse.population += Math.floor(this.population / 5)
        }
        // Cap population
        if (this.population > 100) this.population = 100
    }

    handleTrampling() {
        // Reduce population for trampling (not implemented)
    }
}
