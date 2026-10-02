// #104: movement costs something.
//
// Needs in this codebase are 0-100 *urgency* values that grow every tick, not a
// stamina pool, so exertion is expressed the way the rest of the file works: as
// a multiplier on how fast a need grows, driven by how much walking the pawn
// has done recently. The body itself charges one unit of effort per stride
// (MobileEntity.move() calls noteStrideEffort), which means the only thing
// terrain and worn ground can do to the body is change how *many* strides a
// journey costs - exactly the reciprocal of the relief #98 gave the stride, so
// the two systems cannot disagree about what a hard step is.
import { SITUATION_RADIUS, REST_BONUS_RANGE, hasTag } from './PawnBehaviors.js'

export const EXERTION = {
    RESPONSE: 0.05,   // share of the remaining gap closed per needs update
    DECAY: 0.03,      // flat cooling per needs update once the walking stops
    SLEEP_DECAY: 4,   // #131: a comfortable bed is what clears it
    REST_DECAY: 2,
    LOAD_GAIN: 0.5,   // a full pack makes the same walking feel 50% harder
    MAX: 1.5,         // a loaded, relentless pawn is more than merely winded
    // Extra urgency growth per unit of exertion, per need.
    RATES: { energy: 1.2, hunger: 0.6, thirst: 0.6 },
    GOAL_DISTANCE_GAIN: 0.5 // how much harder a tired pawn weights distance
}

// #131: the numbers the dead branches of `modifyRateForActivity` were holding,
// now attached to states a pawn can actually be in. `REST_ENERGY_RELIEF` is the
// flat relief of lying down anywhere; a structure built well multiplies it by its
// `restBonus` (1.3 for a crafted lean-to, clamped to 2), so the legacy "sleep is
// worth two and a half" is what a *perfect* bed pays rather than a string nobody
// could ever write. That is the decision the issue asked for: `restBonus` means
// how much of a night's rest the thing you built is worth, and it is now read off
// the entity you are sleeping on instead of being copied onto it and forgotten.
export const REST_ENERGY_RELIEF = 1.0

const SITUATION_RATES = {
    shelterSafety: -0.5,     // out of the weather and out of sight
    threatSafety: 3.0,       // a predator nearby, roof or no roof
    isolationSocial: 2.0,    // nobody to talk to
    comfortableComfort: -0.3 // a bed you made is still a bed
}

/** Behaviors that read as meaningful work to the purpose need (#131). */
export const PURPOSEFUL_BEHAVIORS = new Set([
    'working', 'crafting', 'gathering', 'building', 'hauling', 'collaborating'
])

class PawnNeeds {
    constructor(pawn) {
        this.pawn = pawn

        // #131: what the world currently says about where this pawn is. Derived,
        // never assigned, so the next goal cannot overwrite it. `restBonus` rides
        // along because the relief of resting is a property of the bed.
        this.situations = new Set()
        this.restBonus = 1
        
        // #104: recent exertion (0 = fresh) and the stride effort banked since
        // the last needs update. Both are deliberately visible here rather than
        // appearing by side effect, so they serialise with the rest of needs.
        this.exertion = 0
        this.strideEffort = 0
        
        // Core survival needs (0-100, higher = more urgent)
        this.needs = {
            hunger: 0,          // Need for food
            thirst: 0,          // Need for water  
            energy: 0,          // Need for rest/sleep
            safety: 0,          // Need for security/shelter
            social: 0,          // Need for interaction with other pawns
            purpose: 0,         // Need for meaningful work/goals
            comfort: 0,         // Need for better living conditions
            knowledge: 0        // Need for exploration/learning
        }
        
        // Tolerance thresholds for each need (when they become priorities)
        this.thresholds = {
            hunger: { critical: 80, high: 60, medium: 40, low: 20 },
            thirst: { critical: 85, high: 65, medium: 45, low: 25 },
            energy: { critical: 90, high: 70, medium: 50, low: 30 },
            safety: { critical: 75, high: 55, medium: 35, low: 15 },
            social: { critical: 70, high: 50, medium: 30, low: 10 },
            purpose: { critical: 60, high: 40, medium: 25, low: 10 },
            comfort: { critical: 50, high: 35, medium: 20, low: 5 },
            knowledge: { critical: 40, high: 25, medium: 15, low: 5 }
        }
        
        // Need decay/growth rates (per tick)
        this.rates = {
            hunger: 0.8,        // Increases quickly
            thirst: 1.0,        // Increases very quickly
            energy: 0.6,        // Increases moderately
            safety: 0.2,        // Increases slowly
            social: 0.3,        // Increases slowly
            purpose: 0.1,       // Increases very slowly
            comfort: 0.05,      // Increases very slowly
            knowledge: 0.15     // Increases slowly
        }
        
        this.lastNeedsUpdate = 0
    }
    
    updateNeeds(tick) {
        const elapsed = tick - this.lastNeedsUpdate
        if (elapsed < 5) return // Update every 5 ticks

        // #131: read the world before pricing anything from it, so the exertion
        // cooling below and every need in the loop agree on one snapshot.
        this.readSituation()

        // #104: settle the walking of the last window into a tiredness level
        // before any need reads it, so a need never prices a stride twice.
        this._coolExertion(elapsed)
        
        // Update each need based on time and current activities
        for (const need in this.needs) {
            if (this.rates[need]) {
                // Base increase rate
                let rate = this.rates[need]
                
                // Modify rate based on current activity
                rate = this.modifyRateForActivity(need, rate)

                // And by how hard the pawn has been working its body (#104).
                // A fresh pawn gets the number back untouched, which is what
                // every existing balance test depends on.
                rate = this.applyExertion(need, rate)
                
                // Apply the change
                this.needs[need] = Math.min(100, this.needs[need] + rate)
            }
        }
        
        this.lastNeedsUpdate = tick
    }

    /**
     * Bank the effort of a stride just taken (#104). Called from the movement
     * step with 1 = a full stride at this entity's own pace on this ground, so
     * a shorter final approach counts for less than a whole one. Entities
     * without a needs system (animals) never reach this.
     */
    noteStrideEffort(effort) {
        if (!Number.isFinite(effort) || effort <= 0) return
        this.strideEffort += effort
    }

    /**
     * Fraction of this pawn's carry capacity currently on its back (0-1).
     */
    loadRatio() {
        const carried = this.pawn?.inventoryWeight ?? 0
        const capacity = this.pawn?.maxWeight
        if (!Number.isFinite(carried) || !Number.isFinite(capacity) || capacity <= 0) return 0
        return Math.max(0, Math.min(1, carried / capacity))
    }

    /**
     * Move `exertion` toward the effort rate of the last window. Rising is a
     * slow approach (a stroll does not wind anyone in a single tick); falling
     * is linear, and sleeping falls fastest.
     */
    _coolExertion(elapsed) {
        const strideRate = this.strideEffort / Math.max(1, elapsed)
        this.strideEffort = 0
        const target = Math.min(EXERTION.MAX, strideRate * (1 + EXERTION.LOAD_GAIN * this.loadRatio()))

        if (target > this.exertion) {
            this.exertion = Math.min(EXERTION.MAX, this.exertion + (target - this.exertion) * EXERTION.RESPONSE)
            return
        }

        const at = this.situations ?? this.readSituation()
        const decay = at.has('in_comfortable_space')
            ? EXERTION.DECAY * EXERTION.SLEEP_DECAY
            : at.has('resting')
                ? EXERTION.DECAY * EXERTION.REST_DECAY
                : EXERTION.DECAY
        this.exertion = Math.max(0, this.exertion - decay)
    }

    /**
     * How hard the last while has been, for HUDs, goals and tests.
     */
    exertionLevel() {
        return this.exertion
    }

    /**
     * Needs growth scaled by exertion. Returns the rate back by identity when
     * the pawn is fresh or the need does not care about exertion.
     */
    applyExertion(need, rate) {
        const gain = EXERTION.RATES[need]
        if (!gain || !(this.exertion > 0)) return rate
        return rate * (1 + gain * this.exertion)
    }

    /**
     * Multiplier for the distance term of any decision that trades walking
     * against something else (#104). 1 for a fresh pawn; up to 1 + gain for a
     * winded one. Order-preserving on its own by design - it only changes a
     * choice where distance competes with another quantity, which is where
     * "too tired to go that far" is actually expressible.
     */
    distanceWeight() {
        return 1 + EXERTION.GOAL_DISTANCE_GAIN * Math.min(1, this.exertion)
    }

    /**
     * #131: work out, from the world as it is right now, which of the situations
     * in `SITUATION_STATES` hold for this pawn. Called once per needs update.
     *
     * This is the same look-around `Pawn.registerRestOutcome()` already does to
     * decide what a night's sleep was worth; the difference is that the need model
     * now asks the question while the pawn is lying there instead of afterwards,
     * which is the only way "shelter makes you feel safe" can mean anything.
     *
     * It scans `world.entitiesMap` rather than the chunk query on purpose: an
     * off-screen entity is not always registered in a chunk yet (#127), and a
     * predator you cannot see is still a predator.
     */
    readSituation() {
        const pawn = this.pawn
        const situations = new Set()
        this.restBonus = 1
        this.situations = situations

        const goal = pawn?.goals?.currentGoal ?? null
        const resting = goal?.type === 'rest' && !!goal.startTime
        if (resting) situations.add('resting')

        const world = pawn?.world
        if (!world?.entitiesMap || !Number.isFinite(pawn.x)) return situations

        const company = SITUATION_RADIUS.company
        const companySq = company * company
        const cover = SITUATION_RADIUS.shelter
        const coverSq = cover * cover
        const threat = SITUATION_RADIUS.threat
        const threatSq = threat * threat

        let othersInWorld = 0
        let nearby = 0
        let sheltered = false
        let threatened = false

        for (const entity of world.entitiesMap.values()) {
            if (!entity || entity === pawn) continue
            const dx = (entity.x ?? 0) - pawn.x
            const dy = (entity.y ?? 0) - pawn.y
            const d2 = dx * dx + dy * dy
            const isPawn = entity.subtype === 'pawn'
            if (isPawn) othersInWorld++
            if (d2 > Math.max(companySq, coverSq, threatSq)) continue

            if (isPawn) {
                if (d2 <= companySq) nearby++
                continue
            }
            if (entity.type === 'animal' &&
                (entity.subtype === 'predator' || entity.predator === true)) {
                if (d2 <= threatSq) threatened = true
                continue
            }
            if (d2 <= coverSq && hasTag(entity, 'cover')) {
                sheltered = true
            }
        }

        if (threatened) situations.add('threatened')
        if (sheltered) situations.add('in_shelter')

        // The bed is whatever the pawn chose to lie on; a rest goal that was only
        // ever a location has none, and bare ground rests you at exactly 1x.
        const bonus = resting ? Number(goal.target?.restBonus) : NaN
        this.restBonus = Number.isFinite(bonus)
            ? Math.min(REST_BONUS_RANGE.max, Math.max(REST_BONUS_RANGE.min, bonus))
            : 1
        if (resting && sheltered && this.restBonus > 1) situations.add('in_comfortable_space')

        // A pawn alone in a world of one is not lonely; it is the only one there
        // is, and doubling an urgency nothing in the game can satisfy would hand
        // the decision queue to a need with no remedy. Isolation starts being a
        // fact the moment there is company somewhere else to be with.
        if (othersInWorld > 0 && nearby === 0) situations.add('isolated')

        return situations
    }

    modifyRateForActivity(need, baseRate) {
        const behavior = this.pawn.behaviorState
        const at = this.situations ?? this.readSituation()

        switch (need) {
            case 'hunger':
                if (behavior === 'eating') return -3.0  // Reduces hunger
                if (behavior === 'working') return baseRate * 1.5  // Hard work increases hunger
                break
                
            case 'thirst':
                if (behavior === 'drinking') return -4.0
                if (behavior === 'working') return baseRate * 1.3
                break
                
            case 'energy':
                // #131: `sleeping` was never writable, and `resting` only ever was
                // one for animals. Now the pawn is asleep because the rest goal
                // said so and the world says it is under cover.
                if (at.has('resting')) return -REST_ENERGY_RELIEF * (at.has('in_comfortable_space') ? this.restBonus : 1)
                if (behavior === 'working') return baseRate * 2.0
                break
                
            case 'safety':
                // A predator is scary wherever you are; the roof is what makes the
                // rest of the night safe, and there is no fleeing yet to reward.
                if (at.has('threatened')) return baseRate * SITUATION_RATES.threatSafety
                if (behavior === 'building') return -1.5
                if (at.has('in_shelter')) return SITUATION_RATES.shelterSafety
                break
                
            case 'social':
                if (behavior === 'socializing') return -2.0
                if (at.has('isolated')) return baseRate * SITUATION_RATES.isolationSocial
                break
                
            case 'purpose':
                // #131: `completing_goal` was this branch's dead name for "the
                // pawn is making something". The labels the goal system can
                // actually write for that are PURPOSEFUL_BEHAVIORS, and a pawn
                // spending its day crafting or hauling deserves the same relief
                // one running the `work` goal always got.
                if (PURPOSEFUL_BEHAVIORS.has(behavior)) return -1.0
                if (behavior === 'idle') return baseRate * 2.0
                break
                
            case 'comfort':
                if (behavior === 'building') return -1.0
                if (at.has('in_comfortable_space')) return SITUATION_RATES.comfortableComfort
                break
                
            case 'knowledge':
                if (behavior === 'exploring') return -1.5
                if (behavior === 'learning') return -2.0
                break
        }
        
        return baseRate
    }
    
    getMostUrgentNeed() {
        let mostUrgent = null
        let highestUrgency = 0
        
        for (const need in this.needs) {
            const value = this.needs[need]
            const thresholds = this.thresholds[need]
            
            let urgency = 0
            if (value >= thresholds.critical) urgency = 4
            else if (value >= thresholds.high) urgency = 3
            else if (value >= thresholds.medium) urgency = 2
            else if (value >= thresholds.low) urgency = 1
            
            if (urgency > highestUrgency) {
                highestUrgency = urgency
                mostUrgent = need
            }
        }
        
        return { need: mostUrgent, urgency: highestUrgency, value: this.needs[mostUrgent] }
    }
    
    satisfyNeed(need, amount) {
        if (this.needs[need] !== undefined) {
            this.needs[need] = Math.max(0, this.needs[need] - amount)
        }
    }
    
    getNeedsPriority() {
        const priorities = []
        
        for (const need in this.needs) {
            let value = this.needs[need]
            const thresholds = this.thresholds[need]
            
            // Apply user-defined priority adjustments
            value = this.pawn.getAdjustedNeedPriority?.(need, value) ?? value
            
            if (value >= thresholds.low) {
                let priority = 1
                if (value >= thresholds.critical) priority = 4
                else if (value >= thresholds.high) priority = 3
                else if (value >= thresholds.medium) priority = 2
                
                priorities.push({
                    need,
                    value,
                    priority
                })
            }
        }
        
        // Sort by priority (highest first)
        priorities.sort((a, b) => b.priority - a.priority)
        return priorities
    }
}

export default PawnNeeds
