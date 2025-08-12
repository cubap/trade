// SmallPredator.js
// A small predator animal (e.g. fox) with daily schedule and instinct logic

import Animal from './Animal.js'

class SmallPredator extends Animal {
    constructor(props = {}) {
        super(props.id, props.name || 'Predator', props.x ?? 0, props.y ?? 0)
        this.type = 'animal'
        this.subtype = 'predator'
        this.species = props.species || 'fox'
        this.memory = []
        this.lastShelter = null
        this.lastSleep = 0
        this.lastReproduce = 0
        this.injury = 0
        this.fatigue = 0
        this.hunger = 0
        this.fear = 0
        this.territoryRadius = 40
        this.dailyQueue = [
            { hour: 6, action: 'hunt' },
            { hour: 7, action: 'idle' },
            { hour: 9, action: 'territory' },
            { hour: 14, action: 'hunt' },
            { hour: 15, action: 'idle' },
            { hour: 17, action: 'shelter' },
            { hour: 19, action: 'sleep' }
        ]
        this.instincts = [
            { priority: 90, trigger: this.isPredatorNearby, action: this.maintainDistance },
            { priority: 40, trigger: this.isInjuredOrScared, action: this.hideHeal },
            { priority: 50, trigger: this.isHungry, action: this.eat },
            { priority: 30, trigger: this.readyToReproduce, action: this.reproduce },
            { priority: 20, trigger: this.isRivalNearby, action: this.fight }
        ]
        this.huntState = 'track' // track, chase, sneak, charge, pounce
        this.huntTarget = null
        this.scentAge = 0
    }

    update(tick, world = this.world) {
        for (const instinct of this.instincts.sort((a, b) => b.priority - a.priority)) {
            if (instinct.trigger.call(this, world)) {
                instinct.action.call(this, world)
                return
            }
        }
        const hour24 = world?.clock?.getHour24?.() ?? Math.floor((world.clock.currentTick * 48) / 2880) % 24
        const scheduled = this.dailyQueue.find(q => q.hour === hour24)
        if (scheduled && typeof this[scheduled.action] === 'function') {
            this[scheduled.action](world)
        }
    }

    // Instinct triggers
    isPredatorNearby(world) {
        const predators = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'animal' && e.subtype === 'predator' && e !== this) ?? []
        return predators.length > 0
    }
    isInjuredOrScared() { return this.injury > 10 || this.fear > 10 }
    isHungry() { return this.hunger > 20 }
    readyToReproduce() { return this.fatigue < 10 && this.hunger < 10 && this.injury < 5 && this.lastReproduce < Date.now() - 1000000 }
    isRivalNearby(world) {
        // Rival is another predator of same species within 5m
        const rivals = world.queryEntitiesInRadius?.(this.x, this.y, 5)?.filter(e => e.species === this.species && e !== this) ?? []
        return rivals.length > 0
    }

    // Instinct actions
    maintainDistance(world) {
        // Move away from larger predator (not self or same species)
        const predators = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'animal' && e.subtype === 'predator' && e.species !== this.species) ?? []
        if (predators.length === 0) return
        const predator = predators.reduce((a, b) => this.distanceTo(a) < this.distanceTo(b) ? a : b)
        const angle = Math.atan2(this.y - predator.y, this.x - predator.x)
        const dist = 10 + Math.random() * 10
        this.targetX = Math.round(this.x + Math.cos(angle) * dist)
        this.targetY = Math.round(this.y + Math.sin(angle) * dist)
        this.fear += 10
    }

    hideHeal(world) {
        // Find cover and rest
        const covers = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'tree' || e.type === 'bush') ?? []
        if (covers.length === 0) return
        const cover = covers[Math.floor(Math.random() * covers.length)]
        this.targetX = cover.x
        this.targetY = cover.y
        this.fatigue = Math.max(0, this.fatigue - 5)
        this.injury = Math.max(0, this.injury - 2)
        this.fear = Math.max(0, this.fear - 5)
    }

    eat(world) {
        // Find and consume food/prey within 10m (prefer prey, fallback to food)
        const prey = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'animal' && e.subtype === 'forager') ?? []
        const foods = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.tags?.has('food')) ?? []
        if (prey.length > 0) {
            const target = prey.reduce((a, b) => this.distanceTo(a) < this.distanceTo(b) ? a : b)
            this.targetX = target.x
            this.targetY = target.y
            if (this.distanceTo(target) < 2) {
                this.hunger = Math.max(0, this.hunger - 30)
                this.fatigue += 5
                // Remove prey from world (simulate predation)
                world.entitiesMap.delete(target.id)
            }
        } else if (foods.length > 0) {
            const food = foods.reduce((a, b) => this.distanceTo(a) < this.distanceTo(b) ? a : b)
            this.targetX = food.x
            this.targetY = food.y
            if (this.distanceTo(food) < 2) {
                this.hunger = Math.max(0, this.hunger - 15)
                this.fatigue += 2
            }
        }
    }

    reproduce(world) {
        // Find mate in cover, must not be hungry or injured
        const mates = world.queryEntitiesInRadius?.(this.x, this.y, 5)?.filter(e => e.species === this.species && e !== this) ?? []
        const covers = world.queryEntitiesInRadius?.(this.x, this.y, 5)?.filter(e => e.type === 'tree' || e.type === 'bush') ?? []
        if (mates.length === 0 || covers.length === 0) return
        const mate = mates[0]
        const cover = covers[0]
        this.targetX = cover.x
        this.targetY = cover.y
        if (this.distanceTo(mate) < 2 && this.distanceTo(cover) < 2) {
            if (Math.random() < 0.15) {
                world.addEntity(new SmallPredator({
                    x: cover.x + Math.random() * 2 - 1,
                    y: cover.y + Math.random() * 2 - 1,
                    species: this.species
                }))
                this.lastReproduce = Date.now()
            }
        }
    }

    fight(world) {
        // Challenge rival for territory
        const rivals = world.queryEntitiesInRadius?.(this.x, this.y, 5)?.filter(e => e.species === this.species && e !== this) ?? []
        if (rivals.length === 0) return
        const rival = rivals[0]
        // Simple fight: higher fatigue/injury loses
        if ((this.fatigue + this.injury) < (rival.fatigue + rival.injury)) {
            // Win: rival flees
            rival.fear += 20
            rival.fatigue += 10
            rival.targetX = rival.x + Math.round(Math.random() * 10 - 5)
            rival.targetY = rival.y + Math.round(Math.random() * 10 - 5)
        } else {
            // Lose: self flees
            this.fear += 20
            this.fatigue += 10
            this.targetX = this.x + Math.round(Math.random() * 10 - 5)
            this.targetY = this.y + Math.round(Math.random() * 10 - 5)
        }
    }

    // Daily actions
    hunt(world) {
        // Multi-stage: track, chase, sneak, charge, pounce
        if (!this.huntTarget || this.huntState === 'track') {
            this.track(world)
        } else if (this.huntState === 'chase') {
            this.chase(world)
        } else if (this.huntState === 'sneak') {
            this.sneak(world)
        } else if (this.huntState === 'charge') {
            this.charge(world)
        } else if (this.huntState === 'pounce') {
            this.pounce(world)
        }
    }

    track(world) {
        // Spiral search for prey scent (forager within 20m, recent)
        const prey = world.queryEntitiesInRadius?.(this.x, this.y, 20)?.filter(e => e.type === 'animal' && e.subtype === 'forager') ?? []
        if (prey.length > 0) {
            this.huntTarget = prey.reduce((a, b) => this.distanceTo(a) < this.distanceTo(b) ? a : b)
            this.scentAge = 0
            this.huntState = 'chase'
        } else {
            // Spiral search
            const angle = Math.random() * Math.PI * 2
            const dist = 10 + Math.random() * 10
            this.targetX = Math.round(this.x + Math.cos(angle) * dist)
            this.targetY = Math.round(this.y + Math.sin(angle) * dist)
            this.scentAge++
        }
    }

    chase(world) {
        // Follow trail, divert if prey detected
        if (!this.huntTarget) {
            this.huntState = 'track'
            return
        }
        this.targetX = this.huntTarget.x
        this.targetY = this.huntTarget.y
        const dist = this.distanceTo(this.huntTarget)
        if (dist < 15) {
            if (this.huntTarget.fatigue > 20) {
                this.huntState = 'charge'
            } else if (this.huntTarget.fatigue < 10) {
                this.huntState = 'sneak'
            }
        }
        if (dist < 3) {
            this.huntState = 'pounce'
        }
        this.scentAge++
        if (this.scentAge > 10) {
            this.huntState = 'track'
            this.huntTarget = null
        }
    }

    charge(world) {
        // Fast attack
        if (!this.huntTarget) {
            this.huntState = 'track'
            return
        }
        const angle = Math.atan2(this.huntTarget.y - this.y, this.huntTarget.x - this.x)
        const dist = Math.min(20, this.distanceTo(this.huntTarget))
        this.targetX = Math.round(this.x + Math.cos(angle) * dist)
        this.targetY = Math.round(this.y + Math.sin(angle) * dist)
        this.fatigue += 10
        if (this.distanceTo(this.huntTarget) < 2) {
            this.huntState = 'pounce'
        }
    }

    sneak(world) {
        // Stealthy approach
        if (!this.huntTarget) {
            this.huntState = 'track'
            return
        }
        const angle = Math.atan2(this.huntTarget.y - this.y, this.huntTarget.x - this.x)
        const dist = Math.min(5, this.distanceTo(this.huntTarget))
        this.targetX = Math.round(this.x + Math.cos(angle) * dist)
        this.targetY = Math.round(this.y + Math.sin(angle) * dist)
        this.fatigue += 2
        if (this.distanceTo(this.huntTarget) < 2) {
            this.huntState = 'pounce'
        }
    }

    pounce(world) {
        // Leap to attack
        if (!this.huntTarget) {
            this.huntState = 'track'
            return
        }
        if (this.distanceTo(this.huntTarget) < 2) {
            // Success: remove prey, reset hunt
            world.entitiesMap.delete(this.huntTarget.id)
            this.hunger = Math.max(0, this.hunger - 40)
            this.fatigue += 10
            this.huntState = 'track'
            this.huntTarget = null
        } else {
            this.chase(world)
        }
    }

    territory(world) {
        // Patrol and mark territory
        const angle = Math.random() * Math.PI * 2
        const dist = this.territoryRadius + Math.random() * 10
        this.targetX = Math.round(this.x + Math.cos(angle) * dist)
        this.targetY = Math.round(this.y + Math.sin(angle) * dist)
        // Mark boundary in memory
        this.memory.push({ type: 'territory', x: this.targetX, y: this.targetY, time: Date.now() })
    }

    shelter(world) {
        // Move to/create den
        const covers = world.queryEntitiesInRadius?.(this.x, this.y, 20)?.filter(e => e.type === 'tree' || e.type === 'bush') ?? []
        if (covers.length > 0) {
            const cover = this.memory.find(m => m.type === 'cover') || covers[0]
            this.targetX = cover.x
            this.targetY = cover.y
            this.lastShelter = cover
        }
        this.fatigue = Math.max(0, this.fatigue - 2)
    }

    sleep(world) {
        // Rest, low detection, must be sheltered
        if (this.lastShelter && this.distanceTo(this.lastShelter) < 2) {
            this.fatigue = Math.max(0, this.fatigue - 10)
            this.hunger += 2
            this.lastSleep = Date.now()
        } else {
            this.shelter(world)
        }
    }

    idle(world) {
        // Minimal movement, seek cover if possible
        if (Math.random() < 0.2) {
            const covers = world.queryEntitiesInRadius?.(this.x, this.y, 5)?.filter(e => e.type === 'tree' || e.type === 'bush') ?? []
            if (covers.length > 0) {
                const cover = covers[Math.floor(Math.random() * covers.length)]
                this.targetX = cover.x
                this.targetY = cover.y
            }
        }
        this.fatigue = Math.max(0, this.fatigue - 1)
    }
}

export default SmallPredator
