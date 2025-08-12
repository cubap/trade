class PawnGoals {
    constructor(pawn) {
        this.pawn = pawn
        this.currentGoal = null
        this.goalQueue = []
        this.completedGoals = []
    }
    
    evaluateAndSetGoals() {
        // Get current needs priorities
        const needsPriority = this.pawn.needs.getNeedsPriority()
        
        // Clear existing goal queue
        this.goalQueue = []
        
        // Generate goals based on urgent needs
        for (const needInfo of needsPriority) {
            const goals = this.generateGoalsForNeed(needInfo.need, needInfo.priority)
            this.goalQueue.push(...goals)
        }
        
        // Add some long-term goals if immediate needs are met
        if (needsPriority.length === 0 || needsPriority[0].priority <= 2) {
            this.addLongTermGoals()
        }
        
        // Set current goal if none exists
        if (!this.currentGoal && this.goalQueue.length > 0) {
            this.currentGoal = this.goalQueue.shift()
            this.startGoal(this.currentGoal)
        }
    }
    
    generateGoalsForNeed(need, priority) {
        const goals = []
        
        switch (need) {
            case 'hunger':
                goals.push({
                    type: 'find_food',
                    priority,
                    description: 'Find and consume food',
                    targetType: 'resource',
                    targetTags: ['food'],
                    action: 'consume',
                    completionReward: { hunger: -50 }
                })
                break
                
            case 'thirst':
                goals.push({
                    type: 'find_water',
                    priority,
                    description: 'Find and drink water',
                    targetType: 'resource',
                    targetTags: ['water'],
                    action: 'consume',
                    completionReward: { thirst: -60 }
                })
                break
                
            case 'energy':
                goals.push({
                    type: 'rest',
                    priority,
                    description: 'Find a place to rest',
                    targetType: 'resource',
                    targetTags: ['cover'],
                    action: 'use',
                    duration: 10, // ticks to rest
                    completionReward: { energy: -70 }
                })
                break
                
            case 'safety':
                goals.push({
                    type: 'seek_shelter',
                    priority,
                    description: 'Find or build shelter',
                    targetType: 'resource',
                    targetTags: ['cover'],
                    action: 'occupy',
                    completionReward: { safety: -40 }
                })
                break
                
            case 'social':
                goals.push({
                    type: 'socialize',
                    priority,
                    description: 'Interact with other pawns',
                    targetType: 'entity',
                    targetSubtype: 'pawn',
                    action: 'interact',
                    completionReward: { social: -45 }
                })
                break
                
            case 'purpose':
                goals.push({
                    type: 'work',
                    priority,
                    description: 'Engage in productive work',
                    targetType: 'activity',
                    action: 'work',
                    duration: 15,
                    completionReward: { purpose: -35 }
                })
                break
                
            case 'knowledge':
                goals.push({
                    type: 'explore',
                    priority,
                    description: 'Explore unknown areas',
                    targetType: 'location',
                    action: 'explore',
                    completionReward: { knowledge: -30 }
                })
                break
        }
        
        return goals
    }
    
    addLongTermGoals() {
        // Add some aspirational goals when basic needs are met
        const longTermGoals = [
            {
                type: 'build_structure',
                priority: 1,
                description: 'Build a permanent structure',
                targetType: 'activity',
                action: 'build',
                requirements: ['materials', 'location'],
                completionReward: { comfort: -30, purpose: -20, safety: -25 }
            },
            {
                type: 'establish_trade',
                priority: 1,
                description: 'Establish trade relationships',
                targetType: 'entity',
                targetSubtype: 'pawn',
                action: 'trade',
                completionReward: { social: -20, purpose: -15 }
            },
            {
                type: 'map_territory',
                priority: 1,
                description: 'Map out the surrounding territory',
                targetType: 'activity',
                action: 'survey',
                completionReward: { knowledge: -40, purpose: -10 }
            }
        ]
        
        // Add 1-2 random long-term goals
        const selected = longTermGoals.slice(0, 1 + Math.floor(Math.random() * 2))
        this.goalQueue.push(...selected)
    }
    
    startGoal(goal) {
        console.log(`${this.pawn.name} starting goal: ${goal.description}`)
        this.pawn.behaviorState = this.getBehaviorForGoal(goal)
        
        // Set target based on goal
        if (goal.targetType === 'resource' || goal.targetType === 'entity') {
            this.findTargetForGoal(goal)
        } else if (goal.targetType === 'location') {
            this.selectExplorationTarget()
        }
    }
    
    getBehaviorForGoal(goal) {
        const behaviorMap = {
            'find_food': 'seeking_food',
            'find_water': 'seeking_water',
            'rest': 'seeking_rest',
            'seek_shelter': 'seeking_shelter',
            'socialize': 'seeking_social',
            'work': 'working',
            'explore': 'exploring',
            'build_structure': 'building',
            'establish_trade': 'trading',
            'map_territory': 'surveying'
        }
        
        return behaviorMap[goal.type] || 'idle'
    }
    
    findTargetForGoal(goal) {
        if (goal.targetTags) {
            // Find resources with specific tags
            const entities = Array.from(this.pawn.world.entitiesMap.values())
            const targets = entities.filter(entity => {
                const t = entity?.tags
                if (!t) return false
                return goal.targetTags.some(tag => Array.isArray(t) ? t.includes(tag) : (typeof t.has === 'function' ? t.has(tag) : false))
            })
            
            if (targets.length > 0) {
                // Find closest target
                targets.sort((a, b) => {
                    const distA = Math.sqrt((a.x - this.pawn.x) ** 2 + (a.y - this.pawn.y) ** 2)
                    const distB = Math.sqrt((b.x - this.pawn.x) ** 2 + (b.y - this.pawn.y) ** 2)
                    return distA - distB
                })
                
                this.pawn.nextTargetX = targets[0].x
                this.pawn.nextTargetY = targets[0].y
                this.currentGoal.target = targets[0]
            }
        } else if (goal.targetSubtype) {
            // Find entities of specific subtype
            const entities = Array.from(this.pawn.world.entitiesMap.values())
            const targets = entities.filter(entity => 
                entity.subtype === goal.targetSubtype && entity !== this.pawn
            )
            
            if (targets.length > 0) {
                const randomTarget = targets[Math.floor(Math.random() * targets.length)]
                this.pawn.nextTargetX = randomTarget.x
                this.pawn.nextTargetY = randomTarget.y
                this.currentGoal.target = randomTarget
            }
        }
    }
    
    selectExplorationTarget() {
        // Pick a random location to explore
        const angle = Math.random() * Math.PI * 2
        const distance = 100 + Math.random() * 200
        
        this.pawn.nextTargetX = this.pawn.x + Math.cos(angle) * distance
        this.pawn.nextTargetY = this.pawn.y + Math.sin(angle) * distance
    }
    
    updateGoalProgress() {
        if (!this.currentGoal) return
        
        // Check if goal is completed
        const completed = this.checkGoalCompletion()
        
        if (completed) {
            this.completeCurrentGoal()
        } else {
            // Update goal-specific logic
            this.updateGoalSpecificLogic()
        }
    }
    
    checkGoalCompletion() {
        if (!this.currentGoal) return false
        
        const goal = this.currentGoal
        
        // Check if we're at the target
        if (goal.target) {
            const distance = Math.sqrt(
                (this.pawn.x - goal.target.x) ** 2 + 
                (this.pawn.y - goal.target.y) ** 2
            )
            
            if (distance <= (this.pawn.size + goal.target.size + 5)) {
                return true
            }
        }
        
        // Check duration-based goals
        if (goal.duration && goal.startTime) {
            const elapsed = this.pawn.world.clock.currentTick - goal.startTime
            return elapsed >= goal.duration
        }
        
        return false
    }
    
    completeCurrentGoal() {
        const goal = this.currentGoal
        
        console.log(`${this.pawn.name} completed goal: ${goal.description}`)
        
        // Apply completion rewards
        if (goal.completionReward) {
            for (const need in goal.completionReward) {
                this.pawn.needs.satisfyNeed(need, Math.abs(goal.completionReward[need]))
            }
        }
        
        // Store completed goal
        this.completedGoals.push({
            ...goal,
            completedAt: this.pawn.world.clock.currentTick
        })
        
        // Move to next goal
        this.currentGoal = null
        if (this.goalQueue.length > 0) {
            this.currentGoal = this.goalQueue.shift()
            this.startGoal(this.currentGoal)
        } else {
            this.pawn.behaviorState = 'idle'
        }
    }
    
    updateGoalSpecificLogic() {
        // Goal-specific update logic can be added here
        const goal = this.currentGoal
        
        if (goal.type === 'rest' && !goal.startTime) {
            // Start resting timer when we reach the rest location
            if (goal.target) {
                const distance = Math.sqrt(
                    (this.pawn.x - goal.target.x) ** 2 + 
                    (this.pawn.y - goal.target.y) ** 2
                )
                
                if (distance <= (this.pawn.size + goal.target.size + 5)) {
                    goal.startTime = this.pawn.world.clock.currentTick
                }
            }
        }
    }
}

export default PawnGoals
