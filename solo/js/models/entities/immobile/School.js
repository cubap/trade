import Structure from './Structure.js'

class School extends Structure {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.tags = new Set(['structure', 'school', 'cover'])
        this.color = '#6b8e23' // olive for school
        this.size = 18
        this.capacity = 6
        this.occupants = new Set()
        this.studyRateBoost = 1.5 // multiplier for planning/knowledge gains
        this.replenishComfort = 0.2 // minor rest recovery per tick inside
    }

    canEnter(pawn) {
        return this.occupants.size < this.capacity
    }

    enter(pawn) {
        if (this.canEnter(pawn)) this.occupants.add(pawn.id)
    }

    leave(pawn) {
        this.occupants.delete(pawn.id)
    }

    update(tick) {
        const alive = super.update(tick)
        if (alive === false) return false
        // Apply study/rest buffs to occupants
        if (this.world && this.occupants.size) {
            for (const id of this.occupants) {
                const pawn = this.world.entitiesMap.get(id)
                if (!pawn) continue
                // Boost planning a bit when occupying school
                pawn.increaseSkill?.('planning', 0.02 * this.studyRateBoost)
                // Small rest recovery when sheltering at school
                pawn.needs?.satisfyNeed?.('energy', this.replenishComfort)
            }
        }
        return true
    }
}

export default School
