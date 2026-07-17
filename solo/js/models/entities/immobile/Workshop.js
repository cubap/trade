import Structure from './Structure.js'

class Workshop extends Structure {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'workshop'
        this.tags = new Set(['structure', 'workshop', 'cover'])
        this.color = '#b7410e' // burnt orange for workshop
        this.size = 22
        this.capacity = 4
        this.occupants = new Set()
        this.craftQualityBoost = 0.15 // +15% craft quality when working here
        this.apprenticeBoost = 1.4 // +40% apprenticing rate (matches PawnLearning)
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

        // Apply workshop buffs to occupants
        if (this.world && this.occupants.size) {
            for (const id of this.occupants) {
                const pawn = this.world.entitiesMap.get(id)
                if (!pawn) continue

                // Small crafting skill boost for being in workshop
                pawn.increaseSkill?.('crafting', 0.01)
            }
        }

        return true
    }
}

export default Workshop
