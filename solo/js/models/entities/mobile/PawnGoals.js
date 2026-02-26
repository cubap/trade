import { decomposeGoal, isGoalReachable } from './GoalPlanner.js'

class PawnGoals {
    constructor(pawn) {
        this.pawn = pawn
        this.currentGoal = null
        this.goalQueue = []
        this.completedGoals = []
        this.deferredGoals = [] // Goals on hold due to missing prerequisites
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
        
        // Re-evaluate deferred goals periodically
        if (this.deferredGoals.length > 0 && Math.random() < 0.1) {
            for (const deferred of [...this.deferredGoals]) {
                const check = isGoalReachable(this.pawn, deferred)
                if (check.reachable) {
                    this.deferredGoals = this.deferredGoals.filter(g => g !== deferred)
                    this.goalQueue.push(deferred)
                }
            }
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
            this.planAndStartGoal(this.currentGoal)
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
                    duration: 10,
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

                // Add crafting as a purpose-fulfilling activity when recipes unlocked
                if (this.pawn.unlocked?.recipes?.size > 0) {
                    goals.push({
                        type: 'craft_item',
                        priority: Math.max(1, priority - 1),
                        description: 'Craft something useful',
                        targetType: 'activity',
                        action: 'craft',
                        completionReward: { purpose: -25, knowledge: -10 }
                    })
                }

                break

            case 'social':
                goals.push({
                    type: 'socialize',
                    priority,
                    description: 'Interact with others',
                    targetType: 'entity',
                    targetSubtype: 'pawn',
                    action: 'socialize',
                    completionReward: { social: -30 }
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

            default:
                // No specific goals for unknown needs
                break
        }

        return goals
    }
    
    addLongTermGoals() {
        // Add some aspirational goals when basic needs are met
        const longTermGoals = [
            {
                type: 'gather_materials',
                priority: 1,
                description: 'Gather crafting materials',
                completionReward: { purpose: -15, knowledge: -5 }
            },
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
            },
            {
                type: 'teach_skill',
                priority: 1,
                description: 'Teach a skill to another pawn',
                targetType: 'entity',
                targetSubtype: 'pawn',
                action: 'teach',
                duration: 100,
                completionReward: { social: -15, purpose: -20 }
            },
            {
                type: 'collaborative_craft',
                priority: 1,
                description: 'Work with others on a large project',
                targetType: 'activity',
                action: 'collaborate',
                completionReward: { social: -25, purpose: -30, knowledge: -15 }
            },
            {
                type: 'accumulate_valuables',
                priority: 1,
                description: 'Craft high-quality items for trade',
                targetType: 'activity',
                action: 'craft_valuable',
                completionReward: { purpose: -25, comfort: -15 }
            }
        ]
        
        // Prioritize gathering if inventory is low
        if ((this.pawn.inventory?.length ?? 0) < 3) {
            longTermGoals[0].priority = 2
        }
        
        // Prioritize teaching if highly skilled in something
        const hasHighSkill = Object.values(this.pawn.skills).some(v => v > 15)
        if (hasHighSkill) {
            longTermGoals.find(g => g.type === 'teach_skill').priority = 2
        }
        
        // Prioritize collaboration if social need is moderate
        const socialNeed = this.pawn.needs.needs.social ?? 0
        if (socialNeed > 20 && socialNeed < 60) {
            longTermGoals.find(g => g.type === 'collaborative_craft').priority = 2
        }
        
        // Add 1-3 random long-term goals
        const count = 1 + Math.floor(Math.random() * 3)
        const selected = this.selectRandomGoals(longTermGoals, count)
        this.goalQueue.push(...selected)
    }
    
    selectRandomGoals(goals, count) {
        // Weighted random selection based on priority
        const weighted = []
        for (const goal of goals) {
            for (let i = 0; i < goal.priority; i++) {
                weighted.push(goal)
            }
        }
        
        const selected = []
        const used = new Set()
        
        for (let i = 0; i < count && weighted.length > 0; i++) {
            const idx = Math.floor(Math.random() * weighted.length)
            const goal = weighted[idx]
            
            if (!used.has(goal.type)) {
                selected.push(goal)
                used.add(goal.type)
            }
        }
        
        return selected
    }
    
    planAndStartGoal(goal) {
        // Check if goal is reachable
        const reachability = isGoalReachable(this.pawn, goal)
        
        if (!reachability.reachable) {
            console.log(`${this.pawn.name} deferring goal "${goal.description}": ${reachability.reason}`)
            
            // Handle unreachable goals
            if (reachability.needsExploration) {
                // Trigger exploration to find resources
                this.goalQueue.unshift({
                    type: 'explore',
                    priority: goal.priority + 1,
                    description: 'Explore to find resources',
                    targetType: 'location',
                    action: 'explore',
                    parentGoal: goal.type
                })
                this.deferredGoals.push(goal)
                this.currentGoal = this.goalQueue.shift()
                this.startGoal(this.currentGoal)
            } else if (reachability.canResearch) {
                // Trigger pondering/research
                console.log(`${this.pawn.name} needs to research solution for ${goal.description}`)
                this.deferredGoals.push(goal)
                // Maybe add a "ponder" or "study" goal here
            } else {
                // Defer for later
                this.deferredGoals.push(goal)
            }
            return
        }
        
        // Decompose goal into subgoals
        const subgoals = decomposeGoal(this.pawn, goal)
        
        if (subgoals.length > 0) {
            console.log(`${this.pawn.name} decomposing "${goal.description}" into ${subgoals.length} subgoals`)
            // Insert subgoals before main goal
            this.goalQueue.unshift(goal)
            for (let i = subgoals.length - 1; i >= 0; i--) {
                this.goalQueue.unshift(subgoals[i])
            }
            // Start first subgoal
            this.currentGoal = this.goalQueue.shift()
            this.startGoal(this.currentGoal)
        } else {
            // No prerequisites, start goal directly
            this.startGoal(goal)
        }
    }
    
    startGoal(goal) {
        console.log(`${this.pawn.name} starting goal: ${goal.description}`)
        this.pawn.behaviorState = this.getBehaviorForGoal(goal)
        
        // Set target based on goal
        if (goal.targetType === 'resource' || goal.targetType === 'entity') {
            this.findTargetForGoal(goal)
        } else if (goal.targetType === 'location') {
            this.selectExplorationTarget()
        } else if (goal.targetLocation) {
            // Specific location target from memory
            this.pawn.nextTargetX = goal.targetLocation.x
            this.pawn.nextTargetY = goal.targetLocation.y
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
            'teach_skill': 'teaching',
            'apprentice_skill': 'learning',
            'follow_leader': 'following',
            'protect_target': 'guarding',
            'escort_target': 'escorting',
            'mark_target': 'coordinating',
            'craft_item': 'crafting',
            'craft_cordage': 'crafting',
            'craft_sharp_stone': 'crafting',
            'craft_poultice': 'crafting',
            'gather_materials': 'gathering',
            'gather_specific': 'gathering',
            'search_resource': 'exploring',
            'collaborative_craft': 'collaborating',
            'accumulate_valuables': 'crafting'
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

        if (goal.type === 'socialize' && goal.target?.subtype === 'pawn') {
            const shared = this.pawn.shareResourceMemory?.(goal.target, { maxShare: 2, minConfidence: 0.55 }) ?? 0
            if (shared > 0) {
                this.pawn.useSkill('storytelling', 0.05)
                goal.target.useSkill?.('memoryClustering', 0.03)
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

        if (goal.targetId && !goal.target && this.pawn.world?.entitiesMap) {
            goal.target = this.pawn.world.entitiesMap.get(goal.targetId) ?? null
        }

        if (goal.type === 'follow_leader') {
            if (!goal.target || goal.target.subtype !== 'pawn') {
                this.completeCurrentGoal()
                return
            }

            const dx = goal.target.x - this.pawn.x
            const dy = goal.target.y - this.pawn.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const followDistance = goal.followDistance ?? 24

            if (distance > followDistance) {
                this.pawn.nextTargetX = goal.target.x
                this.pawn.nextTargetY = goal.target.y
            }

            if (!goal.startTime) goal.startTime = this.pawn.world.clock.currentTick
            const elapsed = this.pawn.world.clock.currentTick - goal.startTime
            if (elapsed >= (goal.duration ?? 120)) {
                this.completeCurrentGoal()
            }
            return
        }

        if (goal.type === 'protect_target') {
            if (!goal.target) {
                this.completeCurrentGoal()
                return
            }

            const dx = goal.target.x - this.pawn.x
            const dy = goal.target.y - this.pawn.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const protectRadius = goal.protectRadius ?? 35

            if (distance > protectRadius) {
                this.pawn.nextTargetX = goal.target.x
                this.pawn.nextTargetY = goal.target.y
            }

            if (!goal.startTime) goal.startTime = this.pawn.world.clock.currentTick
            const elapsed = this.pawn.world.clock.currentTick - goal.startTime
            if (elapsed % 25 === 0) {
                this.pawn.useSkill('composure', 0.04)
                this.pawn.useSkill('cooperation', 0.04)
            }
            if (elapsed >= (goal.duration ?? 120)) {
                this.completeCurrentGoal()
            }
            return
        }

        if (goal.type === 'escort_target') {
            if (!goal.target) {
                this.completeCurrentGoal()
                return
            }

            const targetDx = goal.target.x - this.pawn.x
            const targetDy = goal.target.y - this.pawn.y
            const targetDistance = Math.sqrt(targetDx * targetDx + targetDy * targetDy)

            if (targetDistance > (goal.escortDistance ?? 28)) {
                this.pawn.nextTargetX = goal.target.x
                this.pawn.nextTargetY = goal.target.y
            } else if (goal.destination?.x != null && goal.destination?.y != null) {
                this.pawn.nextTargetX = goal.destination.x
                this.pawn.nextTargetY = goal.destination.y
            }

            if (!goal.startTime) goal.startTime = this.pawn.world.clock.currentTick
            const elapsed = this.pawn.world.clock.currentTick - goal.startTime
            if (goal.destination?.x != null && goal.destination?.y != null) {
                const dx = this.pawn.x - goal.destination.x
                const dy = this.pawn.y - goal.destination.y
                if (Math.sqrt(dx * dx + dy * dy) < 20) {
                    this.completeCurrentGoal()
                    return
                }
            }
            if (elapsed >= (goal.duration ?? 160)) {
                this.completeCurrentGoal()
            }
            return
        }

        if (goal.type === 'mark_target') {
            const target = goal.target
            const location = goal.targetLocation ?? (target ? { x: target.x, y: target.y } : null)
            if (location) {
                this.pawn.groupMarks = this.pawn.groupMarks ?? []
                this.pawn.groupMarks.push({
                    targetId: target?.id ?? goal.targetId ?? null,
                    location,
                    timestamp: this.pawn.world.clock.currentTick
                })

                if (this.pawn.groupMarks.length > 10) {
                    this.pawn.groupMarks.shift()
                }
            }
            this.completeCurrentGoal()
            return
        }
        
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

                // If a specific recipe was requested, try to use it
                if (goal.recipeName) {
                    recipe = getRecipe(goal.recipeName)
                } else {
                    // Otherwise pick a craftable recipe we can currently make
                    const candidates = getAvailableRecipes(this.pawn).filter(r => canCraftRecipe(this.pawn, r))
                    if (candidates.length > 0) recipe = candidates[0]
                }

                if (!recipe) {
                    console.warn(`${this.pawn.name} recipe not found or cannot craft for goal ${goal.type}, abandoning`)
                    this.completeCurrentGoal()
                    return
                }

                // If we can't currently craft it, give up after some time
                if (!canCraftRecipe(this.pawn, recipe)) {
                    if (elapsed > 100) {
                        console.warn(`${this.pawn.name} cannot craft ${recipe.name} after waiting, abandoning`)
                        this.completeCurrentGoal()
                    }
                    // Otherwise, defer and let other goals (gathering) run
                    return
                }

                // Attempt to craft
                const crafted = this.pawn.craft?.(recipe)
                if (crafted) {
                    const added = this.pawn.addItemToInventory(crafted)
                    if (!added) console.log(`${this.pawn.name} could not carry crafted ${crafted.name}`)
                    this.completeCurrentGoal()
                } else {
                    if (elapsed > 100) {
                        console.warn(`${this.pawn.name} failed to craft ${recipe.name}, abandoning`)
                        this.completeCurrentGoal()
                    }
                }
            }).catch(err => {
                console.error(`Failed to load recipes for ${goal.type}:`, err)
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

        // Gather specific resource from known location
        if (goal.type === 'gather_specific') {
            if (!goal.gatheredCount) goal.gatheredCount = 0
            
            // Navigate to target location
            if (goal.targetLocation) {
                const dx = this.pawn.x - goal.targetLocation.x
                const dy = this.pawn.y - goal.targetLocation.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                
                if (dist > 50) {
                    // Move towards remembered location
                    this.pawn.nextTargetX = goal.targetLocation.x
                    this.pawn.nextTargetY = goal.targetLocation.y
                } else {
                    // Search nearby for the resource
                    const entities = Array.from(this.pawn.world.entitiesMap.values())
                    const nearby = entities.filter(e => {
                        if (e.type !== goal.targetResourceType) return false
                        const edx = e.x - this.pawn.x
                        const edy = e.y - this.pawn.y
                        return Math.sqrt(edx * edx + edy * edy) <= 80
                    })
                    
                    if (nearby.length > 0) {
                        // Find closest resource
                        nearby.sort((a, b) => {
                            const distA = Math.sqrt((a.x - this.pawn.x) ** 2 + (a.y - this.pawn.y) ** 2)
                            const distB = Math.sqrt((b.x - this.pawn.x) ** 2 + (b.y - this.pawn.y) ** 2)
                            return distA - distB
                        })
                        
                        const resource = nearby[0]
                        const rdx = this.pawn.x - resource.x
                        const rdy = this.pawn.y - resource.y
                        const rdist = Math.sqrt(rdx * rdx + rdy * rdy)
                        
                        if (rdist <= (this.pawn.size + resource.size + 5)) {
                            // Gather the resource
                            if (resource.gather && typeof resource.gather === 'function') {
                                const gathered = resource.gather(1) // Gather 1 unit
                                if (gathered) {
                                    this.pawn.addItemToInventory(gathered)
                                    this.pawn.updateResourceMemoryConfidence(resource, true)
                                    goal.gatheredCount++
                                    console.log(`${this.pawn.name} gathered ${gathered.type}, progress: ${goal.gatheredCount}/${goal.count || 1}`)
                                    
                                    // Update memory with fresh location
                                    this.pawn.rememberResource(resource)
                                } else {
                                    this.pawn.updateResourceMemoryConfidence(resource, false)
                                    
                                    // Check if we've gathered enough
                                    if (goal.gatheredCount >= (goal.count || 1)) {
                                        console.log(`${this.pawn.name} completed gathering ${goal.targetResourceType}`)
                                        this.completeCurrentGoal()
                                    } else {
                                        // Look for another resource nearby first
                                        const moreNearby = nearby.filter(e => 
                                            e !== resource && 
                                            Math.sqrt((e.x - this.pawn.x) ** 2 + (e.y - this.pawn.y) ** 2) <= 80
                                        )
                                        
                                        if (moreNearby.length > 0) {
                                            // Go to next closest resource
                                            this.pawn.nextTargetX = moreNearby[0].x
                                            this.pawn.nextTargetY = moreNearby[0].y
                                        } else {
                                            // Search for more in memory
                                            const memories = this.pawn.recallResourcesByType?.(goal.targetResourceType) ?? []
                                            if (memories.length > 0) {
                                                // Go to next remembered location
                                                goal.targetLocation = { x: memories[0].x, y: memories[0].y }
                                            } else {
                                                // Need to search for more
                                                goal.type = 'search_resource'
                                                goal.targetLocation = null
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // Move towards resource
                            this.pawn.nextTargetX = resource.x
                            this.pawn.nextTargetY = resource.y
                        }
                    } else {
                        // Resource not found at remembered location, search memory for another location
                        const memories = this.pawn.recallResourcesByType?.(goal.targetResourceType) ?? []
                        if (memories.length > 0) {
                            // Try next remembered location
                            goal.targetLocation = { x: memories[0].x, y: memories[0].y }
                            console.log(`${this.pawn.name} trying another remembered ${goal.targetResourceType} location`)
                        } else {
                            // No more known locations, switch to search
                            console.log(`${this.pawn.name} no more known ${goal.targetResourceType} locations, searching...`)
                            goal.type = 'search_resource'
                            goal.targetLocation = null
                        }
                    }
                }
            } else {
                // No location known, switch to search
                goal.type = 'search_resource'
            }
        }

        // Search for unknown resource type
        if (goal.type === 'search_resource') {
            // Scan nearby for the target resource type
            const entities = Array.from(this.pawn.world.entitiesMap.values())
            const found = entities.find(e => {
                if (e.type !== goal.targetResourceType) return false
                const dx = e.x - this.pawn.x
                const dy = e.y - this.pawn.y
                return Math.sqrt(dx * dx + dy * dy) <= 100
            })
            
            if (found) {
                console.log(`${this.pawn.name} found ${goal.targetResourceType} at (${Math.round(found.x)}, ${Math.round(found.y)})`)
                
                // Remember this location
                this.pawn.rememberResource(found)
                
                // Switch to gather_specific with this location
                goal.type = 'gather_specific'
                goal.targetLocation = { x: found.x, y: found.y }
                goal.gatheredCount = 0
                
                // Update behavior state and immediately navigate to resource
                this.pawn.behaviorState = 'gathering'
                this.pawn.nextTargetX = found.x
                this.pawn.nextTargetY = found.y
                
                // Check if already close enough to gather
                const dx = this.pawn.x - found.x
                const dy = this.pawn.y - found.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                
                if (dist <= (this.pawn.size + found.size + 5) && found.gather && typeof found.gather === 'function') {
                    // Immediately gather if close enough
                    const gathered = found.gather(1) // Gather 1 unit
                    if (gathered) {
                        this.pawn.addItemToInventory(gathered)
                        this.pawn.updateResourceMemoryConfidence(found, true)
                        goal.gatheredCount++
                        console.log(`${this.pawn.name} gathered ${gathered.type}, progress: ${goal.gatheredCount}/${goal.count || 1}`)
                        
                        // Check if done
                        if (goal.gatheredCount >= (goal.count || 1)) {
                            this.completeCurrentGoal()
                        }
                    } else {
                        this.pawn.updateResourceMemoryConfidence(found, false)
                    }
                }
            } else {
                // Continue exploring
                if (!this.pawn.nextTargetX || !this.pawn.nextTargetY) {
                    this.selectExplorationTarget()
                }
                
                // Check if we're close to exploration target
                const dx = this.pawn.x - this.pawn.nextTargetX
                const dy = this.pawn.y - this.pawn.nextTargetY
                const dist = Math.sqrt(dx * dx + dy * dy)
                
                if (dist < 20) {
                    // Pick new exploration target
                    this.selectExplorationTarget()
                }
            }
        }

        // Gathering materials (general): look for any harvestable resources nearby
        if (goal.type === 'gather_materials') {
            const entities = Array.from(this.pawn.world.entitiesMap.values())
            const harvestable = entities.filter(e => {
                if (!e.gather || typeof e.gather !== 'function') return false
                const dx = e.x - this.pawn.x
                const dy = e.y - this.pawn.y
                return Math.sqrt(dx * dx + dy * dy) <= 100
            })
            
            if (Math.random() < 0.05) {
                console.log(`${this.pawn.name} sees ${harvestable.length} harvestable resources nearby`)
            }
            
            if (harvestable.length > 0) {
                // Find closest harvestable
                harvestable.sort((a, b) => {
                    const distA = Math.sqrt((a.x - this.pawn.x) ** 2 + (a.y - this.pawn.y) ** 2)
                    const distB = Math.sqrt((b.x - this.pawn.x) ** 2 + (b.y - this.pawn.y) ** 2)
                    return distA - distB
                })
                
                const resource = harvestable[0]
                const dx = this.pawn.x - resource.x
                const dy = this.pawn.y - resource.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                
                if (Math.random() < 0.1) {
                    console.log(`${this.pawn.name} approaching ${resource.subtype || resource.type} at distance ${Math.round(dist)}`)
                }
                
                if (dist <= (this.pawn.size + resource.size + 5)) {
                    // Gather the resource
                    if (resource.gather && typeof resource.gather === 'function') {
                        const gathered = resource.gather(1) // Gather 1 unit
                        if (gathered) {
                            this.pawn.addItemToInventory(gathered)
                            console.log(`${this.pawn.name} gathered ${gathered.type}. Inventory: ${this.pawn.inventory.length}/${this.pawn.inventorySlots}`)
                            
                            // Update memory: success!
                            this.pawn.updateResourceMemoryConfidence(resource, true)
                            
                            // Complete if inventory getting full OR if gathered enough variety
                            if (this.pawn.inventory.length >= this.pawn.inventorySlots) {
                                console.log(`${this.pawn.name} inventory full, completing gathering goal`)
                                this.completeCurrentGoal()
                            } else if (this.pawn.inventory.length >= Math.floor(this.pawn.inventorySlots / 2) && Math.random() < 0.3) {
                                // 30% chance to finish early if we have decent materials
                                console.log(`${this.pawn.name} gathered enough materials, completing goal`)
                                this.completeCurrentGoal()
                            }
                            // Continue gathering more if not done
                        } else {
                            console.log(`${this.pawn.name} failed to gather from ${resource.subtype || resource.type}`)
                            // Update memory: failed to gather (depleted)
                            this.pawn.updateResourceMemoryConfidence(resource, false)
                        }
                    }
                } else {
                    // Move towards resource
                    this.pawn.nextTargetX = resource.x
                    this.pawn.nextTargetY = resource.y
                }
            } else {
                // No harvestables nearby, explore to find more
                if (!this.pawn.nextTargetX || !this.pawn.nextTargetY) {
                    this.selectExplorationTarget()
                }
                
                // Check if we're close to exploration target
                const dx = this.pawn.x - (this.pawn.nextTargetX || this.pawn.x)
                const dy = this.pawn.y - (this.pawn.nextTargetY || this.pawn.y)
                const dist = Math.sqrt(dx * dx + dy * dy)
                
                if (dist < 20) {
                    // Reached exploration point, pick new target
                    this.selectExplorationTarget()
                }
            }
        }
        
        // Collaborative crafting: find another pawn and work together
        if (goal.type === 'collaborative_craft') {
            if (!goal.partner) {
                // Find another pawn to collaborate with
                const entities = Array.from(this.pawn.world.entitiesMap.values())
                const otherPawns = entities.filter(e => 
                    e.subtype === 'pawn' && 
                    e !== this.pawn &&
                    e.behaviorState !== 'busy'
                )
                
                if (otherPawns.length > 0) {
                    goal.partner = otherPawns[Math.floor(Math.random() * otherPawns.length)]
                    console.log(`${this.pawn.name} seeks to collaborate with ${goal.partner.name}`)
                }
            }
            
            if (goal.partner) {
                // Move towards partner
                const dx = this.pawn.x - goal.partner.x
                const dy = this.pawn.y - goal.partner.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                
                if (dist > 20) {
                    this.pawn.nextTargetX = goal.partner.x
                    this.pawn.nextTargetY = goal.partner.y
                } else {
                    // Close enough to collaborate
                    if (!goal.startTime) goal.startTime = this.pawn.world.clock.currentTick
                    
                    // Work together for duration
                    if (!goal.duration) goal.duration = 200 // Default collaboration duration
                    const elapsed = this.pawn.world.clock.currentTick - goal.startTime
                    
                    if (elapsed >= goal.duration) {
                        console.log(`${this.pawn.name} completed collaboration with ${goal.partner.name}`)
                        // Both gain social and skill benefits
                        this.pawn.increaseSkill('cooperation', 1)
                        goal.partner.increaseSkill?.('cooperation', 1)
                        const shared = this.pawn.shareResourceMemory?.(goal.partner, { maxShare: 3, minConfidence: 0.5 }) ?? 0
                        if (shared > 0) {
                            this.pawn.increaseSkill('routePlanning', 0.05)
                            goal.partner.increaseSkill?.('memoryClustering', 0.05)
                        }
                        this.completeCurrentGoal()
                    } else {
                        // Periodic skill gains during collaboration
                        if (elapsed % 20 === 0) {
                            this.pawn.increaseSkill('cooperation', 0.1)
                            this.pawn.increaseSkill('planning', 0.05)
                        }
                    }
                }
            } else {
                // No partner available, complete anyway
                this.completeCurrentGoal()
            }
        }
        
        // Accumulate valuables: craft high-quality items
        if (goal.type === 'accumulate_valuables') {
            if (!goal.startTime) goal.startTime = this.pawn.world.clock.currentTick
            
            // Try to craft the best available recipe
            import('../../crafting/Recipes.js').then(module => {
                const { getAvailableRecipes, canCraftRecipe } = module
                
                const available = getAvailableRecipes(this.pawn)
                    .filter(r => canCraftRecipe(this.pawn, r))
                    .sort((a, b) => (b.output.baseQuality ?? 1) - (a.output.baseQuality ?? 1))
                
                if (available.length > 0) {
                    const recipe = available[0]
                    const crafted = this.pawn.craft(recipe)
                    
                    if (crafted && crafted.quality >= 1.2) {
                        console.log(`${this.pawn.name} crafted valuable ${crafted.name} (quality: ${crafted.quality.toFixed(2)})`)
                        const added = this.pawn.addItemToInventory(crafted)
                        if (!added) console.log(`${this.pawn.name} could not carry crafted ${crafted.name}`)
                        this.completeCurrentGoal()
                    } else if (crafted) {
                        // Try again for higher quality
                        const added = this.pawn.addItemToInventory(crafted)
                        if (!added) console.log(`${this.pawn.name} could not carry crafted ${crafted.name}`)
                    }
                } else {
                    // Can't craft anything, complete goal
                    this.completeCurrentGoal()
                }
            }).catch(err => {
                console.error('Failed to load recipes:', err)
                this.completeCurrentGoal()
            })
        }
        
        // Teaching: both teacher and student gain
        if (goal.type === 'teach_skill') {
            const target = goal.target
            if (!goal.skill) {
                // Choose highest skill to teach
                const skills = Object.entries(this.pawn.skills).sort((a, b) => b[1] - a[1])
                goal.skill = skills[0]?.[0] || 'gathering'
            }
            
            if (target && target.subtype === 'pawn') {
                const dx = this.pawn.x - target.x
                const dy = this.pawn.y - target.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                
                if (dist > 20) {
                    this.pawn.nextTargetX = target.x
                    this.pawn.nextTargetY = target.y
                } else {
                    // Teaching in progress
                    if (!goal.startTime) {
                        goal.startTime = this.pawn.world.clock.currentTick
                        console.log(`${this.pawn.name} begins teaching ${goal.skill} to ${target.name}`)
                    }
                    
                    // Periodic skill transfer
                    const elapsed = this.pawn.world.clock.currentTick - goal.startTime
                    if (elapsed % 10 === 0) {
                        this.pawn.trainSkill(goal.skill, target, 0.2)
                        this.pawn.increaseSkill('storytelling', 0.05) // Teacher also improves
                    }
                    
                    if (elapsed >= (goal.duration || 100)) {
                        console.log(`${this.pawn.name} finished teaching ${goal.skill} to ${target.name}`)
                        this.completeCurrentGoal()
                    }
                }
            } else {
                // No valid target
                this.completeCurrentGoal()
            }
        }
    }
}

export default PawnGoals
