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
        
        // Allow UI-set bias to inject a next goal once
        if (this.pawn.priorityBias?.nextGoal) {
            this.goalQueue.unshift({ ...this.pawn.priorityBias.nextGoal })
            // one-shot bias
            this.pawn.priorityBias.nextGoal = null
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
                // Add crafting as a purpose-fulfilling activity
                if (this.pawn.unlocked?.recipes?.size > 0) {
                    goals.push({
                        type: 'craft_item',
                        priority: priority - 1,
                        description: 'Craft something useful',
                        targetType: 'activity',
                        action: 'craft',
                        completionReward: { purpose: -25, knowledge: -10 }
                    })
                }
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
            'map_territory': 'surveying',
            'train_skill': 'teaching',
            'apprentice_skill': 'learning',
            'craft_item': 'crafting',
            'craft_cordage': 'crafting',
            'craft_sharp_stone': 'crafting',
            'craft_poultice': 'crafting'
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

        // Skill gains based on goal type (lightweight for now)
        const sg = {
            'find_food': { orienteering: 0.2 },
            'find_water': { orienteering: 0.2 },
            'rest': { composure: 0.05 },
            'seek_shelter': { composure: 0.1 },
            'socialize': { storytelling: 0.2 },
            'work': { manipulation: 0.1 },
            'explore': { orienteering: 0.4, cartography: 0.1 },
            'build_structure': { planning: 0.3 },
            'establish_trade': { convincing: 0.3 },
            'map_territory': { cartography: 0.4 },
            'study': { planning: 0.3 }
        }
        const gains = sg[goal.type]
        if (gains) {
            for (const [skill, amount] of Object.entries(gains)) {
                this.pawn.useSkill(skill, amount)
            }
        }
        
        // Evaluate skill unlocks after goal completion
        this.pawn.evaluateSkillUnlocks?.()

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
            // If rest completed, schedule next day plan
            if (goal.type === 'rest') {
                this.pawn.scheduleNextDay?.()
            }
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
                    // Observation on entering/resting at a structure (e.g., school)
                    if (!goal._observedStructure) {
                        this.pawn.observeStructure?.(goal.target)
                        goal._observedStructure = true
                    }
                }
            }
        }

        // Learning/study goals grant incremental skill use
        if (goal.type === 'study') {
            // Passive studying increases planning and knowledge-adjacent skills
            this.pawn.useSkill('planning', 0.02)
            // Examine carried items while studying to convert exposure into insight
            this.pawn.examineInventoryDuringStudy?.(0.01)
        }

        // Crafting goals: attempt to craft the specified item
        if (goal.type.startsWith('craft_') || goal.type === 'craft_item') {
            if (!goal.startTime) goal.startTime = this.pawn.world.clock.currentTick
            const elapsed = this.pawn.world.clock.currentTick - goal.startTime
            
            // Import recipes dynamically
            import('../../crafting/Recipes.js').then(module => {
                const { getRecipe, getAvailableRecipes, canCraftRecipe } = module
                
                let recipe = null
                if (goal.recipeId) {
                    recipe = getRecipe(goal.recipeId)
                } else if (goal.type !== 'craft_item') {
                    // Extract recipe id from goal type (e.g., craft_cordage -> cordage)
                    const recipeId = goal.type.replace('craft_', '')
                    recipe = getRecipe(recipeId)
                } else {
                    // Pick first available recipe
                    const available = getAvailableRecipes(this.pawn).filter(r => canCraftRecipe(this.pawn, r))
                    recipe = available[0]
                }
                
                if (recipe && canCraftRecipe(this.pawn, recipe)) {
                    // Wait for craft time
                    if (elapsed >= (recipe.craftTime ?? 20)) {
                        const crafted = this.pawn.craft(recipe)
                        if (crafted) {
                            this.pawn.addItemToInventory(crafted)
                            this.completeCurrentGoal()
                        }
                    }
                } else if (elapsed > 100) {
                    // Give up after 100 ticks if can't craft
                    console.warn(`${this.pawn.name} cannot craft, abandoning goal`)
                    this.completeCurrentGoal()
                }
            }).catch(err => {
                console.error('Failed to load recipes:', err)
                this.completeCurrentGoal()
            })
        }

        // Training/apprenticing: both must be near each other; grant per-tick gains
        if (goal.type === 'train_skill' || goal.type === 'apprentice_skill') {
            const target = goal.target
            if (target && target.subtype === 'pawn') {
                const dx = this.pawn.x - target.x
                const dy = this.pawn.y - target.y
                const close = (dx*dx + dy*dy) <= (this.pawn.size + target.size + 10) ** 2
                if (close) {
                    const skill = goal.skill || 'manipulation'
                    if (goal.type === 'train_skill') {
                        this.pawn.trainSkill(skill, target, 0.05)
                    } else {
                        this.pawn.apprenticeSkill(skill, target, 0.04)
                    }
                    if (!goal.startTime) goal.startTime = this.pawn.world.clock.currentTick
                    // Auto-complete after duration if specified
                    if (goal.duration) {
                        const elapsed = this.pawn.world.clock.currentTick - goal.startTime
                        if (elapsed >= goal.duration) {
                            this.completeCurrentGoal()
                        }
                    }
                } else {
                    // Move towards target if not close
                    this.pawn.nextTargetX = target.x
                    this.pawn.nextTargetY = target.y
                }
            }
        }
    }
}

export default PawnGoals
