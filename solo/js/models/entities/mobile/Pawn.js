import MobileEntity from './MobileEntity.js'
import PawnNeeds from './PawnNeeds.js'
import PawnGoals from './PawnGoals.js'
import { SKILL_UNLOCKS, isUnlockSatisfied } from '../../skills/SkillUnlocks.js'
import { emitUnlocks } from '../../skills/UnlockEvents.js'
import INVENTION_CONFIG from './InventionConfig.js'

class Pawn extends MobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'pawn'
        this.tags.push('pawn')  // Add pawn-specific tag
        this.color = '#3498db'  // Blue color for pawns
        
        // Pawn-specific attributes
        this.inventory = [] // Carried items
        this.inventorySlots = 2 // Hands-only: 2 slots at start
        this.inventoryWeight = 0 // Current total weight
        this.maxWeight = 50 // Default max weight
        this.maxSize = 100 // Default max size (volume)
        this.hiddenInventory = [] // Items dropped on death/harvest

        // Sparse skill storage - only track skills that have been used/gained
        // Skills are stored as { skillName: value } only when value > 0
        this.skills = {}
        
        // Invention/pondering system
        this.ponderingQueue = [] // Problems to think about: { problem, context, priority, timestamp }
        this.discoveredSolutions = new Set() // Track what this pawn has figured out
        this.solutionSuccessCount = {} // Track success with each solution for specialization
        this.ponderingCooldown = 0 // Ticks before can ponder again
        this.behaviorState = 'idle'  // Current activity state
        
        // Lateral learning and social observation
        this.observedCrafts = new Set() // Items seen being crafted or used
        this.knownMaterials = new Set() // Materials encountered/gathered
        this.craftingHistory = [] // Recent crafts: {recipe, quality, timestamp, success}
        this.resourceSpecialization = {
            domains: {},
            materials: {},
            woodUse: {
                tool: 0,
                weapon: 0,
                construction: 0
            },
            knownSoilTypes: new Set(),
            knownSeedTypes: new Set()
        }
        
        // Initialize sophisticated needs and goals systems
        this.needs = new PawnNeeds(this)
        this.goals = new PawnGoals(this)
        
        // Legacy memory system (can be expanded later)
        this.memory = []
        
        // Current target for movement/interaction
        this.currentTarget = null
        
        // Placeholder for future skill tree structure
        this.skillTree = {}
        
        this.idleTicks = 0 // Track idle time for planning skill

        // Track when skills were last used for gentle decay
        this.skillLastUsed = {}

        // Simple idle planner configuration (unlocks expand with planning)
        this.idlePlan = {
            enabled: true,
            tasks: ['study', 'explore'], // default idle tasks
            studyDuration: 60, // ticks
            triggers: { hunger: 35, thirst: 45, energy: 65 }
        }

        // Memory map for landmarks
        this.memoryMap = [] // List of known landmarks
        this.maxLandmarks = 5 // Can be increased by skills

        // Resource memory: tracks seen resources for planning
        // Phase 1: Egocentric (direction-based, must update as pawn moves)
        // Phase 2: Allocentric (compass directions, fixed origin, compressed vectors)
        this.resourceMemory = [] // { type, tags, x, y, lastSeen, amount, successCount, failCount, confidence, memoryPhase }
        this.maxResourceMemory = 20 // Can be increased by skills
        this.memoryOrigin = { x, y } // Origin point for allocentric memory (spawn location)
        this.memoryPhase = 1 // 1=egocentric, 2=allocentric, 3=clusters, 4=conceptual

        // Reputation system
        this.reputation = { alignment: 0, aggression: 0, membership: {} }
        this.reputationMemory = {} // { pawnId: { alignment, aggression, source, strength, timestamp } }

        // Lightweight group and command system (Phase 1)
        this.groupState = {
            id: null,
            role: 'none', // none | leader | member
            leaderId: null,
            joinedAt: null,
            cohesion: 0
        }
        this.groupTrust = {} // { pawnId: trustScore }
        this.groupCommandQueue = [] // pending commands for this pawn
        this.groupMarks = [] // shared attention markers

        // Health attributes
        this.traits = {
            health: 100,
            healthMax: 100
        }
        this.healthEvents = [] // Track health events (injuries, healing, etc.)

        // Time system constants (in seconds)
        this.constructor.TURN_REAL_SECONDS = 12
        this.constructor.TURN_GAME_SECONDS = 48
        this.constructor.GAME_HOUR_SECONDS = 60 * 48 // 2880s = 48min real time
        this.constructor.GAME_DAY_HOURS = 6
        this.constructor.GAME_DAY_SECONDS = 6 * 60 * 48 // 17280s = 3.6h real time

        // Pawn time-tracking properties (game time, in seconds)
        this.lastSleepTime = 0
        this.lastMealTime = 0
        this.lastDrinkTime = 0
        this.sleepDeprivation = 0 // In game seconds
        this.isAsleep = false

        // Unlocked skills, goals, and recipes (populated by evaluateSkillUnlocks)
        this.unlocked = { skills: new Set(), goals: new Set(), recipes: new Set() }
    }
    
    // Helper to check tags whether Set or Array
    hasTag(entity, tag) {
        const t = entity?.tags
        if (!t) return false
        if (Array.isArray(t)) return t.includes(tag)
        if (typeof t.has === 'function') return t.has(tag)
        return false
    }
    
    // Check if pawn has a container in inventory
    hasContainer() {
        // For now, any item with slotType === 'container' counts
        return this.inventory.some(item => item.slotType === 'container')
    }
    
    decideNextMove() {
        // Use goals system to determine movement
        if (this.goals.currentGoal) {
            this.handleGoalMovement()
        } else {
            // Random exploration when no specific goal
            this.randomExploration()
        }
    }
    
    handleGoalMovement() {
        const goal = this.goals.currentGoal
        
        // Try to find target based on goal type
        if (goal.targetType === 'resource' && !this.currentTarget) {
            this.currentTarget = this.findNearestResourceByTags(goal.targetTags)
        }
        
        if (this.currentTarget) {
            // Move towards target
            this.moveTowardsTarget(this.currentTarget)
            
            // Check if we've reached the target
            const distance = Math.sqrt(
                Math.pow(this.x - this.currentTarget.x, 2) + 
                Math.pow(this.y - this.currentTarget.y, 2)
            )
            
            if (distance <= 2) {
                this.executeGoalAction()
            }
        } else {
            // No target found, explore to find one
            this.exploreForGoal()
        }
    }
    
    randomExploration() {
        const angle = Math.random() * Math.PI * 2
        const distance = this.moveRange * (0.5 + Math.random() * 0.5)
        
        this.nextTargetX = Math.round(this.x + Math.cos(angle) * distance)
        this.nextTargetY = Math.round(this.y + Math.sin(angle) * distance)
    }
    
    moveTowardsTarget(target) {
        const dx = target.x - this.x
        const dy = target.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance > 0) {
            const moveDistance = Math.min(this.moveRange, distance)
            const ratio = moveDistance / distance
            
            this.nextTargetX = Math.round(this.x + dx * ratio)
            this.nextTargetY = Math.round(this.y + dy * ratio)
        }
    }
    
    executeGoalAction() {
        const goal = this.goals.currentGoal
        
        if (!goal) return
        
        // Execute the goal's action
        switch (goal.action) {
            case 'consume':
                this.consumeResource(this.currentTarget, goal)
                break
            case 'gather':
                this.gatherFromResource(this.currentTarget, goal)
                break
            case 'interact':
                this.interactWithTarget(this.currentTarget, goal)
                break
            default:
                console.log(`Unknown goal action: ${goal.action}`)
        }
    }
    
    consumeResource(resource, goal) {
        if (resource && resource.canConsume?.()) {
            this.behaviorState = this.hasTag(resource, 'food') ? 'eating' : 'drinking'
            
            // Consume the resource
            resource.consume(1)
            
            // Apply goal rewards
            if (goal.completionReward) {
                for (const need in goal.completionReward) {
                    this.needs.satisfyNeed(need, Math.abs(goal.completionReward[need]))
                }
            }
            
            // Complete the goal
            this.goals.completeCurrentGoal()
            this.currentTarget = null
            this.behaviorState = 'idle'
        }
    }
    
    gatherFromResource(resource, goal) {
        if (resource && resource.canGather?.()) {
            this.behaviorState = 'gathering'
            
            // Gather from resource
            const gathered = resource.gather(1)
            if (gathered) {
                this.inventory.push(gathered)
                // Examination-based learning: require interaction with the gathered item
                this.examineItem?.(gathered)
                // Track material for lateral learning
                this.trackMaterialEncounter(gathered)
                
                // Update memory confidence: success!
                this.updateResourceMemoryConfidence(resource, true)
            } else {
                // Gather failed (depleted resource)
                this.updateResourceMemoryConfidence(resource, false)
            }
            
            // Apply rewards
            if (goal.completionReward) {
                for (const need in goal.completionReward) {
                    this.needs.satisfyNeed(need, Math.abs(goal.completionReward[need]))
                }
            }
            
            this.goals.completeCurrentGoal()
            this.currentTarget = null
            this.behaviorState = 'idle'
        } else {
            // Resource couldn't be gathered (depleted or gone)
            this.updateResourceMemoryConfidence(resource, false)
        }
    }
    
    interactWithTarget(target, goal) {
        this.behaviorState = 'socializing'
        // Observation requires interaction: learn a bit about what we directly engage with
        if (target) {
            this.observeInteraction?.(target)
        }
        
        // Basic interaction logic
        if (goal.completionReward) {
            for (const need in goal.completionReward) {
                this.needs.satisfyNeed(need, Math.abs(goal.completionReward[need]))
            }
        }
        
        this.goals.completeCurrentGoal()
        this.currentTarget = null
        this.behaviorState = 'idle'
    }
    
    exploreForGoal() {
        // Intelligent exploration based on goal
        const goal = this.goals.currentGoal
        
        if (goal?.targetTags) {
            // Move in a direction that might have the resource we need
            this.exploreForResourceType(goal.targetTags)
        } else {
            this.randomExploration()
        }
    }
    
    exploreForResourceType(targetTags) {
        // For now, use random exploration with slight bias
        // This could be enhanced with memory of previously seen resources
        const angle = Math.random() * Math.PI * 2
        const distance = this.moveRange * 0.8  // Slightly more focused movement
        
        this.nextTargetX = Math.round(this.x + Math.cos(angle) * distance)
        this.nextTargetY = Math.round(this.y + Math.sin(angle) * distance)
    }
    
    findNearestResourceByTags(targetTags) {
        if (!this.chunkManager) return null
        
        const searchRadius = 5  // Search within 5 chunks
        const pawnChunkX = Math.floor(this.x / this.chunkManager.chunkSize)
        const pawnChunkY = Math.floor(this.y / this.chunkManager.chunkSize)
        
        let nearestResource = null
        let nearestDistance = Infinity
        
        // Search chunks in expanding radius
        for (let radius = 0; radius <= searchRadius; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check border of current radius to avoid re-checking
                    if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
                    
                    const chunkX = pawnChunkX + dx
                    const chunkY = pawnChunkY + dy
                    const chunk = this.chunkManager.getChunk(chunkX, chunkY)
                    
                    if (chunk) {
                        // Check entities in chunk for matching resources
                        for (const entity of chunk.entities) {
                            if (this.entityMatchesTags(entity, targetTags)) {
                                const distance = Math.sqrt(
                                    Math.pow(this.x - entity.x, 2) + 
                                    Math.pow(this.y - entity.y, 2)
                                )
                                
                                if (distance < nearestDistance) {
                                    nearestDistance = distance
                                    nearestResource = entity
                                }
                            }
                        }
                    }
                }
            }
            
            // If we found something in this radius, return it (closest first)
            if (nearestResource) break
        }
        
        return nearestResource
    }
    
    entityMatchesTags(entity, targetTags) {
        if (!entity?.tags) return false
        return targetTags.some(tag => this.hasTag(entity, tag))
    }
    
    /**
     * Get a skill value (returns 0 if skill doesn't exist)
     * @param {string} skill - Skill name
     * @returns {number} Skill value (0 if not yet acquired)
     */
    getSkill(skill) {
        return this.skills[skill] ?? 0
    }
    
    /**
     * Increase a skill (creates skill entry if first time)
     * @param {string} skill - Skill name
     * @param {number} amount - Amount to increase (default 1)
     */
    increaseSkill(skill, amount = 1) {
        const current = this.skills[skill] ?? 0
        const newValue = current + amount
        
        // Only store if value is positive (sparse storage)
        if (newValue > 0) {
            this.skills[skill] = newValue
        } else if (this.skills[skill] !== undefined) {
            // Remove skill if it drops to 0 or below
            delete this.skills[skill]
        }
        
        // Mark last used for decay tracking
        const tick = this.world?.clock?.currentTick ?? 0
        this.skillLastUsed[skill] = tick
    }

    useSkill(skill, amount = 1) {
        this.increaseSkill(skill, amount)
    }

    // --- Interaction-based observation and examination helpers ---
    observeInteraction(target, amount = 0.1) {
        // Learn based on what we interacted with
        const tags = target?.tags
        const subtype = target?.subtype
        // Interacting with plants improves herbalism slightly
        if ((Array.isArray(tags) ? tags.includes('plant') : (typeof tags?.has === 'function' ? tags.has('plant') : false)) || subtype === 'plant') {
            this.increaseSkill('herbalism', amount)
        }
        // Interacting with structures (e.g., school) improves planning/cartography a bit
        if ((Array.isArray(tags) ? tags.includes('structure') : (typeof tags?.has === 'function' ? tags.has('structure') : false)) || subtype === 'structure') {
            this.increaseSkill('planning', amount * 0.8)
            this.increaseSkill('cartography', amount * 0.4)
        }
        // Interacting with another pawn improves social skills slightly
        if (subtype === 'pawn') {
            this.increaseSkill('storytelling', amount * 0.5)
            this.increaseSkill('convincing', amount * 0.3)
            this.increaseSkill('manipulation', amount * 0.2)
        }
        // Light unlock evaluation on interaction
        this.evaluateSkillUnlocks?.()
    }

    examineItem(item, amount = 0.2) {
        if (!item) return
        // Track exposure to item types to support unlocks later
        const type = item.type ?? item.name ?? 'unknown'
        this.itemExposure = this.itemExposure ?? {}
        this.itemExposure[type] = (this.itemExposure[type] ?? 0) + 1
        
        // Track as known material for lateral learning
        this.trackMaterialEncounter(item)

        // Heuristics: herbs/food/water inform herbalism/alchemy/medicine
        const tags = item.tags ?? []
        const has = t => Array.isArray(tags) ? tags.includes(t) : (typeof tags?.has === 'function' ? tags.has(t) : false)
        if (has('herb') || /herb|leaf|flower/i.test(String(type))) {
            this.increaseSkill('herbalism', amount)
        }
        if (has('potion') || /potion|elixir/i.test(String(type))) {
            this.increaseSkill('alchemy', amount)
        }
        if (has('medical') || has('bandage') || /salve|bandage|medicine/i.test(String(type))) {
            this.increaseSkill('medicine', amount * 0.8)
        }
        // Food/drink inform basic survival
        if (has('food') || item.type === 'food') {
            this.increaseSkill('planning', amount * 0.2)
        }
        if (has('drink') || item.type === 'drink' || has('water')) {
            this.increaseSkill('planning', amount * 0.2)
        }

        this.addItemExperience?.(type, 1)
        this.evaluateSkillUnlocks?.()
    }

    observeStructure(structure, amount = 0.1) {
        if (!structure) return
        const tags = structure.tags
        const isSchool = Array.isArray(tags) ? tags.includes('school') : (typeof tags?.has === 'function' ? tags.has('school') : false)
        const isStructure = Array.isArray(tags) ? tags.includes('structure') : (typeof tags?.has === 'function' ? tags.has('structure') : false)
        // Track exposure by structure tags
        this.structureExposure = this.structureExposure ?? {}
        if (isStructure) this.structureExposure.structure = (this.structureExposure.structure ?? 0) + 1
        if (isSchool) this.structureExposure.school = (this.structureExposure.school ?? 0) + 1
        if (isStructure) {
            this.increaseSkill('planning', amount)
            if (isSchool) {
                // Studying environment nudges cartography/intuition a bit
                this.increaseSkill('cartography', amount * 0.5)
                this.increaseSkill('intuition', amount * 0.2)
            }
        }
        this.evaluateSkillUnlocks?.()
    }

    examineInventoryDuringStudy(amount = 0.02) {
        if (!this.inventory?.length) return
        for (const item of this.inventory) {
            this.examineItem(item, amount)
        }
    }

    passiveSkillTick() {
        // Example: exploring increases orienteering, guarding increases composure
        if (this.behaviorState === 'exploring') {
            this.increaseSkill('orienteering', 0.1)
            // Remember resources while exploring
            this.observeNearbyResources()
        }
        if (this.behaviorState === 'guarding') {
            this.increaseSkill('composure', 0.1)
        }
        // Add more passive skill checks as needed
        // Observation now requires interaction/training, not mere proximity
    }

    observeNearbyResources(radius = 50) {
        // Remember resources in perception range
        if (!this.chunkManager) return
        const pawnChunkX = Math.floor(this.x / this.chunkManager.chunkSize)
        const pawnChunkY = Math.floor(this.y / this.chunkManager.chunkSize)
        
        let observed = 0
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const chunk = this.chunkManager.getChunk(pawnChunkX + dx, pawnChunkY + dy)
                if (chunk) {
                    for (const entity of chunk.entities) {
                        const dist = Math.sqrt((this.x - entity.x) ** 2 + (this.y - entity.y) ** 2)
                        // Check for harvestable tag OR gather method
                        const isHarvestable = this.hasTag(entity, 'harvestable') || typeof entity.gather === 'function'
                        if (dist <= radius && isHarvestable) {
                            this.rememberResource(entity)
                            observed++
                        }
                    }
                }
            }
        }
        
        if (observed > 0 && Math.random() < 0.1) {
            // Occasional logging (10% chance to avoid spam)
            console.log(`${this.name} observed ${observed} harvestable resources`)
        }
    }

    decaySkills(tick) {
        // Gentle decay for skills not used recently; run occasionally
        if (!this._lastDecayTick) this._lastDecayTick = tick
        if (tick - this._lastDecayTick < 200) return // every ~200 ticks
        this._lastDecayTick = tick
        const nowTick = tick
        
        // Iterate over skills and decay if not recently used
        for (const [skill, value] of Object.entries(this.skills)) {
            const last = this.skillLastUsed[skill] ?? 0
            if (nowTick - last > 2000) {
                const newValue = Math.max(0, value - 0.1)
                if (newValue > 0) {
                    this.skills[skill] = newValue
                } else {
                    // Remove skill from sparse storage if it decays to 0
                    delete this.skills[skill]
                }
            }
        }
    }

    trainSkill(skill, student, amount = 0.5) {
        // Training another pawn increases their skill
        if (student && student.increaseSkill) {
            student.increaseSkill(skill, amount)
        }
    }

    apprenticeSkill(skill, teacher, amount = 0.5) {
        // Apprenticing under a teacher (only learn if teacher is better)
        if (teacher && teacher.getSkill(skill) > this.getSkill(skill)) {
            this.increaseSkill(skill, amount)
        }
    }

    applyHealthChange(amount, reason = '') {
        this.traits = this.traits ?? {}
        this.traits.health = (this.traits.health ?? 100) + amount
        this.traits.health = Math.max(0, Math.min(this.traits.health, this.traits.healthMax ?? 100))
        if (amount < 0) {
            this.addHealthEvent('injury', amount, reason)
        } else if (amount > 0) {
            this.addHealthEvent('healing', amount, reason)
        }
    }

    addHealthEvent(type, amount, reason = '') {
        this.healthEvents = this.healthEvents ?? []
        this.healthEvents.push({
            type,
            amount,
            reason,
            timestamp: Date.now(),
            duration: this.getHealthEventDuration(type, amount, reason)
        })
    }

    getHealthEventDuration(type, amount, reason) {
        // Example: injuries last longer, infections can be persistent
        if (type === 'injury') return Math.abs(amount) * 1000
        if (type === 'infection') return 5000 + Math.abs(amount) * 500
        if (type === 'healing') return Math.abs(amount) * 500
        return 1000
    }

    updateHealthEvents() {
        this.healthEvents = this.healthEvents?.filter(event => {
            const elapsed = Date.now() - event.timestamp
            return elapsed < event.duration
        }) ?? []
    }

    isInfected() {
        return this.healthEvents?.some(e => e.type === 'infection') ?? false
    }

    applyFoodMedicine(item) {
        // item: { medicine, infectionCure, healing, ... }
        if (item.medicine) {
            this.applyHealthChange(item.medicine, 'medicine')
        }
        if (item.infectionCure && this.isInfected()) {
            this.healthEvents = this.healthEvents.filter(e => e.type !== 'infection')
        }
        if (item.healing) {
            this.applyHealthChange(item.healing, 'healing food')
        }
    }

    update(tick) {
        super.update(tick)
        this.needs.updateNeeds(tick)

        if (!this.goals.currentGoal) {
            const commandGoal = this.getNextGroupCommandGoal()
            if (commandGoal) {
                this.priorityBias = this.priorityBias ?? {}
                this.priorityBias.nextGoal = commandGoal
            }
        }

        this.goals.evaluateAndSetGoals()
        this.goals.updateGoalProgress() // Execute current goal logic
        this.passiveSkillTick()
        this.decaySkills(tick)
        this.updateHealthEvents()
        
        // Update memory phase every 100 ticks based on skills
        if (tick % 100 === 0) {
            this.updateMemoryPhase()
        }
        
        // Process pondering queue periodically (especially when idle)
        if (tick % 50 === 0 || (this.behaviorState === 'idle' && tick % 20 === 0)) {
            this.processPonderingQueue()
        }
        
        if (this.behaviorState === 'idle' && !this.goals.currentGoal) {
            this.idleTicks++
            if (this.idleTicks % 100 === 0) {
                this.increasePlanningSkill()
            }
            // Run idle planner when idle and planning available
            this.applyIdlePlanner(tick)
        } else {
            this.idleTicks = 0
        }
        return true
    }
    
    increasePlanningSkill() {
        this.increaseSkill('planning', 1)
        // Optionally, trigger events or unlock features as planning increases
    }

    scheduleNextDay() {
        // Build a basic next-day plan into the goal queue based on planning level
        const planning = this.getSkill('planning')
        if (planning < 1) return
        // Ensure survival tasks are present
        const base = [
            { type: 'find_water', priority: 2, description: 'Morning drink', targetType: 'resource', targetTags: ['water'], action: 'consume', completionReward: { thirst: -30 } },
            { type: 'find_food', priority: 2, description: 'Breakfast', targetType: 'resource', targetTags: ['food'], action: 'consume', completionReward: { hunger: -25 } }
        ]
        // Add enrichment based on skills
        if (planning >= 2) base.push({ type: 'explore', priority: 1, description: 'Survey nearby', targetType: 'location', action: 'explore' })
        if (planning >= 3) base.push({ type: 'study', priority: 1, description: 'Study at school', targetType: 'activity', action: 'learn', duration: 60 })
        // Prepend to tomorrow queue if empty
        this.goals.goalQueue.push(...base)
    }

    evaluateSkillUnlocks() {
        // Data-driven unlocks using SKILL_UNLOCKS table
        const newly = { skills: [], goals: [], recipes: [] }
        for (const unlock of SKILL_UNLOCKS) {
            // Skip if all unlock targets already granted
            const already = (
                (unlock.unlocks?.skills ?? []).every(sk => this.unlocked.skills.has(sk)) &&
                (unlock.unlocks?.goals ?? []).every(g => this.unlocked.goals.has(g)) &&
                (unlock.unlocks?.recipes ?? []).every(r => this.unlocked.recipes.has(r))
            )
            if (already) continue
            if (isUnlockSatisfied(this, unlock)) {
                for (const sk of (unlock.unlocks?.skills ?? [])) {
                    if (!this.unlocked.skills.has(sk)) {
                        this.unlocked.skills.add(sk)
                        newly.skills.push(sk)
                    }
                }
                for (const g of (unlock.unlocks?.goals ?? [])) {
                    if (!this.unlocked.goals.has(g)) {
                        this.unlocked.goals.add(g)
                        newly.goals.push(g)
                    }
                }
                for (const r of (unlock.unlocks?.recipes ?? [])) {
                    if (!this.unlocked.recipes.has(r)) {
                        this.unlocked.recipes.add(r)
                        newly.recipes.push(r)
                    }
                }
            }
        }
        if (newly.skills.length || newly.goals.length || newly.recipes.length) {
            emitUnlocks({ pawn: this, ...newly })
        }
    }

    applyIdlePlanner(tick) {
        if (!this.idlePlan?.enabled) return
        if (this.goals.currentGoal) return
        const planning = this.getSkill('planning')
        // Unlocks: with planning >= 1, enable study; >= 3, scheduled explore
        const canStudy = planning >= 0
        const canExplore = planning >= 3
        // Prefer proactive survival tasks (basic scheduling idea)
        const n = this.needs?.needs ?? {}
        const t = this.idlePlan.triggers
        if ((n.thirst ?? 0) >= t.thirst) {
            this.goals.goalQueue.unshift({
                type: 'find_water', priority: 2, description: 'Drink proactively',
                targetType: 'resource', targetTags: ['water'], action: 'consume', completionReward: { thirst: -40 }
            })
            this.goals.currentGoal = this.goals.goalQueue.shift()
            this.goals.startGoal(this.goals.currentGoal)
            return
        }
        if ((n.hunger ?? 0) >= t.hunger) {
            this.goals.goalQueue.unshift({
                type: 'find_food', priority: 2, description: 'Eat proactively',
                targetType: 'resource', targetTags: ['food'], action: 'consume', completionReward: { hunger: -35 }
            })
            this.goals.currentGoal = this.goals.goalQueue.shift()
            this.goals.startGoal(this.goals.currentGoal)
            return
        }
        if ((n.energy ?? 0) >= t.energy) {
            this.goals.goalQueue.unshift({
                type: 'rest', priority: 2, description: 'Rest proactively',
                targetType: 'resource', targetTags: ['cover'], action: 'use', duration: 8, completionReward: { energy: -40 }
            })
            this.goals.currentGoal = this.goals.goalQueue.shift()
            this.goals.startGoal(this.goals.currentGoal)
            return
        }
        // Otherwise, pick an idle enrichment task
        // Prioritize gathering if inventory is low
        const invCount = this.inventory?.length ?? 0
        if (invCount < 5 && Math.random() < 0.4) {
            this.goals.currentGoal = {
                type: 'gather_materials',
                priority: 1,
                description: 'Gather resources',
                completionReward: { purpose: -10 }
            }
            this.goals.startGoal(this.goals.currentGoal)
            return
        }
        if (canStudy && this.idlePlan.tasks.includes('study')) {
            const dur = this.idlePlan.studyDuration
            this.goals.currentGoal = {
                type: 'study', priority: 1, description: 'Study and plan',
                targetType: 'activity', action: 'learn', duration: dur, completionReward: { knowledge: -10 }
            }
            this.goals.startGoal(this.goals.currentGoal)
            return
        }
        if (canExplore && this.idlePlan.tasks.includes('explore')) {
            this.goals.currentGoal = {
                type: 'explore', priority: 1, description: 'Wander and observe',
                targetType: 'location', action: 'explore'
            }
            this.goals.startGoal(this.goals.currentGoal)
        }
    }
    
    // Get status information for debugging/UI
    getStatus() {
        const mostUrgent = this.needs.getMostUrgentNeed()
        return {
            position: { x: this.x, y: this.y },
            behaviorState: this.behaviorState,
            currentGoal: this.goals.currentGoal?.type || 'none',
            mostUrgentNeed: mostUrgent.need,
            needValue: Math.round(mostUrgent.value),
            urgency: mostUrgent.urgency,
            inventoryCount: this.inventory.length
        }
    }

    setPriorityBias(bias) {
        // bias: { nextGoal?: {type, description, targetType, ...} }
        this.priorityBias = bias
    }
    
    // === User Intervention Methods ===
    
    setGoalPriorities(priorities) {
        // User can reorder goal priorities
        // priorities: { needType: multiplier }
        // Example: { hunger: 1.5, social: 0.5 } makes hunger 50% more urgent, social 50% less
        this.goalPriorityMultipliers = priorities
    }
    
    getAdjustedNeedPriority(need, baseValue) {
        const multiplier = this.goalPriorityMultipliers?.[need] ?? 1.0
        return baseValue * multiplier
    }
    
    assignArbitraryGoal(goalConfig) {
        // User can directly assign a goal
        // goalConfig: { type, description, priority, targetType, ... }
        console.log(`${this.name} received user-assigned goal: ${goalConfig.description}`)
        
        // Add to front of goal queue with high priority
        this.goals.goalQueue.unshift({
            ...goalConfig,
            priority: 10, // Override priority
            userAssigned: true
        })
        
        // If idle, start immediately
        if (!this.goals.currentGoal || this.behaviorState === 'idle') {
            this.goals.currentGoal = this.goals.goalQueue.shift()
            this.goals.startGoal(this.goals.currentGoal)
        }
    }
    
    setResourceValuePreferences(preferences) {
        // User can adjust how valuable different resources are perceived
        // preferences: { resourceType: value } where value is 0-1
        // Example: { fiber: 0.9, rock: 0.5 } makes fiber highly valued, rock less so
        this.resourceValuePreferences = preferences
    }
    
    getResourceValue(resourceType, context = {}) {
        const basePreference = this.resourceValuePreferences?.[resourceType] ?? 0.5
        const domain = this.getMaterialDomain(resourceType)
        const materialStats = this.resourceSpecialization.materials?.[resourceType] ?? { encounters: 0 }
        const domainStats = this.resourceSpecialization.domains?.[domain] ?? { encounters: 0 }

        const materialFamiliarity = Math.min(0.2, (materialStats.encounters ?? 0) * 0.01)
        const domainFamiliarity = Math.min(0.2, (domainStats.encounters ?? 0) * 0.005)

        let specializationBonus = materialFamiliarity + domainFamiliarity

        const isWoodLike = domain === 'woods' || /stick|branch|timber|plank|log|shaft|pole/i.test(resourceType)
        if (isWoodLike) {
            const intent = context.intent ?? 'general'
            const woodAffinity = this.getWoodUseAffinity(intent)
            specializationBonus += woodAffinity * 0.25
        }

        if (domain === 'agriculture') {
            const soilMatch = context.soilType && this.resourceSpecialization.knownSoilTypes.has(context.soilType)
            const seedMatch = context.seedType && this.resourceSpecialization.knownSeedTypes.has(context.seedType)
            if (soilMatch) specializationBonus += 0.08
            if (seedMatch) specializationBonus += 0.08
        }

        return Math.max(0, Math.min(1, basePreference + specializationBonus))
    }

    getMaterialGroups() {
        return {
            ...(INVENTION_CONFIG?.materialGroups ?? {}),
            agriculture: ['seed', 'grain', 'crop', 'wheat', 'corn', 'barley', 'rice', 'soil', 'loam', 'clay', 'silt', 'berry', 'vegetable', 'fruit']
        }
    }

    getMaterialDomain(materialType) {
        if (!materialType || typeof materialType !== 'string') return 'unknown'

        const normalized = materialType.toLowerCase()
        if (/seed|grain|crop|wheat|corn|barley|rice|soil|loam|clay|silt|berry|vegetable|fruit/.test(normalized)) {
            return 'agriculture'
        }

        for (const [domain, materials] of Object.entries(this.getMaterialGroups())) {
            const matches = materials.some(material => {
                const token = String(material).toLowerCase()
                return normalized === token || normalized.includes(token)
            })
            if (matches) return domain
        }

        return 'unknown'
    }

    getWoodUseAffinity(intent = 'general') {
        const profile = this.resourceSpecialization.woodUse ?? { tool: 0, weapon: 0, construction: 0 }
        if (intent === 'tool') return Math.min(1, profile.tool)
        if (intent === 'weapon') return Math.min(1, profile.weapon)
        if (intent === 'construction') return Math.min(1, profile.construction)

        const maxAffinity = Math.max(profile.tool ?? 0, profile.weapon ?? 0, profile.construction ?? 0)
        return Math.min(1, maxAffinity)
    }

    classifyWoodUse(material) {
        const type = String(material?.type ?? '').toLowerCase()
        const tags = Array.isArray(material?.tags) ? material.tags.map(t => String(t).toLowerCase()) : []

        const profile = {
            tool: 0.02,
            weapon: 0.02,
            construction: 0.02
        }

        if (/shaft|straight|hardwood|handle/.test(type) || tags.includes('tool')) profile.tool += 0.06
        if (/spear|staff|pole|flex|branch/.test(type) || tags.includes('weapon')) profile.weapon += 0.06
        if (/timber|log|plank|beam|sturdy|thick/.test(type) || tags.includes('construction')) profile.construction += 0.08

        if (type === 'stick') {
            profile.tool += 0.03
            profile.weapon += 0.03
            profile.construction += 0.02
        }

        return profile
    }

    updateResourceSpecialization(material) {
        if (!material?.type) return

        const type = material.type
        const domain = this.getMaterialDomain(type)

        this.resourceSpecialization.materials[type] = this.resourceSpecialization.materials[type] ?? { encounters: 0 }
        this.resourceSpecialization.materials[type].encounters++

        this.resourceSpecialization.domains[domain] = this.resourceSpecialization.domains[domain] ?? { encounters: 0 }
        this.resourceSpecialization.domains[domain].encounters++

        const soilType = material.soilType ?? material.soil
        const seedType = material.seedType ?? material.seed
        if (soilType) this.resourceSpecialization.knownSoilTypes.add(soilType)
        if (seedType) this.resourceSpecialization.knownSeedTypes.add(seedType)

        if (domain === 'agriculture') {
            this.increaseSkill('agronomy', 0.05)
            this.increaseSkill('materialAppraisal', 0.02)
        }

        if (domain === 'woods') {
            const woodProfile = this.classifyWoodUse(material)
            this.resourceSpecialization.woodUse.tool = Math.min(1, (this.resourceSpecialization.woodUse.tool ?? 0) + woodProfile.tool)
            this.resourceSpecialization.woodUse.weapon = Math.min(1, (this.resourceSpecialization.woodUse.weapon ?? 0) + woodProfile.weapon)
            this.resourceSpecialization.woodUse.construction = Math.min(1, (this.resourceSpecialization.woodUse.construction ?? 0) + woodProfile.construction)
            this.increaseSkill('materialAppraisal', 0.03)
        }
    }
    
    adjustInventionRate(multiplier) {
        // User can speed up or slow down invention discoveries
        // multiplier: 0.5 = half as fast, 2.0 = twice as fast
        this.inventionRateMultiplier = Math.max(0.1, Math.min(5.0, multiplier))
    }
    
    // Enhanced pondering with user intervention support
    getEffectiveInventionChance(baseChance) {
        const multiplier = this.inventionRateMultiplier ?? 1.0
        return baseChance * multiplier
    }
    
    // Method to set world reference for resource finding
    setWorldAccess(chunkManager) {
        this.chunkManager = chunkManager
    }

    rememberLandmark({x, y, type, significance = 1, name = null, event = null}) {
        // Remove least significant or oldest if at max
        if (this.memoryMap.length >= this.maxLandmarks) {
            this.memoryMap.sort((a, b) => (a.significance ?? 1) - (b.significance ?? 1))
            this.memoryMap.shift()
        }
        this.memoryMap.push({
            x, y, type, significance, name, event,
            timestamp: Date.now()
        })
    }

    forgetLandmark(nameOrType) {
        this.memoryMap = this.memoryMap.filter(lm => lm.name !== nameOrType && lm.type !== nameOrType)
    }

    reinforceLandmark(nameOrType, amount = 1) {
        for (const lm of this.memoryMap) {
            if (lm.name === nameOrType || lm.type === nameOrType) {
                lm.significance = (lm.significance ?? 1) + amount
            }
        }
    }

    nameLandmark(x, y, name) {
        const lm = this.memoryMap.find(l => l.x === x && l.y === y)
        if (lm) lm.name = name
    }

    shareLandmarksWith(otherPawn) {
        // Share degraded info based on storytelling skill
        for (const lm of this.memoryMap) {
            const degraded = { ...lm }
            if (this.getSkill('storytelling') < 3) {
                degraded.significance = Math.max(1, (degraded.significance ?? 1) - 1)
                degraded.name = null
            }
            otherPawn.rememberLandmark(degraded)
        }
    }

    getVisibleLandmarks(currentX, currentY, range = 100) {
        return this.memoryMap.map(lm => {
            const dist = Math.sqrt((lm.x - currentX) ** 2 + (lm.y - currentY) ** 2)
            return {
                ...lm,
                faded: dist > range,
                fog: dist > range * 2
            }
        })
    }

    rememberResource(entity) {
        // Remember resource location for future planning
        if (!entity?.x || !entity?.y || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return
        
        const tick = this.world?.clock?.currentTick ?? 0
        const resourceType = entity.subtype || entity.type
        
        if (!resourceType || typeof resourceType !== 'string') {
            console.warn(`${this.name} tried to remember resource without valid type:`, entity)
            return
        }

        const canCluster = this.memoryPhase >= 3 || this.getSkill('memoryClustering') >= 10
        const clusteringSkill = this.getSkill('memoryClustering')
        const clusterRadius = Math.min(45, 18 + clusteringSkill * 0.8)

        if (canCluster) {
            const cluster = this.resourceMemory.find(r => {
                if (r.type !== resourceType) return false
                const dx = r.x - entity.x
                const dy = r.y - entity.y
                return Math.sqrt(dx * dx + dy * dy) <= clusterRadius
            })

            if (cluster) {
                const priorCount = Math.max(1, cluster.clusterCount ?? 1)
                const nextCount = priorCount + 1

                cluster.x = ((cluster.x * priorCount) + entity.x) / nextCount
                cluster.y = ((cluster.y * priorCount) + entity.y) / nextCount
                cluster.clusterCount = nextCount
                cluster.amount = Math.max(cluster.amount ?? 1, entity.amount ?? 1)
                cluster.lastSeen = tick
                cluster.id = entity.id
                cluster.confidence = Math.min(1.0, (cluster.confidence ?? 0.5) + 0.03)

                this.increaseSkill('memoryClustering', 0.04)
                return
            }
        }
        
        // Check if already remembered (same location and type)
        const existing = this.resourceMemory.find(r => {
            const dx = Math.abs(r.x - entity.x)
            const dy = Math.abs(r.y - entity.y)
            return dx < 5 && dy < 5 && r.type === resourceType
        })
        
        if (existing) {
            existing.lastSeen = tick
            existing.amount = entity.amount ?? 1
            existing.x = entity.x // Update to exact location
            existing.y = entity.y
            return
        }

        const nearbySameType = this.resourceMemory.some(r => {
            if (r.type !== resourceType) return false
            const dx = r.x - entity.x
            const dy = r.y - entity.y
            return Math.sqrt(dx * dx + dy * dy) <= 25
        })

        if (nearbySameType) {
            this.increaseSkill('memoryClustering', 0.02)
        }
        
        // Add new memory
        if (this.resourceMemory.length >= this.maxResourceMemory) {
            // Phase 1-2: Remove based on confidence or age
            // Phase 3+: Cluster compression will handle this differently
            if (this.memoryPhase <= 2) {
                // Remove least confident or oldest
                this.resourceMemory.sort((a, b) => {
                    const confA = a.confidence ?? 0.5
                    const confB = b.confidence ?? 0.5
                    const ageA = tick - a.lastSeen
                    const ageB = tick - b.lastSeen
                    // Prioritize removing low confidence and old memories
                    return (confA - ageA * 0.001) - (confB - ageB * 0.001)
                })
                const removed = this.resourceMemory.shift()
                if (!removed) return // Safety check: ensure we removed something
            }
        }
        
        // Calculate initial confidence based on observation
        const initialConfidence = 0.7 // Start optimistic
        
        // Determine memory phase for this entry
        const memPhase = this.memoryPhase
        
        this.resourceMemory.push({
            type: resourceType,
            tags: entity.tags ? (Array.isArray(entity.tags) ? [...entity.tags] : Array.from(entity.tags)) : [],
            x: entity.x,
            y: entity.y,
            lastSeen: tick,
            amount: entity.amount ?? 1,
            id: entity.id,
            successCount: 0,
            failCount: 0,
            confidence: initialConfidence,
            memoryPhase: memPhase,
            clusterCount: 1,
            source: 'self'
        })
        
        if (Math.random() < 0.05) {
            // Occasional logging (5% chance)
            console.log(`${this.name} remembered ${resourceType} at (${Math.round(entity.x)}, ${Math.round(entity.y)}). Total memory: ${this.resourceMemory.length}, Phase: ${memPhase}`)
        }
    }

    updateResourceMemoryConfidence(resource, success) {
        // Update confidence when gathering succeeds or fails
        if (!resource?.x || !resource?.y) return
        
        const tick = this.world?.clock?.currentTick ?? 0
        const resourceType = resource.subtype || resource.type
        const memory = this.resourceMemory.find(r => {
            const dx = Math.abs(r.x - resource.x)
            const dy = Math.abs(r.y - resource.y)
            return dx < 5 && dy < 5 && r.type === resourceType
        })
        
        if (memory) {
            memory.lastVisited = tick

            if (success) {
                memory.successCount = (memory.successCount ?? 0) + 1
                memory.revisitFailStreak = 0
                const recoveryBoost = Math.min(0.06, (memory.failCount ?? 0) * 0.01)
                memory.confidence = Math.min(1.0, (memory.confidence ?? 0.5) + 0.12 + recoveryBoost)
            } else {
                memory.failCount = (memory.failCount ?? 0) + 1
                memory.revisitFailStreak = (memory.revisitFailStreak ?? 0) + 1
                const revisitPenalty = Math.min(0.35, 0.16 + memory.revisitFailStreak * 0.05)
                memory.confidence = Math.max(0.0, (memory.confidence ?? 0.5) - revisitPenalty)
            }
            
            // Remove if confidence drops too low
            if (memory.confidence < 0.2) {
                this.resourceMemory = this.resourceMemory.filter(r => r !== memory)
                if (Math.random() < 0.1) {
                    console.log(`${this.name} forgot unreliable ${resourceType} location (confidence: ${memory.confidence.toFixed(2)})`)
                }
            }
        }

        this.broadcastGatheringObservation(resource, success)
    }

    observeGatheringOutcome(outcome = {}, observerWeight = 1) {
        const type = outcome.type
        const x = outcome.x
        const y = outcome.y
        const success = outcome.success === true

        if (!type || typeof type !== 'string') return
        if (!Number.isFinite(x) || !Number.isFinite(y)) return

        const tick = this.world?.clock?.currentTick ?? 0
        const normalizedWeight = Math.max(0.5, Math.min(1.5, observerWeight))

        const memory = this.resourceMemory.find(r => {
            if (r.type !== type) return false
            const dx = r.x - x
            const dy = r.y - y
            return Math.sqrt(dx * dx + dy * dy) <= 20
        })

        if (!memory) {
            if (success) {
                this.learnResourceLocation({
                    type,
                    x,
                    y,
                    confidence: 0.4 * normalizedWeight,
                    clusterCount: 1,
                    sourcePawnId: outcome.sourcePawnId ?? null
                })
            }
            return
        }

        memory.lastObservedAt = tick

        if (success) {
            memory.observedSuccessCount = (memory.observedSuccessCount ?? 0) + 1
            memory.confidence = Math.min(1.0, (memory.confidence ?? 0.5) + 0.05 * normalizedWeight)
            this.increaseSkill('routePlanning', 0.01 * normalizedWeight)
        } else {
            memory.observedFailCount = (memory.observedFailCount ?? 0) + 1
            memory.confidence = Math.max(0.0, (memory.confidence ?? 0.5) - 0.04 * normalizedWeight)
        }
    }

    broadcastGatheringObservation(resource, success) {
        if (!this.world?.entitiesMap) return

        const resourceType = resource?.subtype || resource?.type
        if (!resourceType) return

        const sourceInfluence = 0.9 + Math.min(0.4, this.getSkill('storytelling') * 0.01)
        const outcome = {
            type: resourceType,
            x: resource.x,
            y: resource.y,
            success,
            sourcePawnId: this.id
        }

        for (const entity of this.world.entitiesMap.values()) {
            if (entity === this || entity?.subtype !== 'pawn') continue

            const dx = entity.x - this.x
            const dy = entity.y - this.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance > 120) continue

            const distanceWeight = 1 - (distance / 160)
            const observerWeight = Math.max(0.5, distanceWeight * sourceInfluence)
            entity.observeGatheringOutcome?.(outcome, observerWeight)
        }
    }

    updateMemoryPhase() {
        // Advance memory phase based on orienteering and cartography skills
        const orienteering = this.getSkill('orienteering')
        const cartography = this.getSkill('cartography')
        
        if (cartography >= 50) {
            this.memoryPhase = 4 // Conceptual maps
            this.maxResourceMemory = 100 // Can remember almost everything
        } else if (cartography >= 25) {
            this.memoryPhase = 3 // Cluster memory
            this.maxResourceMemory = 60
        } else if (orienteering >= 15) {
            this.memoryPhase = 2 // Allocentric (compass directions)
            this.maxResourceMemory = 40
        } else {
            this.memoryPhase = 1 // Egocentric (direction-based)
            this.maxResourceMemory = 20
        }
    }

    getResourceDirection(memory) {
        // Get direction description based on memory phase
        const dx = memory.x - this.x
        const dy = memory.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (this.memoryPhase === 1) {
            // Phase 1: Egocentric - relative to current facing
            // "behind me at 5 o'clock"
            const angle = Math.atan2(dy, dx)
            const clockPos = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 12) % 12 || 12
            const ahead = clockPos >= 11 || clockPos <= 1
            const behind = clockPos >= 5 && clockPos <= 7
            const left = clockPos >= 2 && clockPos <= 4
            const right = clockPos >= 8 && clockPos <= 10
            
            let dir = ''
            if (ahead) dir = 'ahead'
            else if (behind) dir = 'behind'
            else if (left) dir = 'to the left'
            else if (right) dir = 'to the right'
            
            return `${dir} at ${clockPos} o'clock, ~${Math.round(distance)} steps`
        } else if (this.memoryPhase >= 2) {
            // Phase 2+: Allocentric - compass directions from origin
            const originDx = memory.x - this.memoryOrigin.x
            const originDy = memory.y - this.memoryOrigin.y
            const compass = this.getCompassDirection(originDx, originDy)
            const dist = Math.round(Math.sqrt(originDx * originDx + originDy * originDy))
            
            return `~${dist}m ${compass} of origin`
        }
        
        return `~${Math.round(distance)} steps away`
    }

    getCompassDirection(dx, dy) {
        // Convert dx/dy to compass direction (N, NE, E, SE, S, SW, W, NW)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        const normalized = (angle + 360 + 90) % 360 // Rotate so N is 0
        
        if (normalized < 22.5 || normalized >= 337.5) return 'N'
        if (normalized < 67.5) return 'NE'
        if (normalized < 112.5) return 'E'
        if (normalized < 157.5) return 'SE'
        if (normalized < 202.5) return 'S'
        if (normalized < 247.5) return 'SW'
        if (normalized < 292.5) return 'W'
        return 'NW'
    }

    recallResourcesByType(type) {
        // Find remembered resources of the specified type
        const tick = this.world?.clock?.currentTick ?? 0
        const maxAge = 2000
        const minConfidence = 0.2
        
        // Memory decay: remove very stale or low-confidence memories
        this.resourceMemory = this.resourceMemory.filter(r => {
            if ((tick - r.lastSeen) > maxAge) return false // Remove stale memories
            const conf = r.confidence ?? 0.5
            if (conf < 0.1) return false // Remove very low confidence memories
            return true
        })
        
        return this.resourceMemory
            .filter(r => {
                const conf = r.confidence ?? 0.5
                return r.type === type && (tick - r.lastSeen) < maxAge && conf >= minConfidence
            })
            .sort((a, b) => {
                // Prioritize by confidence, recency, and distance
                const distA = Math.sqrt((this.x - a.x) ** 2 + (this.y - a.y) ** 2)
                const distB = Math.sqrt((this.x - b.x) ** 2 + (this.y - b.y) ** 2)
                const ageA = tick - a.lastSeen
                const ageB = tick - b.lastSeen
                const confA = a.confidence ?? 0.5
                const confB = b.confidence ?? 0.5
                const clusterA = a.clusterCount ?? 1
                const clusterB = b.clusterCount ?? 1
                const observedSignalA = ((a.observedSuccessCount ?? 0) * 7) - ((a.observedFailCount ?? 0) * 4)
                const observedSignalB = ((b.observedSuccessCount ?? 0) * 7) - ((b.observedFailCount ?? 0) * 4)
                const routeSkill = this.getSkill('routePlanning')
                const clusterWeight = routeSkill >= 5 ? 6 : 0
                
                // Weight: confidence most important, then distance, then age
                return (distA + ageA * 0.1 - confA * 100 - clusterA * clusterWeight - observedSignalA) - (distB + ageB * 0.1 - confB * 100 - clusterB * clusterWeight - observedSignalB)
            })
    }

    planGatheringRoute(requirements = []) {
        if (!Array.isArray(requirements) || requirements.length === 0) return []

        const routeSkill = this.getSkill('routePlanning')
        const usesOptimizedRoute = routeSkill >= 5
        const route = []

        let currentX = this.x
        let currentY = this.y

        for (const requirement of requirements) {
            const type = requirement?.type
            const count = requirement?.count ?? 1

            if (!type) continue

            const memories = this.recallResourcesByType(type)

            if (!memories.length) {
                route.push({
                    type,
                    count,
                    location: null,
                    fromMemory: false
                })
                continue
            }

            let selected = memories[0]

            if (usesOptimizedRoute) {
                selected = [...memories].sort((a, b) => {
                    const distA = Math.sqrt((a.x - currentX) ** 2 + (a.y - currentY) ** 2)
                    const distB = Math.sqrt((b.x - currentX) ** 2 + (b.y - currentY) ** 2)
                    const routeObservationWeight = routeSkill >= 8 ? 12 : 6
                    const observedSignalA = ((a.observedSuccessCount ?? 0) * routeObservationWeight) - ((a.observedFailCount ?? 0) * (routeObservationWeight * 0.75))
                    const observedSignalB = ((b.observedSuccessCount ?? 0) * routeObservationWeight) - ((b.observedFailCount ?? 0) * (routeObservationWeight * 0.75))
                    const scoreA = distA - ((a.confidence ?? 0.5) * 40) - ((a.clusterCount ?? 1) * 10) - observedSignalA
                    const scoreB = distB - ((b.confidence ?? 0.5) * 40) - ((b.clusterCount ?? 1) * 10) - observedSignalB
                    return scoreA - scoreB
                })[0]
            }

            route.push({
                type,
                count,
                location: { x: selected.x, y: selected.y },
                fromMemory: true,
                clusterCount: selected.clusterCount ?? 1,
                confidence: selected.confidence ?? 0.5
            })

            currentX = selected.x
            currentY = selected.y
        }

        if (route.length > 1) {
            this.increaseSkill('routePlanning', usesOptimizedRoute ? 0.05 : 0.02)
        }

        return route
    }

    shareResourceMemory(otherPawn, options = {}) {
        if (!otherPawn || otherPawn === this) return 0

        const maxShare = options.maxShare ?? 3
        const minConfidence = options.minConfidence ?? 0.6

        const sharable = this.resourceMemory
            .filter(mem => (mem.confidence ?? 0.5) >= minConfidence)
            .sort((a, b) => {
                const confDelta = (b.confidence ?? 0.5) - (a.confidence ?? 0.5)
                if (confDelta !== 0) return confDelta
                return (b.clusterCount ?? 1) - (a.clusterCount ?? 1)
            })
            .slice(0, maxShare)

        if (!sharable.length) return 0

        let sharedCount = 0
        for (const memory of sharable) {
            const accepted = otherPawn.learnResourceLocation?.({
                type: memory.type,
                x: memory.x,
                y: memory.y,
                confidence: Math.max(0.3, (memory.confidence ?? 0.5) * 0.85),
                clusterCount: memory.clusterCount ?? 1,
                sourcePawnId: this.id
            })

            if (accepted) sharedCount++
        }

        if (sharedCount > 0) {
            this.increaseSkill('storytelling', 0.03 * sharedCount)
            this.increaseSkill('routePlanning', 0.01 * sharedCount)
        }

        return sharedCount
    }

    learnResourceLocation(knowledge = {}) {
        const type = knowledge.type
        const x = knowledge.x
        const y = knowledge.y

        if (!type || typeof type !== 'string') return false
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false

        const tick = this.world?.clock?.currentTick ?? 0
        const incomingConfidence = Math.max(0, Math.min(1, knowledge.confidence ?? 0.5))
        const incomingClusterCount = Math.max(1, knowledge.clusterCount ?? 1)

        const existing = this.resourceMemory.find(mem => {
            if (mem.type !== type) return false
            const dx = mem.x - x
            const dy = mem.y - y
            return Math.sqrt(dx * dx + dy * dy) <= 20
        })

        if (existing) {
            existing.confidence = Math.min(1, (existing.confidence ?? 0.5) + incomingConfidence * 0.2)
            existing.clusterCount = Math.max(existing.clusterCount ?? 1, incomingClusterCount)
            existing.lastSeen = tick
            existing.source = 'shared'
            this.increaseSkill('memoryClustering', 0.02)
            return true
        }

        if (this.resourceMemory.length >= this.maxResourceMemory) {
            this.resourceMemory.sort((a, b) => (a.confidence ?? 0.5) - (b.confidence ?? 0.5))
            this.resourceMemory.shift()
        }

        this.resourceMemory.push({
            type,
            tags: [],
            x,
            y,
            lastSeen: tick,
            amount: 1,
            id: null,
            successCount: 0,
            failCount: 0,
            confidence: incomingConfidence,
            memoryPhase: this.memoryPhase,
            clusterCount: incomingClusterCount,
            source: 'shared',
            sharedBy: knowledge.sourcePawnId ?? null
        })

        this.increaseSkill('memoryClustering', 0.03)
        return true
    }

    recallResourcesByTag(tag) {
        // Find remembered resources with matching tag
        const tick = this.world?.clock?.currentTick ?? 0
        const maxAge = 2000
        const minConfidence = 0.2
        
        return this.resourceMemory
            .filter(r => {
                const conf = r.confidence ?? 0.5
                return r.tags?.includes(tag) && (tick - r.lastSeen) < maxAge && conf >= minConfidence
            })
            .sort((a, b) => {
                const distA = Math.sqrt((this.x - a.x) ** 2 + (this.y - a.y) ** 2)
                const distB = Math.sqrt((this.x - b.x) ** 2 + (this.y - b.y) ** 2)
                const confA = a.confidence ?? 0.5
                const confB = b.confidence ?? 0.5
                
                // Confidence-weighted distance
                return (distA - confA * 50) - (distB - confB * 50)
            })
    }

    // === Invention & Pondering ===
    
    ponderProblem(problemType, context = {}) {
        // Check if already pondering this problem
        const alreadyQueued = this.ponderingQueue.some(p => p.type === problemType)
        if (alreadyQueued) return
        
        // Add to pondering queue
        this.ponderingQueue.push({
            type: problemType,
            context,
            timestamp: Date.now(),
            attempts: 0
        })
        
        console.log(`${this.name} begins pondering: ${problemType}`)
    }
    
    processPonderingQueue() {
        if (this.ponderingQueue.length === 0) return
        if (this.ponderingCooldown > 0) {
            this.ponderingCooldown--
            return
        }
        
        // Take first problem from queue
        const problem = this.ponderingQueue[0]
        problem.attempts++
        
        const invention = this.getSkill('invention')
        const experimentation = this.getSkill('experimentation')
        
        // Base chance: 1% per invention level + 0.5% per experimentation level
        let baseChance = (invention * 0.01) + (experimentation * 0.005)
        
        // Bonus from attempts (persistence pays off)
        const attemptBonus = Math.min(0.15, problem.attempts * 0.01)
        
        // Success path preference: boost chance if we've succeeded with similar solutions
        const successBonus = this.calculateSuccessPathBonus(problem.type)
        
        // Observation bonus: easier if we've seen it done
        const observationBonus = problem.context?.inspiration === 'observed' ? 0.1 : 0
        
        // Lateral learning bonus: easier if we know similar things
        const lateralBonus = this.calculateLateralLearningBonus(problem.type, problem.context)
        
        let totalChance = baseChance + attemptBonus + successBonus + observationBonus + lateralBonus
        
        // Apply user intervention multiplier
        totalChance = this.getEffectiveInventionChance(totalChance)
        
        // Try to solve the problem
        if (Math.random() < totalChance) {
            const solution = this.discoverSolution(problem.type, problem.context)
            if (solution) {
                console.log(`💡 ${this.name} has an epiphany: ${solution.name}!`)
                this.discoveredSolutions.add(solution.id)
                
                // Initialize success tracking
                this.solutionSuccessCount[solution.id] = 0
                
                // Grant experience (more for harder discoveries)
                const xpMultiplier = 1 + (problem.attempts * 0.1)
                this.increaseSkill('invention', (10 + problem.attempts * 2) * xpMultiplier)
                this.increaseSkill('experimentation', (5 + problem.attempts) * xpMultiplier)
                
                // Remove from queue
                this.ponderingQueue.shift()
                
                // Set cooldown before next pondering
                this.ponderingCooldown = 100
                
                return solution
            }
        }
        
        // If spent too long on this problem, give up for now
        if (problem.attempts > 20) {
            console.log(`${this.name} sets aside the problem of ${problem.type} for now`)
            this.ponderingQueue.shift()
        }
        
        // Small cooldown between attempts
        this.ponderingCooldown = 10
        
        return null
    }
    
    calculateSuccessPathBonus(problemType) {
        // Boost discovery if we've had success with related solutions
        const relatedDomains = {
            'inventory_full': ['basket_concept', 'container_concept', 'storage_concept'],
            'need_water_container': ['container_concept', 'basket_concept'],
            'need_better_tools': ['stone_tool_concept', 'advanced_tool_concept'],
            'need_shelter': ['shelter_concept', 'construction_basics'],
            'material_substitution': ['basket_concept', 'cordage_concept']
        }
        
        const related = relatedDomains[problemType] || []
        let totalSuccess = 0
        
        for (const solutionId of related) {
            totalSuccess += this.solutionSuccessCount[solutionId] ?? 0
        }
        
        // 2% bonus per success, capped at 20%
        return Math.min(0.2, totalSuccess * 0.02)
    }
    
    calculateLateralLearningBonus(problemType, context) {
        // Easier if we know similar materials/crafts
        if (problemType.startsWith('learn_craft_')) {
            const itemType = context?.itemType
            if (this.observedCrafts.has(itemType)) {
                return 0.15 // 15% bonus if observed
            }
        }
        
        if (problemType === 'material_substitution') {
            const newMaterial = context?.newMaterial
            if (this.knownMaterials.has(newMaterial)) {
                return 0.1 // 10% bonus if we know the material
            }
        }
        
        return 0
    }
    
    discoverSolution(problemType, context) {
        // Map problems to their solutions
        const solutions = {
            inventory_full: {
                id: 'basket_concept',
                name: 'Basket Weaving',
                type: 'recipe',
                description: 'Could weave plant fibers into a basket for carrying',
                unlocks: 'basket',
                domain: 'weaving'
            },
            need_water_container: {
                id: 'container_concept',
                name: 'Container Crafting',
                type: 'recipe',
                description: 'Need something to hold water... perhaps a woven container?',
                unlocks: 'water_basket',
                domain: 'weaving'
            },
            need_better_tools: {
                id: 'stone_tool_concept',
                name: 'Stone Tool Making',
                type: 'recipe',
                description: 'Shaping stones could make better tools',
                unlocks: 'sharp_stone',
                domain: 'knapping'
            },
            need_shelter: {
                id: 'shelter_concept',
                name: 'Basic Shelter',
                type: 'recipe',
                description: 'Arranging sticks and cover could provide shelter',
                unlocks: 'basic_shelter',
                domain: 'construction_basics'
            },
            material_substitution: {
                id: `${context?.originalSolution}_variant_${context?.newMaterial}`,
                name: `Alternative ${context?.originalSolution} Method`,
                type: 'recipe_variant',
                description: `Could use ${context?.newMaterial} instead...`,
                unlocks: `${context?.originalSolution}_${context?.newMaterial}`,
                domain: 'experimentation'
            },
            inspired_invention: {
                id: `inspired_${context?.inspiration}`,
                name: `${context?.inspiration} Innovation`,
                type: 'inspired',
                description: `Inspired by stories of ${context?.inspiration}`,
                unlocks: this.findInspiredRecipe(context),
                domain: 'invention'
            }
        }
        
        // Handle dynamic problem types (e.g., learn_craft_cordage)
        if (problemType.startsWith('learn_craft_')) {
            const itemType = problemType.replace('learn_craft_', '')
            const solution = {
                id: `${itemType}_concept`,
                name: `${itemType} Crafting`,
                type: 'observed_recipe',
                description: `Learned by observing ${context?.crafter || 'others'}`,
                unlocks: itemType,
                domain: 'observation'
            }
            
            // Check requirements
            if (this.discoveredSolutions.has(solution.id)) return null
            
            // Easier requirements for observed crafts
            const observationSkill = this.getSkill('invention')
            if (observationSkill < 2) return null
            
            return solution
        }
        
        const solution = solutions[problemType]
        if (!solution) return null
        
        // Check if already discovered
        if (this.discoveredSolutions.has(solution.id)) return null
        
        // Check if has necessary knowledge/skills
        const requirements = {
            basket_concept: () => {
                const gathering = this.getSkill('gathering')
                const weaving = this.getSkill('weaving')
                return gathering >= 3 || weaving >= 1
            },
            container_concept: () => {
                const gathering = this.getSkill('gathering')
                const weaving = this.getSkill('weaving')
                const invention = this.getSkill('invention')
                return (gathering >= 5 || weaving >= 2) && invention >= 2
            },
            stone_tool_concept: () => {
                const knapping = this.getSkill('knapping')
                const crafting = this.getSkill('crafting')
                return knapping >= 1 || crafting >= 5
            },
            shelter_concept: () => {
                const construction = this.getSkill('construction_basics')
                const crafting = this.getSkill('crafting')
                const invention = this.getSkill('invention')
                return (construction >= 1 || crafting >= 3) && invention >= 3
            }
        }
        
        const meetsRequirements = requirements[solution.id]?.() ?? true
        if (!meetsRequirements) return null
        
        return solution
    }
    
    findInspiredRecipe(context) {
        // Map legendary stories to potential recipes
        const inspirationMap = {
            'hero': 'legendary_weapon',
            'builder': 'advanced_structure',
            'healer': 'potent_medicine',
            'explorer': 'navigation_tool'
        }
        
        return inspirationMap[context?.tags?.[0]] || 'special_craft'
    }
    
    hasSolution(solutionId) {
        return this.discoveredSolutions.has(solutionId)
    }
    
    // === Skill Synergy System ===
    
    // Skill synergy table: related skills that boost each other
    getSkillSynergies() {
        return {
            weaving: ['basketry', 'textile_work', 'rope_craft', 'gathering'],
            basketry: ['weaving', 'gathering', 'construction_basics'],
            knapping: ['stonework', 'tool_making', 'mining'],
            herbalism: ['gathering', 'alchemy', 'medicine', 'foraging'],
            alchemy: ['herbalism', 'medicine', 'poisoncraft', 'chemistry'],
            medicine: ['herbalism', 'alchemy', 'surgery', 'anatomy'],
            construction_basics: ['carpentry', 'engineering', 'planning'],
            tailoring: ['weaving', 'leather_work', 'armor_repair'],
            leather_work: ['tailoring', 'hunting', 'skinning'],
            hunting: ['tracking', 'archery', 'spear_fighting', 'butchery'],
            tracking: ['hunting', 'orienteering', 'survival'],
            gathering: ['herbalism', 'foraging', 'weaving', 'survival']
        }
    }
    
    calculateSynergyBonus(primarySkill) {
        const synergies = this.getSkillSynergies()
        const relatedSkills = synergies[primarySkill] || []
        
        let bonus = 0
        for (const skill of relatedSkills) {
            const level = this.getSkill(skill)
            bonus += level * 0.005 // 0.5% per level of related skill
        }
        
        return Math.min(0.3, bonus) // Cap at 30% bonus
    }
    
    // === Social Learning & Observation ===
    
    observeCraftedItem(item, crafter = null) {
        // Learn from seeing an item being crafted or used
        if (!item?.type) return
        
        this.observedCrafts.add(item.type)
        
        // If we haven't discovered this ourselves, add to pondering queue
        const relatedSolution = this.findRelatedSolution(item.type)
        if (relatedSolution && !this.discoveredSolutions.has(relatedSolution.id)) {
            // Easier to discover if we've seen it
            this.ponderProblem(`learn_craft_${item.type}`, {
                itemType: item.type,
                inspiration: 'observed',
                crafter: crafter?.name,
                observedQuality: item.quality
            })
        }
        
        // Gain small skill insight from observation
        if (crafter && item.craftedBy === crafter.id) {
            const recipe = this.getRecipeForItemType(item.type)
            if (recipe?.primarySkill) {
                this.increaseSkill(recipe.primarySkill, 0.1)
            }
        }
    }
    
    findRelatedSolution(itemType) {
        // Map item types to solution concepts
        const mapping = {
            'cordage': { id: 'cordage_concept', name: 'Cordage Making' },
            'basket': { id: 'basket_concept', name: 'Basket Weaving' },
            'sharp_stone': { id: 'stone_tool_concept', name: 'Stone Tool Making' },
            'stone_knife': { id: 'advanced_tool_concept', name: 'Advanced Tool Crafting' },
            'poultice': { id: 'medicine_concept', name: 'Herbal Medicine' },
            'shelter': { id: 'shelter_concept', name: 'Basic Shelter' }
        }
        return mapping[itemType]
    }
    
    getRecipeForItemType(itemType) {
        // Helper to find recipe by output type
        // This would import from Recipes.js in practice
        return null // Placeholder
    }
    
    trackMaterialEncounter(material) {
        // Track materials we've seen/gathered for lateral learning
        if (!material?.type) return
        
        this.knownMaterials.add(material.type)
        this.updateResourceSpecialization(material)
        
        // If we know how to make something with similar materials, ponder variations
        this.considerMaterialSubstitution(material.type)
    }
    
    considerMaterialSubstitution(newMaterial) {
        // Check if we can make lateral connections
        // Example: if we know reed_basket and now have linen, consider linen_basket
        const materialGroups = this.getMaterialGroups()
        
        // Find group for this material
        let materialGroup = null
        for (const [group, materials] of Object.entries(materialGroups)) {
            const normalized = String(newMaterial).toLowerCase()
            const matches = materials.some(material => {
                const token = String(material).toLowerCase()
                return normalized === token || normalized.includes(token)
            })
            if (matches) {
                materialGroup = group
                break
            }
        }
        
        if (!materialGroup) return
        
        // Check if we know recipes using similar materials
        for (const solution of this.discoveredSolutions) {
            // If this solution uses materials from the same group, we might discover a variant
            if (Math.random() < 0.1) { // 10% chance to ponder
                this.ponderProblem('material_substitution', {
                    originalSolution: solution,
                    newMaterial,
                    materialGroup
                })
            }
        }
    }
    
    hearStory(story) {
        // Stories can inspire invention
        // story: { subject, tags, legendary, heroic }
        if (!story) return
        
        const invention = this.getSkill('invention')
        const storytelling = this.getSkill('storytelling')
        
        // Higher invention/storytelling = more likely to be inspired
        const inspirationChance = (invention + storytelling) * 0.005
        
        if (Math.random() < inspirationChance) {
            console.log(`${this.name} was inspired by a story about ${story.subject}`)
            
            // Add inspired problem to pondering
            this.ponderProblem('inspired_invention', {
                inspiration: story.subject,
                tags: story.tags,
                legendary: story.legendary
            })
        }
    }

    recordReputationEvent({ type, value, witnesses = [], context = {} }) {
        // Update own reputation
        if (type in this.reputation) {
            this.reputation[type] = (this.reputation[type] ?? 0) + value
        }
        // Propagate to witnesses
        for (const witness of witnesses) {
            witness.observeReputationEvent(this, type, value, context)
        }
    }

    observeReputationEvent(actor, type, value, context = {}) {
        const intuition = this.getSkill('intuition')
        const perceivedValue = value * (1 + intuition * 0.05)
        const now = Date.now()
        this.reputationMemory[actor.id] = {
            alignment: type === 'alignment' ? perceivedValue : 0,
            aggression: type === 'aggression' ? perceivedValue : 0,
            source: 'witness',
            strength: Math.abs(perceivedValue),
            timestamp: now,
            context
        }
    }

    hearReputationStory(actor, story) {
        // story: { alignment, aggression, strength, source, timestamp }
        const storytelling = this.getSkill('storytelling')
        const decay = 1 - Math.min(0.5, storytelling * 0.05)
        const heard = {
            ...story,
            alignment: (story.alignment ?? 0) * decay,
            aggression: (story.aggression ?? 0) * decay,
            source: 'gossip',
            timestamp: Date.now(),
            strength: (story.strength ?? 1) * decay
        }
        this.reputationMemory[actor.id] = heard
    }

    getGroupTrustIn(targetPawn) {
        if (!targetPawn?.id) return 0
        const direct = this.groupTrust[targetPawn.id]
        if (direct != null) return direct

        const perceived = this.getPerceivedReputation(targetPawn)
        if (!perceived) return 0

        const alignment = perceived.alignment ?? 0
        const aggression = perceived.aggression ?? 0
        const normalized = (alignment - aggression) / 100

        return Math.max(-1, Math.min(1, normalized))
    }

    setGroupTrustIn(targetPawn, trust) {
        if (!targetPawn?.id) return
        this.groupTrust[targetPawn.id] = Math.max(-1, Math.min(1, trust ?? 0))
    }

    createGroup(groupId = `group-${this.id}-${Date.now()}`) {
        this.groupState = {
            id: groupId,
            role: 'leader',
            leaderId: this.id,
            joinedAt: Date.now(),
            cohesion: Math.max(this.groupState?.cohesion ?? 0, 0.2)
        }
        this.reputation.membership[groupId] = 'leader'
        return groupId
    }

    joinGroup(leaderPawn, groupId = leaderPawn?.groupState?.id) {
        if (!leaderPawn?.id || !groupId) return false

        this.groupState = {
            id: groupId,
            role: 'member',
            leaderId: leaderPawn.id,
            joinedAt: Date.now(),
            cohesion: Math.max(this.groupState?.cohesion ?? 0, 0.1)
        }
        this.reputation.membership[groupId] = 'member'
        return true
    }

    leaveGroup() {
        const groupId = this.groupState?.id
        if (groupId && this.reputation?.membership) {
            delete this.reputation.membership[groupId]
        }
        this.groupState = {
            id: null,
            role: 'none',
            leaderId: null,
            joinedAt: null,
            cohesion: 0
        }
        this.groupCommandQueue = []
    }

    getGroupLeader() {
        const leaderId = this.groupState?.leaderId
        if (!leaderId || !this.world?.entitiesMap) return null
        return this.world.entitiesMap.get(leaderId) ?? null
    }

    getGroupMembers() {
        const groupId = this.groupState?.id
        if (!groupId || !this.world?.entitiesMap) return []

        return Array.from(this.world.entitiesMap.values()).filter(entity =>
            entity?.subtype === 'pawn' &&
            entity.groupState?.id === groupId
        )
    }

    canObeyLeader(leaderPawn, minTrust = 0.05) {
        if (!leaderPawn?.id) return false
        if (leaderPawn.id === this.id) return true
        if (!this.groupState?.id || this.groupState.id !== leaderPawn.groupState?.id) return false
        if (this.groupState.leaderId !== leaderPawn.id) return false

        const trust = this.getGroupTrustIn(leaderPawn)
        return trust >= minTrust
    }

    receiveGroupCommand(command, issuedByPawn) {
        if (!command || !issuedByPawn) return false
        const minTrust = command.minTrust ?? 0.05
        if (!this.canObeyLeader(issuedByPawn, minTrust)) return false

        this.groupCommandQueue.push({
            ...command,
            issuedBy: issuedByPawn.id,
            issuedAt: Date.now()
        })
        this.groupState.cohesion = Math.min(1, (this.groupState.cohesion ?? 0) + 0.02)
        return true
    }

    issueGroupCommand(command) {
        if (!command || this.groupState?.role !== 'leader') return 0

        const members = this.getGroupMembers().filter(member => member.id !== this.id)
        let accepted = 0
        for (const member of members) {
            if (member.receiveGroupCommand(command, this)) {
                accepted++
            }
        }
        return accepted
    }

    getNextGroupCommandGoal() {
        if (!this.groupCommandQueue.length) return null

        const command = this.groupCommandQueue.shift()
        const leader = this.world?.entitiesMap?.get(command.issuedBy)
        const basePriority = command.priority ?? 8
        const duration = command.duration ?? 120

        if (command.type === 'follow') {
            return {
                type: 'follow_leader',
                priority: basePriority,
                description: 'Follow group leader command',
                targetType: 'entity',
                targetSubtype: 'pawn',
                targetId: leader?.id ?? command.issuedBy,
                target: leader ?? null,
                action: 'follow',
                duration,
                groupCommand: true
            }
        }

        if (command.type === 'protect') {
            const target = command.target ?? null
            return {
                type: 'protect_target',
                priority: basePriority,
                description: 'Protect assigned target',
                targetType: 'entity',
                targetSubtype: target?.subtype ?? 'pawn',
                targetId: target?.id,
                target,
                action: 'protect',
                duration,
                groupCommand: true
            }
        }

        if (command.type === 'escort') {
            const target = command.target ?? null
            return {
                type: 'escort_target',
                priority: basePriority,
                description: 'Escort assigned target',
                targetType: 'entity',
                targetSubtype: target?.subtype ?? 'pawn',
                targetId: target?.id,
                target,
                destination: command.destination ?? null,
                action: 'escort',
                duration,
                groupCommand: true
            }
        }

        if (command.type === 'mark') {
            const target = command.target ?? null
            return {
                type: 'mark_target',
                priority: basePriority,
                description: 'Mark target for group attention',
                targetType: 'entity',
                targetId: target?.id,
                target,
                targetLocation: command.targetLocation ?? (target ? { x: target.x, y: target.y } : null),
                action: 'mark',
                groupCommand: true
            }
        }

        return null
    }

    getPerceivedReputation(targetPawn) {
        // Returns the reputation of targetPawn as perceived by this pawn
        return this.reputationMemory[targetPawn.id] ?? null
    }

    shareReputationWith(otherPawn, targetPawn) {
        // Share strongest story about targetPawn
        const story = this.reputationMemory[targetPawn.id]
        if (story) {
            otherPawn.hearReputationStory(targetPawn, story)
        }
    }

    addItemToInventory(item) {
        // item: { id, name, weight, size, slotType, increasesCapacity, ... }
        // Track as known material
        this.trackMaterialEncounter(item)
        
        // Prevent water from being added unless pawn has a container
        if ((item.type === 'water' || item.subtype === 'water' || item.tags?.includes?.('water')) && !this.hasContainer()) {
            // Can't carry water without a container - trigger pondering!
            this.ponderProblem('need_water_container', {
                itemType: 'water',
                reason: 'Cannot carry water without container',
                possibleSolutions: ['waterskin', 'clay_pot', 'gourd']
            })
            return false
        }
        if (item.increasesCapacity) {
            this.inventorySlots += item.increasesCapacity.slots ?? 0
            this.maxWeight += item.increasesCapacity.weight ?? 0
            this.maxSize += item.increasesCapacity.size ?? 0
        }
        if (this.inventory.length >= this.inventorySlots) {
            // Inventory full - trigger pondering!
            this.ponderProblem('inventory_full', {
                itemType: item.type,
                currentSlots: this.inventorySlots,
                reason: 'No more hands to carry items',
                possibleSolutions: ['basket', 'backpack', 'pouch', 'drop_items']
            })
            return false
        }
        if ((this.inventoryWeight + (item.weight ?? 1)) > this.maxWeight) return false
        if ((this.getInventorySize() + (item.size ?? 1)) > this.maxSize) return false
        this.inventory.push(item)
        this.inventoryWeight += item.weight ?? 1
        return true
    }
    
    // Item durability and degradation
    degradeItem(item, amount = 1) {
        if (!item.currentDurability) return false
        
        item.currentDurability = Math.max(0, item.currentDurability - amount)
        
        // Quality affects effectiveness
        const effectiveness = item.currentDurability / item.maxDurability
        
        // Item breaks if durability reaches 0
        if (item.currentDurability <= 0) {
            console.log(`${this.name}'s ${item.name} has broken!`)
            return true // Item broken
        }
        
        // Warn if getting low
        if (effectiveness < 0.3 && effectiveness > 0.2) {
            console.log(`${this.name}'s ${item.name} is nearly broken (${Math.floor(effectiveness * 100)}%)`)
        }
        
        return false // Still functional
    }
    
    getItemEffectiveness(item) {
        if (!item.currentDurability || !item.maxDurability) return 1.0
        
        const durabilityRatio = item.currentDurability / item.maxDurability
        
        // Quality above 1.2 provides bonus even when worn
        const qualityBonus = item.quality > 1.2 ? (item.quality - 1.2) * 0.5 : 0
        
        return Math.max(0.3, durabilityRatio + qualityBonus) // Minimum 30% effectiveness
    }

    removeItemFromInventory(itemId) {
        const idx = this.inventory.findIndex(i => i.id === itemId)
        if (idx !== -1) {
            const [item] = this.inventory.splice(idx, 1)
            this.inventoryWeight -= item.weight ?? 1
            return item
        }
        return null
    }

    getInventorySize() {
        return this.inventory.reduce((sum, i) => sum + (i.size ?? 1), 0)
    }

    addToHiddenInventory(item) {
        this.hiddenInventory.push(item)
    }

    dropHiddenInventory() {
        const dropped = [...this.hiddenInventory]
        this.hiddenInventory = []
        return dropped
    }

    canRecognizeItem(item, skill, experience = 0) {
        // Returns true if pawn can recognize item based on skill or experience
        const skillLevel = this.getSkill(skill)
        const threshold = item.recognitionThreshold ?? 25
        return skillLevel >= threshold || experience >= threshold || (skillLevel + experience) >= threshold * 1.2
    }

    experimentWithItems(itemA, itemB) {
        // Try combining or processing items without a recipe
        // Returns a result or null if nothing happens
        // This is a stub for more advanced experimentation logic
        this.increaseSkill('processing', 0.2)
        // Example: if both are sticks, maybe discover 'sharp stick'
        if (itemA.type === 'stick' && itemB.type === 'rock') {
            return { type: 'sharp stick', quality: 1, discovered: true }
        }
        // Add more logic for experimentation
        return null
    }

    craft(recipe) {
        // Modern craft using Recipe data structure from Recipes.js
        // Check skills
        for (const [skill, level] of Object.entries(recipe.requiredSkills ?? {})) {
            if (this.getSkill(skill) < level) {
                console.warn(`${this.name} lacks skill ${skill} (need ${level})`)
                return null
            }
        }

        // Collect and remove required items from inventory
        const consumed = []
        for (const req of recipe.requiredItems) {
            const items = this.inventory.filter(item => item.type === req.type)
            if (items.length < req.count) {
                console.warn(`${this.name} lacks ${req.type} (need ${req.count}, have ${items.length})`)
                // Return previously consumed items
                for (const item of consumed) this.inventory.push(item)
                return null
            }
            // Remove required count
            for (let i = 0; i < req.count; i++) {
                const item = items[i]
                this.removeItemFromInventory(item.id)
                consumed.push(item)
            }
        }

        // Calculate quality based on primary skill
        const primarySkill = this.getSkill(recipe.primarySkill)
        const baseQuality = recipe.output.baseQuality ?? 1
        const skillBonus = primarySkill * 0.01 // 1% per skill level
        
        // Add synergy bonuses from related skills
        const synergyBonus = this.calculateSynergyBonus(recipe.primarySkill)
        
        // Quality variance: better skill reduces variance
        const variance = 0.3 - (primarySkill * 0.002) // Less variance as skill increases
        const randomFactor = (Math.random() * variance * 2) - variance
        
        const quality = baseQuality + skillBonus + synergyBonus + randomFactor

        // Determine durability based on quality
        // Quality < 0.8: starts degraded (0.6-0.9 durability)
        // Quality 0.8-1.2: normal (1.0 durability)
        // Quality > 1.2: enhanced (1.0-1.5 durability, with bonuses)
        let durability = 1.0
        if (quality < 0.8) {
            durability = 0.6 + (quality * 0.375) // Maps 0.5->0.79 to 0.6->0.9
        } else if (quality > 1.2) {
            durability = 1.0 + ((quality - 1.2) * 0.5) // Bonus durability
        }

        // Create output item
        const output = {
            ...recipe.output,
            id: `${recipe.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            quality: Math.max(0.5, Math.min(2.0, quality)),
            durability: Math.max(0.5, Math.min(1.5, durability)),
            maxDurability: recipe.output.durability || 100,
            currentDurability: Math.floor((recipe.output.durability || 100) * durability),
            craftedBy: this.id,
            craftedAt: this.world?.clock?.currentTick ?? 0
        }

        // Track crafted counts for unlock conditions
        this.craftedCounts = this.craftedCounts ?? {}
        this.craftedCounts[recipe.id] = (this.craftedCounts[recipe.id] ?? 0) + 1

        // Gain item experience for consumed materials
        for (const item of consumed) {
            this.addItemExperience(item.type, 0.5)
            this.trackMaterialEncounter(item) // Track for lateral learning
        }

        // Gain skill experience
        if (recipe.primarySkill && recipe.experience) {
            this.increaseSkill(recipe.primarySkill, recipe.experience)
        }
        
        // Track crafting success for specialization
        const solutionId = `${recipe.id}_concept`
        if (this.solutionSuccessCount[solutionId] !== undefined) {
            this.solutionSuccessCount[solutionId]++
        }
        
        // Record craft in history
        this.craftingHistory.push({
            recipe: recipe.id,
            quality: output.quality,
            timestamp: this.world?.clock?.currentTick ?? 0,
            success: true
        })
        
        // Trim history to last 20 crafts
        if (this.craftingHistory.length > 20) {
            this.craftingHistory.shift()
        }
        
        // Nearby pawns can observe this craft
        this.broadcastCraftObservation(output)

        // Evaluate unlocks after crafting
        this.evaluateSkillUnlocks?.()

        console.log(`${this.name} crafted ${output.name} (quality: ${output.quality.toFixed(2)}, durability: ${output.durability.toFixed(2)})`)
        return output
    }
    
    broadcastCraftObservation(item) {
        // Let nearby pawns observe this craft
        if (!this.chunkManager) return
        
        const pawnChunkX = Math.floor(this.x / this.chunkManager.chunkSize)
        const pawnChunkY = Math.floor(this.y / this.chunkManager.chunkSize)
        
        // Check nearby chunks for other pawns
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const chunk = this.chunkManager.getChunk(pawnChunkX + dx, pawnChunkY + dy)
                if (chunk) {
                    for (const entity of chunk.entities) {
                        if (entity.subtype === 'pawn' && entity !== this) {
                            const dist = Math.sqrt((this.x - entity.x) ** 2 + (this.y - entity.y) ** 2)
                            if (dist <= 100) { // Observation range
                                entity.observeCraftedItem?.(item, this)
                            }
                        }
                    }
                }
            }
        }
    }

    getItemExperience(itemType) {
        this.itemExperience = this.itemExperience ?? {}
        return this.itemExperience[itemType] ?? 0
    }

    addItemExperience(itemType, amount = 1) {
        this.itemExperience = this.itemExperience ?? {}
        this.itemExperience[itemType] = (this.itemExperience[itemType] ?? 0) + amount
    }

    consumeFoodOrDrink(item) {
        // item: { satisfying, filling, thirstQuench, buffs, type }
        // Satisfying: how much hunger/thirst is sated immediately
        // Filling: how much it slows future hunger/thirst
        // ThirstQuench: how much thirst is sated
        // Buffs: { skill: amount, ... }
        // Type: 'food', 'drink', etc.
        if (!item) return
        // Sate hunger
        if (item.satisfying) {
            this.needs.satisfyNeed?.('hunger', item.satisfying)
        }
        // Sate thirst
        if (item.thirstQuench) {
            this.needs.satisfyNeed?.('thirst', item.thirstQuench)
        }
        // Overfilling on water can sate some hunger
        if (item.type === 'drink' && item.thirstQuench > 0 && item.thirstQuench > (item.satisfying ?? 0)) {
            this.needs.satisfyNeed?.('hunger', item.thirstQuench * 0.2)
        }
        // Foods that also quench thirst
        if (item.type === 'food' && item.thirstQuench) {
            this.needs.satisfyNeed?.('thirst', item.thirstQuench * 0.5)
        }
        // Filling slows future hunger
        if (item.filling) {
            this.needs.modifyNeedDecay?.('hunger', -item.filling)
        }
        // Buffs
        if (item.buffs) {
            for (const skill in item.buffs) {
                this.increaseSkill(skill, item.buffs[skill])
            }
        }
        // Mythical/rare effects (example: beer and charisma)
        if (item.type === 'beer') {
            this.increaseSkill('charisma', 1)
        }
    }

    // Call this from the main game loop to update pawn's time awareness
    timeTick(gameTime) {
        // gameTime: current game time in seconds
        this.gameTime = gameTime
        this.updateNeedsDecay()
        this.checkSleepDeprivation()
        this.applyRegularHoursBonus()
    }

    isDaytime() {
        // Returns true if current game hour is between 1 and 5 (out of 6)
        const hour = Math.floor((this.gameTime ?? 0) / Pawn.TURN_GAME_SECONDS / 60) % Pawn.GAME_DAY_HOURS
        return hour >= 1 && hour <= 5
    }

    updateNeedsDecay() {
        // Slow down hunger/thirst decay so eating/drinking is not needed every game hour
        // Example: only get hungry every 2-3 game hours
        if (!this.needs) return
        const hoursSinceMeal = ((this.gameTime ?? 0) - (this.lastMealTime ?? 0)) / (Pawn.TURN_GAME_SECONDS * 60)
        const hoursSinceDrink = ((this.gameTime ?? 0) - (this.lastDrinkTime ?? 0)) / (Pawn.TURN_GAME_SECONDS * 60)
        if (hoursSinceMeal > 2) this.needs.modifyNeedDecay?.('hunger', 0.1 * (hoursSinceMeal - 2))
        if (hoursSinceDrink > 1.5) this.needs.modifyNeedDecay?.('thirst', 0.1 * (hoursSinceDrink - 1.5))
    }

    sleep(hours = 1) {
        // Pawn sleeps for a number of game hours
        this.isAsleep = true
        this.lastSleepTime = this.gameTime ?? 0
        this.sleepDeprivation = 0
        // Restore needs, health, etc. as desired
        this.needs.satisfyNeed?.('rest', hours * 20)
        this.applyHealthChange(hours * 2, 'sleep')
    }

    wakeUp() {
        this.isAsleep = false
    }

    checkSleepDeprivation() {
        // If pawn hasn't slept in >1 game day, apply penalties
        const timeSinceSleep = (this.gameTime ?? 0) - (this.lastSleepTime ?? 0)
        if (timeSinceSleep > Pawn.GAME_DAY_SECONDS) {
            this.sleepDeprivation = timeSinceSleep - Pawn.GAME_DAY_SECONDS
            // Apply penalty to needs/skills
            this.needs.modifyNeedDecay?.('rest', 0.2 * (this.sleepDeprivation / Pawn.GAME_DAY_SECONDS))
            this.applyHealthChange(-1, 'sleep deprivation')
        } else {
            this.sleepDeprivation = 0
        }
    }

    applyRegularHoursBonus() {
        // If pawn is awake during regular hours, apply a small bonus
        if (!this.isAsleep && this.isDaytime()) {
            this.increaseSkill('planning', 0.05)
            this.increaseSkill('composure', 0.05)
        }
    }

    // Call when pawn eats/drinks
    recordMeal() {
        this.lastMealTime = this.gameTime ?? 0
    }
    recordDrink() {
        this.lastDrinkTime = this.gameTime ?? 0
    }
}

export default Pawn
