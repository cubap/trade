import MobileEntity from './MobileEntity.js'
import PawnNeeds from './PawnNeeds.js'
import PawnGoals from './PawnGoals.js'

class Pawn extends MobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'pawn'
        this.tags.push('pawn')  // Add pawn-specific tag
        this.color = '#3498db'  // Blue color for pawns
        
        // Pawn-specific attributes
        this.inventory = [] // Carried items
        this.inventorySlots = 10 // Default slot count
        this.inventoryWeight = 0 // Current total weight
        this.maxWeight = 50 // Default max weight
        this.maxSize = 100 // Default max size (volume)
        this.hiddenInventory = [] // Items dropped on death/harvest

        this.skills = {
            planning: 0, // Planning skill for idle automation
            orienteering: 0, // Affects map accuracy
            cartography: 0,  // Affects map detail and persistence
            storytelling: 0, // Affects oral map sharing
            intuition: 0, // Perceive reputation
            bragging: 0, // Influence positive perception
            composure: 0, // Hide negative acts
            manipulation: 0, // Adjust impressions
            convincing: 0, // Spread stories more effectively
            // Medical and alchemical skills
            medicine: 0, // General medical knowledge
            surgery: 0, // Performing surgery
            herbalism: 0, // Identifying and using herbs
            alchemy: 0, // Creating potions and elixirs
            poisoncraft: 0, // Making and handling poisons
            // Add more skills here for future skill tree
        }
        this.behaviorState = 'idle'  // Current activity state
        
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

        // Memory map for landmarks
        this.memoryMap = [] // List of known landmarks
        this.maxLandmarks = 5 // Can be increased by skills

        // Reputation system
        this.reputation = { alignment: 0, aggression: 0, membership: {} }
        this.reputationMemory = {} // { pawnId: { alignment, aggression, source, strength, timestamp } }

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
    }
    
    // Helper to check tags whether Set or Array
    hasTag(entity, tag) {
        const t = entity?.tags
        if (!t) return false
        if (Array.isArray(t)) return t.includes(tag)
        if (typeof t.has === 'function') return t.has(tag)
        return false
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
        }
    }
    
    interactWithTarget(target, goal) {
        this.behaviorState = 'socializing'
        
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
    
    increaseSkill(skill, amount = 1) {
        if (this.skills[skill] !== undefined) {
            this.skills[skill] += amount
        }
    }

    useSkill(skill, amount = 1) {
        this.increaseSkill(skill, amount)
    }

    passiveSkillTick() {
        // Example: exploring increases orienteering, guarding increases composure
        if (this.behaviorState === 'exploring') {
            this.increaseSkill('orienteering', 0.1)
        }
        if (this.behaviorState === 'guarding') {
            this.increaseSkill('composure', 0.1)
        }
        // Add more passive skill checks as needed
    }

    trainSkill(skill, student, amount = 0.5) {
        // Training another pawn increases their skill
        if (student && student.increaseSkill) {
            student.increaseSkill(skill, amount)
        }
    }

    apprenticeSkill(skill, teacher, amount = 0.5) {
        // Apprenticing under a teacher
        if (teacher && teacher.skills[skill] > (this.skills[skill] ?? 0)) {
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
        this.goals.evaluateAndSetGoals()
        this.passiveSkillTick()
        this.updateHealthEvents()
        if (this.behaviorState === 'idle' && !this.goals.currentGoal) {
            this.idleTicks++
            if (this.idleTicks % 100 === 0) {
                this.increasePlanningSkill()
            }
        } else {
            this.idleTicks = 0
        }
        return true
    }
    
    increasePlanningSkill() {
        this.skills.planning++
        // Optionally, trigger events or unlock features as planning increases
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
            if (this.skills.storytelling < 3) {
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
        const intuition = this.skills.intuition ?? 0
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
        const storytelling = this.skills.storytelling ?? 0
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
        if (item.increasesCapacity) {
            this.inventorySlots += item.increasesCapacity.slots ?? 0
            this.maxWeight += item.increasesCapacity.weight ?? 0
            this.maxSize += item.increasesCapacity.size ?? 0
        }
        if (this.inventory.length >= this.inventorySlots) return false
        if ((this.inventoryWeight + (item.weight ?? 1)) > this.maxWeight) return false
        if ((this.getInventorySize() + (item.size ?? 1)) > this.maxSize) return false
        this.inventory.push(item)
        this.inventoryWeight += item.weight ?? 1
        return true
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
        const skillLevel = this.skills[skill] ?? 0
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

    craft(recipe, ingredients) {
        // Attempt to craft an item using a recipe and ingredients
        // Recipe: { name, requiredSkills, requiredExperience, result, qualityBase }
        // Ingredients: array of items
        let skillOk = true
        let expOk = true
        for (const req of recipe.requiredSkills ?? []) {
            if ((this.skills[req.skill] ?? 0) < req.level) skillOk = false
        }
        for (const req of recipe.requiredExperience ?? []) {
            if ((this.getItemExperience(req.item) ?? 0) < req.amount) expOk = false
        }
        // If not skilled or experienced, allow but with low quality
        let quality = recipe.qualityBase ?? 1
        if (!skillOk || !expOk) quality *= 0.5
        else quality += (this.skills[recipe.primarySkill] ?? 0) * 0.05
        // Use up ingredients
        for (const ing of ingredients) {
            this.removeItemFromInventory(ing.id)
        }
        // Gain experience with used items
        for (const ing of ingredients) {
            this.addItemExperience(ing.type)
        }
        // Increase skill
        if (recipe.primarySkill) this.increaseSkill(recipe.primarySkill, 0.5)
        return { ...recipe.result, quality }
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
