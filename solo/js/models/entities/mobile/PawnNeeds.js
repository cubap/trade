class PawnNeeds {
    constructor(pawn) {
        this.pawn = pawn
        
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
        if (tick - this.lastNeedsUpdate < 5) return // Update every 5 ticks
        
        // Update each need based on time and current activities
        for (const need in this.needs) {
            if (this.rates[need]) {
                // Base increase rate
                let rate = this.rates[need]
                
                // Modify rate based on current activity
                rate = this.modifyRateForActivity(need, rate)
                
                // Apply the change
                this.needs[need] = Math.min(100, this.needs[need] + rate)
            }
        }
        
        this.lastNeedsUpdate = tick
    }
    
    modifyRateForActivity(need, baseRate) {
        const behavior = this.pawn.behaviorState
        
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
                if (behavior === 'sleeping') return -2.5
                if (behavior === 'resting') return -1.0
                if (behavior === 'working') return baseRate * 2.0
                break
                
            case 'safety':
                if (behavior === 'building_shelter') return -1.5
                if (behavior === 'in_shelter') return -0.5
                if (behavior === 'threatened') return baseRate * 3.0
                break
                
            case 'social':
                if (behavior === 'socializing') return -2.0
                if (behavior === 'isolated') return baseRate * 2.0
                break
                
            case 'purpose':
                if (behavior === 'working') return -1.0
                if (behavior === 'completing_goal') return -2.0
                if (behavior === 'idle') return baseRate * 2.0
                break
                
            case 'comfort':
                if (behavior === 'improving_living') return -1.0
                if (behavior === 'in_comfortable_space') return -0.3
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
