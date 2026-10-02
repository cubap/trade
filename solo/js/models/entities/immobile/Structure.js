import ImmobileEntity from './ImmobileEntity.js'
import * as Degradation from '../../../core/Degradation.js'

// A lean-to is a frame of sticks with a skirt of fibre: 18 units of ground, and
// enough condition to outlast a season of weather at average workmanship.
export const SHELTER_SIZE = 18
const SHELTER_CONDITION = 110

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
        
        // Deteriorate over time using shared Degradation module
        Degradation.update(this, this.deteriorationRate)
        
        if (Degradation.isCritical(this)) {
            // Structure is destroyed
            return false
        }
        
        return true
    }
    
    repair(amount) {
        Degradation.repair(this, amount, this.maxCondition)
    }
    
    applyBuffsToEntity(entity) {
        // Apply this structure's buffs to nearby entity
    }
}

/**
 * The one way a shelter gets into the world.
 *
 * Two routes raise one: the civic `build_structure` goal, which carts materials to
 * a site and spends a day on it, and a `placeable` recipe (`basic_shelter`), which
 * raises the lean-to on the spot the moment the last cord is tied (#120). They used
 * to be two separate constructor calls, and only the first had ever been exercised.
 *
 * `quality` is the workmanship the builder brought - a crafted output's quality
 * runs 0.5 to 2, a hand-built frame passes nothing - and it decides how long the
 * shelter stands, because condition is what `update()` erodes.
 *
 * @param {object} options
 * @param {string} options.id
 * @param {string} options.name
 * @param {number} options.x
 * @param {number} options.y
 * @param {string|null} [options.ownerId]
 * @param {number} [options.quality]
 * @param {number} [options.restBonus] From the recipe's output, so the number means
 *   something on the entity rather than only in the recipe book.
 * @returns {Structure}
 */
export function createShelter({ id, name, x, y, ownerId = null, quality = 1, restBonus = null }) {
    const shelter = new Structure(id, name, x, y)
    shelter.tags.add('cover')
    shelter.tags.add('shelter')
    shelter.tags.add('built')
    shelter.ownerId = ownerId
    shelter.size = SHELTER_SIZE
    const workmanship = Math.min(2, Math.max(0.5, quality))
    shelter.quality = workmanship
    shelter.maxCondition = Math.round(SHELTER_CONDITION * workmanship)
    shelter.condition = shelter.maxCondition
    if (restBonus !== null) shelter.restBonus = restBonus
    return shelter
}

export default Structure
