// SmallForager.js
// A small foraging animal (e.g. squirrel) with daily schedule and instinct logic

import Animal from './Animal.js'

class SmallForager extends Animal {
    constructor(props = {}) {
        super(props.id, props.name || 'Forager', props.x ?? 0, props.y ?? 0)
        this.type = 'animal'
        this.subtype = 'forager'
        this.species = props.species || 'squirrel'
        this.memory = []
        this.lastShelter = null
        this.lastSleep = 0
        this.lastReproduce = 0
        this.injury = 0
        this.fatigue = 0
        this.hunger = 0
        this.fear = 0
        this.dailyQueue = [
            { hour: 6, action: 'forage' },
            { hour: 7, action: 'idle' },
            { hour: 9, action: 'wander' },
            { hour: 15, action: 'forage' },
            { hour: 16, action: 'idle' },
            { hour: 17, action: 'shelter' },
            { hour: 19, action: 'sleep' }
        ]
        this.instincts = [
            { priority: 90, trigger: this.isPredatorNearby, action: this.maintainDistance },
            { priority: 40, trigger: this.isInjuredOrScared, action: this.hideHeal },
            { priority: 50, trigger: this.isHungry, action: this.eat },
            { priority: 30, trigger: this.readyToReproduce, action: this.reproduce },
            { priority: 20, trigger: this.isUnderAttack, action: this.flee }
        ]
    }

    update(tick, world = this.world) {
        // 1. Check instincts by priority
        for (const instinct of this.instincts.sort((a, b) => b.priority - a.priority)) {
            if (instinct.trigger.call(this, world)) {
                instinct.action.call(this, world)
                return
            }
        }
        // 2. Otherwise, follow daily queue
        const hour24 = world?.clock?.getHour24?.() ?? Math.floor((world.clock.currentTick * 48) / 2880) % 24
        const scheduled = this.selectScheduledAction(hour24)
        if (scheduled && typeof this[scheduled.action] === 'function') {
            this[scheduled.action](world)
        }
    }

    selectScheduledAction(hour24) {
        // dailyQueue is authored with hour values; if in 6h game-day, we scaled to 24h
        // Accepts either 0-23 or authored 6-19 windows; match nearest same hour number
        return this.dailyQueue.find(q => q.hour === hour24)
    }

    // Instinct triggers
    isPredatorNearby(world) {
        const predators = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'animal' && e.subtype === 'predator') ?? []
        return predators.length > 0
    }
    isInjuredOrScared() { return this.injury > 10 || this.fear > 10 }
    isHungry() { return this.hunger > 20 }
    readyToReproduce() { return this.fatigue < 10 && this.hunger < 10 && this.injury < 5 && this.lastReproduce < Date.now() - 1000000 }
    isUnderAttack() { return this.fear > 30 }

    // Instinct actions
    maintainDistance(world) {
        // Move away from nearest predator within 10m, prefer memory route
        const predators = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'animal' && e.subtype === 'predator') ?? []
        if (predators.length === 0) return
        // Pick the closest predator
        const predator = predators.reduce((a, b) => this.distanceTo(a) < this.distanceTo(b) ? a : b)
        // Move in the opposite direction (90deg offset for squirrel)
        const angle = Math.atan2(this.y - predator.y, this.x - predator.x) + Math.PI / 2
        const dist = 5 + Math.random() * 5
        this.targetX = Math.round(this.x + Math.cos(angle) * dist)
        this.targetY = Math.round(this.y + Math.sin(angle) * dist)
        this.fear += 10
    }

    hideHeal(world) {
        // Find local cover past a threshold and rest
        const covers = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'tree' || e.type === 'bush') ?? []
        if (covers.length === 0) return
        // Prefer best cover (highest cover value, or random)
        const cover = covers[Math.floor(Math.random() * covers.length)]
        this.targetX = cover.x
        this.targetY = cover.y
        this.fatigue = Math.max(0, this.fatigue - 5)
        this.injury = Math.max(0, this.injury - 2)
        this.fear = Math.max(0, this.fear - 5)
    }

    eat(world) {
        // Find and consume food (berries, nuts, etc) within 10m
        const foods = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.tags?.has('food')) ?? []
        if (foods.length === 0) return
        // Go to nearest food
        const food = foods.reduce((a, b) => this.distanceTo(a) < this.distanceTo(b) ? a : b)
        this.targetX = food.x
        this.targetY = food.y
        // Simulate eating if close
        if (this.distanceTo(food) < 2) {
            this.hunger = Math.max(0, this.hunger - 20)
            this.fatigue += 2
            this.memory.push({ type: 'food', x: food.x, y: food.y, time: Date.now() })
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
            // Simple % chance for new animal
            if (Math.random() < 0.2) {
                world.addEntity(new SmallForager({
                    x: cover.x + Math.random() * 2 - 1,
                    y: cover.y + Math.random() * 2 - 1,
                    species: this.species
                }))
                this.lastReproduce = Date.now()
            }
        }
    }

    flee(world) {
        // Run away quickly (200% speed), prefer home or away from threat
        const predators = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.type === 'animal' && e.subtype === 'predator') ?? []
        if (predators.length === 0) return
        const predator = predators[0]
        const angle = Math.atan2(this.y - predator.y, this.x - predator.x)
        const dist = 15 + Math.random() * 10
        this.targetX = Math.round(this.x + Math.cos(angle) * dist)
        this.targetY = Math.round(this.y + Math.sin(angle) * dist)
        this.fatigue += 10
        this.fear += 10
    }

    // Daily actions
    forage(world) {
        // Spiral search for food, careful movement
        const foods = world.queryEntitiesInRadius?.(this.x, this.y, 10)?.filter(e => e.tags?.has('food')) ?? []
        if (foods.length > 0) {
            const food = foods.reduce((a, b) => this.distanceTo(a) < this.distanceTo(b) ? a : b)
            this.targetX = food.x
            this.targetY = food.y
            if (this.distanceTo(food) < 2) {
                this.hunger = Math.max(0, this.hunger - 10)
                this.memory.push({ type: 'food', x: food.x, y: food.y, time: Date.now() })
            }
        } else {
            // Spiral search pattern
            const angle = Math.random() * Math.PI * 2
            const dist = 5 + Math.random() * 5
            this.targetX = Math.round(this.x + Math.cos(angle) * dist)
            this.targetY = Math.round(this.y + Math.sin(angle) * dist)
        }
        this.fatigue += 2
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

    wander(world) {
        // Explore area, medium detection, stay within 200m of last shelter
        const angle = Math.random() * Math.PI * 2
        const dist = 10 + Math.random() * 20
        let baseX = this.lastShelter?.x ?? this.x
        let baseY = this.lastShelter?.y ?? this.y
        this.targetX = Math.round(baseX + Math.cos(angle) * dist)
        this.targetY = Math.round(baseY + Math.sin(angle) * dist)
        this.fatigue += 3
    }

    shelter(world) {
        // Move to remembered or best shelter
        const covers = world.queryEntitiesInRadius?.(this.x, this.y, 20)?.filter(e => e.type === 'tree' || e.type === 'bush') ?? []
        if (covers.length > 0) {
            // Prefer memory, else pick best
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
}

export default SmallForager
