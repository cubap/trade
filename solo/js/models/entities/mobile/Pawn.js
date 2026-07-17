import MobileEntity from './MobileEntity.js'
import PawnNeeds from './PawnNeeds.js'
import PawnGoals from './PawnGoals.js'
import { SKILL_UNLOCKS, isUnlockSatisfied } from '../../skills/SkillUnlocks.js'
import { emitUnlocks } from '../../skills/UnlockEvents.js'
import INVENTION_CONFIG from './InventionConfig.js'
import ResourceCache from '../immobile/ResourceCache.js'
import * as PawnCivic from './PawnCivic.js'
import * as PawnSocial from './PawnSocial.js'
import * as PawnTactical from './PawnTactical.js'
import * as PawnSecurity from './PawnSecurity.js'

class Pawn extends MobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'pawn'
        this.tags.push('pawn')  // Add pawn-specific tag
        this.color = '#3498db'  // Blue color for pawns
        
        // Walking speed: ~1.4 m/s (average human walking pace)
        // 1 tick = 500ms, so speed = meters per tick = m/s × 0.5
        this.speed = 0.7   // ~1.4 m/s walking
        this.runSpeed = 2.0 // ~4.0 m/s running (jogging pace)
        
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
        this.recentAction = 'Idle'
        this.recentActionTick = 0
        this.thoughtLog = []
        this.maxThoughtLog = 16
        this.thoughtSequence = 0 // Increments on every addThought, even duplicates
        this.challengeContexts = []
        this.maxChallengeContexts = 20
        this.purposeStrainTicks = 0
        this.exposedNights = 0
        this.groupCampNights = 0
        this.cacheLossEvents = 0
        this.lastCacheAuditTick = 0
        
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

        // Home landmark tracking for civic group formation
        this.homeLandmark = null // { x, y, sleepCount, lastSleptAt, significance }
        this.homeReusePasses = 0 // Reuse passes before home becomes significant
        this.maxHomeReuseForSignificance = 3 // Sleep 3+ times at same spot = home

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
        this.groupNegotiation = null // pending civic negotiation state
        this.groupMemberships = {} // { [groupId]: { id, type, role, leaderId, joinedAt, cohesion } }
        this.groupAffiliationsByType = {} // { [groupType]: groupId }
        this.groupMarks = [] // shared attention markers
        this.groupStats = {
            obeyedCommands: 0,
            rejectedCommands: 0,
            promotions: 0
        }
        this.groupConfig = {
            maxCohesionDistance: 260,
            promotionCohesion: 0.82,
            promotionTrust: 0.75,
            cohesionDecayNear: 0.003,
            cohesionDecayFar: 0.03
        }

        // Phase 1: Tactical memory and territory management
        this.tacticalMemory = [] // { type: 'territory'|'route'|'threat'|'resource', location, description, tick, significance }
        this.maxTacticalMemory = 30
        this.patrolRoutes = {} // { routeId: { waypoints: [{x,y}], assignedAt, active } }
        this.defenseAssignments = {} // { assignmentId: { position: {x,y}, assignedAt, defendingGroup, active } }
        this.territoryLandmarks = [] // { x, y, type, significance, claimedAt }

        // Phase 1: Hunt coordination
        this.huntParty = null // { partyId, targetId, targetLocation, members: [], startedAt }
        this.huntHistory = [] // { target, success, tick, partySize }

        // Phase 1: Security contracts between groups
        this.securityContracts = {} // { contractId: { withGroup, type: 'patrol'|'defense', terms, active, createdAt } }

        // Phase 2: Civic/Government (Town Focus)
        // Proto-settlement: social group, not physical footprint
        this.encampmentLandmark = null // { x, y, tick, groupMembers: Set, resourceRichness, canonized }
        this.civicScore = 0 // Aggregated settlement score (structure count, governance, stability)
        this.civicReputation = {} // { pawnId: score } — contribution-based standing
        this.civicLedger = [] // { type: 'build'|'supply'|'defend'|'tax', pawnId, amount, tick }
        this.governanceModel = null // 'none' | 'consensus' | 'appointed' | 'elective' | 'weighted'
        this.governanceTokens = { curfew: null, storageShare: 0, taxRate: 0 } // Law tokens
        this.jobBoard = [] // { taskId, type, assignedTo, deadline, reward, completed }
        this.curriculum = [] // { lessonId, skill, prerequisite, xp, scheduledAt, completed }
        this.isSettlementDiscoverable = false // True when communal storage canonizes encampment

        // Branch inclination vectors (tribal, civic, mercantile)
        // Range 0-1, sum ~1.0. Bias goal selection toward matching triad behavior.
        this.branchInclination = {
            tribal: 0.33,
            civic: 0.34,
            mercantile: 0.33
        }
        this.inclinationHistory = [] // Track recent inclination shifts for smoothing
        this.maxInclinationHistory = 10

        // Trust decay configuration
        this.trustDecayConfig = {
            enabled: true,
            decayRate: 0.002, // Per tick
            decayFloor: 0.1, // Minimum trust retained
            decayPeriod: 200, // Ticks between decay passes
            lastDecayTick: 0
        }

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
            this.setRecentAction(`Gathering from ${resource.name ?? resource.subtype ?? 'resource'}`)
            
            // Gather from resource
            const gathered = resource.gather(1)
            if (gathered) {
                const added = this.addItemToInventory(gathered)

                if (added) {
                    this.setRecentAction(`Gathered ${gathered.type ?? gathered.name ?? 'resource'}`)
                    this.assessManualCuttingHardship(resource, gathered)
                    // Examination-based learning: require interaction with the gathered item
                    this.examineItem?.(gathered)
                    // Track material for lateral learning
                    this.trackMaterialEncounter(gathered)
                } else {
                    const atSource = this.handleGatheredItemWithoutStorage(gathered, {
                        goalResourceType: goal?.targetResourceType
                    })
                    if (atSource.handled && atSource.message) {
                        console.log(`${this.name} ${atSource.message}`)
                    }
                }
                
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

    isWaterItem(item) {
        if (!item) return false
        if (item.type === 'water' || item.subtype === 'water') return true
        const tags = item.tags
        if (Array.isArray(tags)) return tags.includes('water')
        if (typeof tags?.has === 'function') return tags.has('water')
        return false
    }

    sipFromGatheredWater(item, sipFraction = 0.35) {
        const gatheredQty = Math.max(0, item?.quantity ?? 1)
        const consumedQty = Math.max(0.1, gatheredQty * sipFraction)
        this.behaviorState = 'drinking'
        this.setRecentAction('Drinking from source (no container)')
        this.needs?.satisfyNeed?.('thirst', consumedQty * 12)
        this.needs?.satisfyNeed?.('hunger', consumedQty)
        this.recordDrink?.()
        return consumedQty
    }

    isFoodItem(item) {
        if (!item) return false
        const type = String(item.type ?? '').toLowerCase()
        const subtype = String(item.subtype ?? '').toLowerCase()
        if (type === 'food' || subtype === 'food') return true
        if (type.includes('berry') || subtype.includes('berry')) return true

        const tags = item.tags
        if (Array.isArray(tags)) return tags.includes('food')
        if (typeof tags?.has === 'function') return tags.has('food')
        return false
    }

    eatFromGatheredFood(item, biteFraction = 0.45) {
        const gatheredQty = Math.max(0, item?.quantity ?? 1)
        const eatenQty = Math.max(0.1, gatheredQty * biteFraction)
        this.behaviorState = 'eating'
        this.setRecentAction('Eating at source (no free hands)')
        this.needs?.satisfyNeed?.('hunger', eatenQty * 10)
        this.needs?.satisfyNeed?.('thirst', eatenQty * 1.5)
        this.recordMeal?.()
        return eatenQty
    }

    handleGatheredItemWithoutStorage(item, { goalResourceType = null } = {}) {
        if (this.isWaterItem(item) && !this.hasContainer()) {
            const sip = this.sipFromGatheredWater(item)
            return {
                handled: true,
                countAsGather: goalResourceType === 'water',
                message: `cups hands and drinks (${sip.toFixed(2)} units), no container available`
            }
        }

        if (this.isFoodItem(item)) {
            const eaten = this.eatFromGatheredFood(item)
            return {
                handled: true,
                countAsGather: goalResourceType === 'food',
                message: `eats from source (${eaten.toFixed(2)} units), no free hands to carry`
            }
        }

        return { handled: false, countAsGather: false, message: null }
    }

    getNearbyRecipeSources(req) {
        const requiredTag = req.sourceTag ?? req.type
        const range = req.sourceRange ?? 24
        const entities = this.world?.entitiesMap ? Array.from(this.world.entitiesMap.values()) : []

        return entities.filter(entity => {
            if (!entity || entity === this) return false
            const dx = entity.x - this.x
            const dy = entity.y - this.y
            if (Math.sqrt(dx * dx + dy * dy) > range) return false

            const tags = entity.tags
            const hasTag = Array.isArray(tags)
                ? tags.includes(requiredTag)
                : typeof tags?.has === 'function'
                    ? tags.has(requiredTag)
                    : false

            return hasTag || entity.subtype === requiredTag || entity.type === requiredTag
        })
    }

    countNearbySourceUnits(req) {
        let total = 0
        const perUnitAmount = req.sourceConsumeAmount ?? 1

        for (const source of this.getNearbyRecipeSources(req)) {
            const quantity = Number.isFinite(source.quantity) ? Math.max(0, source.quantity) : 0
            if (quantity > 0) {
                total += Math.floor(quantity / perUnitAmount)
                continue
            }

            if (source.canConsume?.() || source.canGather?.()) {
                total += 1
            }
        }

        return total
    }

    consumeRecipeRequirementAtSource(req, neededCount = 1) {
        if (!req.allowSourceUse || neededCount <= 0) return 0

        let remaining = neededCount
        const perUnitAmount = req.sourceConsumeAmount ?? 1

        for (const source of this.getNearbyRecipeSources(req)) {
            while (remaining > 0) {
                if (typeof source.consume === 'function') {
                    const consumed = source.consume(perUnitAmount)
                    if (consumed < perUnitAmount * 0.5) break
                    remaining--
                    continue
                }

                if (typeof source.gather === 'function') {
                    const gathered = source.gather(1)
                    if (!gathered) break
                    remaining--
                    continue
                }

                break
            }

            if (remaining <= 0) break
        }

        const used = neededCount - remaining
        if (used > 0) {
            this.setRecentAction(`Combining at ${req.sourceTag ?? req.type} source`)
        }
        return used
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

        const purposeNeed = this.needs?.needs?.purpose ?? 0
        const purposeHigh = this.needs?.thresholds?.purpose?.high ?? 40
        if (purposeNeed >= purposeHigh) {
            this.purposeStrainTicks += 1
        } else {
            this.purposeStrainTicks = Math.max(0, this.purposeStrainTicks - 2)
        }

        this.auditRememberedCaches()

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
        this.updateGroupDynamics(tick)
        this.applyTrustDecay()
        this.updateHealthEvents()

        if (tick % 40 === 0) {
            this.discoverNearbyCaches(120)
        }
        
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
        const knownCaches = this.memoryMap.filter(lm => lm.type === 'resource_cache').length
        return {
            position: { x: this.x, y: this.y },
            behaviorState: this.behaviorState,
            recentAction: this.recentAction,
            currentGoal: this.goals.currentGoal?.type || 'none',
            mostUrgentNeed: mostUrgent.need,
            needValue: Math.round(mostUrgent.value),
            urgency: mostUrgent.urgency,
            inventoryCount: this.inventory.length,
            knownCaches,
            group: {
                id: this.groupState?.id ?? null,
                role: this.groupState?.role ?? 'none',
                leaderId: this.groupState?.leaderId ?? null,
                cohesion: Number((this.groupState?.cohesion ?? 0).toFixed(3)),
                queuedCommands: this.groupCommandQueue?.length ?? 0,
                marks: this.groupMarks?.length ?? 0
            }
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

    rememberLandmark({ x, y, type, significance = 1, name = null, event = null, ...metadata }) {
        // Remove least significant or oldest if at max
        if (this.memoryMap.length >= this.maxLandmarks) {
            this.memoryMap.sort((a, b) => (a.significance ?? 1) - (b.significance ?? 1))
            this.memoryMap.shift()
        }
        this.memoryMap.push({
            x, y, type, significance, name, event,
            ...metadata,
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

    shareSocialLandmarks(otherPawn, options = {}) {
        if (!otherPawn || otherPawn === this) return 0

        const maxShare = options.maxShare ?? 2
        const minSignificance = options.minSignificance ?? 3
        const allowedTypes = new Set(options.allowedTypes ?? ['resource_cache', 'shelter', 'water_source', 'cover', 'home'])
        const storytelling = this.getSkill('storytelling')
        const confidenceFactor = Math.min(1, 0.65 + storytelling * 0.02)
        const knownLandmarks = Array.isArray(otherPawn.memoryMap) ? otherPawn.memoryMap : []

        const candidates = []
        for (const landmark of this.memoryMap ?? []) {
            if (!landmark?.type || !allowedTypes.has(landmark.type)) continue
            if ((landmark.significance ?? 1) < minSignificance) continue
            candidates.push(landmark)
        }

        if (this.homeLandmark && allowedTypes.has('home')) {
            candidates.push({
                x: this.homeLandmark.x,
                y: this.homeLandmark.y,
                type: 'home',
                significance: Math.max(2, this.homeLandmark.significance ?? 1),
                name: `${this.name} Home`,
                event: 'shared_home'
            })
        }

        if (!candidates.length) return 0

        candidates.sort((a, b) => {
            const significanceDelta = (b.significance ?? 1) - (a.significance ?? 1)
            if (significanceDelta !== 0) return significanceDelta
            return (b.timestamp ?? 0) - (a.timestamp ?? 0)
        })

        let sharedCount = 0
        for (const landmark of candidates) {
            if (sharedCount >= maxShare) break

            const alreadyKnown = knownLandmarks.some(existing => {
                if (existing?.type !== landmark.type) return false
                const dx = (existing.x ?? 0) - (landmark.x ?? 0)
                const dy = (existing.y ?? 0) - (landmark.y ?? 0)
                return Math.sqrt(dx * dx + dy * dy) <= 20
            })

            if (alreadyKnown) continue

            otherPawn.rememberLandmark?.({
                x: landmark.x,
                y: landmark.y,
                type: landmark.type,
                significance: Math.max(1, (landmark.significance ?? 1) * confidenceFactor),
                name: confidenceFactor >= 0.75 ? landmark.name ?? null : null,
                event: 'shared_social',
                sourcePawnId: this.id,
                sharedBy: this.name,
                confidence: confidenceFactor
            })
            sharedCount++
        }

        if (sharedCount > 0) {
            this.increaseSkill('storytelling', 0.02 * sharedCount)
            otherPawn.increaseSkill?.('memoryClustering', 0.01 * sharedCount)
        }

        return sharedCount
    }

    registerHuntSuccessFromResource(resource, options = {}) {
        if (!resource) return

        const subtype = String(resource.subtype ?? resource.type ?? '').toLowerCase()
        const tags = resource.tags
        const hasAnimalTag = Array.isArray(tags)
            ? tags.includes('animal')
            : typeof tags?.has === 'function'
                ? tags.has('animal')
                : false

        const isHuntSource = subtype === 'animal' || subtype === 'carcass' || hasAnimalTag
        if (!isHuntSource) return

        const nearbyPartners = this.getNearbyPawns(options.radius ?? 36)
        if (nearbyPartners.length === 0) return

        this.registerHuntSuccess(nearbyPartners)
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

    addThought(text, tag = 'general', priority = false) {
        if (!text) return
        const tick = this.world?.clock?.currentTick ?? 0
        const thoughtText = String(text)

        // If this thought already exists in the log, just refresh it — don't bump sequence
        const existingIndex = this.thoughtLog.findIndex(t => t.text === thoughtText)
        if (existingIndex !== -1) {
            const existing = this.thoughtLog[existingIndex]
            existing.tick = tick
            if (priority) {
                existing.priority = true
            }
            // Move to end (most recent)
            this.thoughtLog.splice(existingIndex, 1)
            this.thoughtLog.push(existing)
            return
        }

        // New thought — bump sequence so the dome picks it up
        this.thoughtSequence++

        this.thoughtLog.push({
            text: thoughtText,
            tag,
            tick,
            priority
        })
        if (this.thoughtLog.length > this.maxThoughtLog) {
            this.thoughtLog.shift()
        }
    }

    getLatestThought() {
        return this.thoughtLog[this.thoughtLog.length - 1] ?? null
    }

    recordChallengeContext(type, strength = 0.06, details = {}) {
        if (!type) return
        const tick = this.world?.clock?.currentTick ?? 0
        this.challengeContexts.push({
            type,
            strength: Math.max(0.01, strength),
            details,
            tick,
            expiresAt: tick + (details.durationTicks ?? 600)
        })
        if (this.challengeContexts.length > this.maxChallengeContexts) {
            this.challengeContexts.shift()
        }
    }

    pruneChallengeContexts() {
        const tick = this.world?.clock?.currentTick ?? 0
        this.challengeContexts = this.challengeContexts.filter(context => (context.expiresAt ?? tick) >= tick)
    }

    getPurposePressureBonus() {
        const purpose = this.needs?.needs?.purpose ?? 0
        const purposeThreshold = this.needs?.thresholds?.purpose?.medium ?? 25
        if (purpose < purposeThreshold) return 0

        const pressure = Math.min(1, (purpose - purposeThreshold) / 50)
        const strain = Math.min(1, this.purposeStrainTicks / 1200)
        return (pressure * 0.1) + (strain * 0.08)
    }

    getPonderWindowBonus() {
        const hunger = this.needs?.needs?.hunger ?? 0
        const thirst = this.needs?.needs?.thirst ?? 0
        const energy = this.needs?.needs?.energy ?? 0

        const survivalLoad = (hunger + thirst + energy) / 300
        const calmWindow = Math.max(0, 1 - survivalLoad)
        const behavior = this.behaviorState ?? 'idle'

        let behaviorBonus = 0
        if (behavior === 'idle') behaviorBonus += 0.05
        if (behavior === 'resting' || behavior === 'sleeping') behaviorBonus += 0.08
        if (behavior === 'learning' || behavior === 'study') behaviorBonus += 0.1

        return Math.max(0, (calmWindow * 0.05) + behaviorBonus)
    }

    getChallengeContextBonus(problemType) {
        this.pruneChallengeContexts()
        if (!this.challengeContexts.length) return 0

        const mapping = {
            need_shelter: new Set(['poor_sleep_ground', 'group_camp_nights', 'cache_decay_loss', 'exposed_night']),
            need_better_tools: new Set(['manual_cutting_hardship']),
            inventory_full: new Set(['inventory_pressure']),
            need_water_container: new Set(['water_handling_hardship'])
        }

        const relevant = mapping[problemType] ?? new Set()
        let total = 0
        for (const context of this.challengeContexts) {
            if (!relevant.has(context.type)) continue
            total += context.strength ?? 0
        }

        return Math.min(0.2, total)
    }

    assessManualCuttingHardship(resource, gathered) {
        const resourceType = String(resource?.subtype ?? resource?.type ?? '').toLowerCase()
        if (!/fiber|grass/.test(resourceType)) return

        const hasCuttingTool = this.inventory.some(item => {
            const type = String(item?.type ?? '').toLowerCase()
            const tags = item?.tags
            const tagList = Array.isArray(tags) ? tags : []
            return type.includes('knife') || type.includes('sharp') || tagList.includes('cutting')
        })

        if (hasCuttingTool) return

        const gatheredQty = Math.max(0.1, gathered?.quantity ?? 1)
        const strength = Math.min(0.09, 0.04 + gatheredQty * 0.015)
        this.recordChallengeContext('manual_cutting_hardship', strength, {
            resourceType,
            durationTicks: 500
        })
        this.addThought('This is hard work. The grass is really torn up.', 'hardship')

        if (Math.random() < 0.35) {
            this.ponderProblem('need_better_tools', {
                reason: 'Cutting fiber and grass by hand is inefficient',
                inspiration: hasCuttingTool ? 'observed' : 'hardship'
            })
        }
    }

    registerRestOutcome(goal = null) {
        const tick = this.world?.clock?.currentTick ?? 0
        const entities = this.world?.entitiesMap ? Array.from(this.world.entitiesMap.values()) : []
        const nearCover = entities.some(entity => {
            const tags = entity?.tags
            const hasCover = Array.isArray(tags) ? tags.includes('cover') : typeof tags?.has === 'function' ? tags.has('cover') : false
            if (!hasCover) return false
            const dx = (entity.x ?? 0) - this.x
            const dy = (entity.y ?? 0) - this.y
            return Math.sqrt(dx * dx + dy * dy) <= 26
        })

        const nearbyPawns = entities.filter(entity => {
            if (entity?.subtype !== 'pawn' || entity.id === this.id) return false
            const dx = (entity.x ?? 0) - this.x
            const dy = (entity.y ?? 0) - this.y
            return Math.sqrt(dx * dx + dy * dy) <= 30
        })

        if (!nearCover) {
            this.exposedNights++
            this.recordChallengeContext('poor_sleep_ground', 0.07, { durationTicks: 900 })
            this.recordChallengeContext('exposed_night', 0.04, { durationTicks: 700 })
            this.addThought('Sleeping on the ground feels rough and unsteady.', 'comfort')

            if (this.exposedNights >= 2) {
                this.ponderProblem('need_shelter', {
                    reason: 'Repeated poor sleep without shelter',
                    inspiration: 'hardship'
                })
            }
        } else {
            this.exposedNights = 0
            // Safe night with shelter: additional trust boost to nearby pawns
            if (nearbyPawns.length >= 1) {
                this.registerSafeNightTrust(nearbyPawns)
            }
        }

        if (nearbyPawns.length >= 1) {
            // Gain proximity-based trust with nearby pawns
            this.registerProximityTrustGain(nearbyPawns)
        }

        if (nearbyPawns.length >= 2) {
            this.groupCampNights++
            this.recordChallengeContext('group_camp_nights', 0.06, { durationTicks: 1000, nearbyPawns: nearbyPawns.length })
            if (this.groupCampNights >= 3) {
                this.addThought('Camping together this long makes me want a permanent place.', 'settlement')
                this.ponderProblem('need_shelter', {
                    reason: 'Group has camped together for several nights',
                    inspiration: 'social'
                })
            }
        } else {
            this.groupCampNights = Math.max(0, this.groupCampNights - 1)
        }

        if ((goal?.duration ?? 0) >= 12 && (this.needs?.needs?.purpose ?? 0) >= 35) {
            this.addThought('Rest gave me time to connect the pieces in my head.', 'insight')
        }

        // NEW: Update home landmark tracking
        this.updateHomeLandmark()

        this.setRecentAction('Reflecting during rest')
        this.lastSleepTime = tick
    }

    updateHomeLandmark() {
        // Called during rest to track/update home location
        // When a pawn sleeps in same location multiple times, it becomes "home"
        if (!this.world?.clock) return

        const sleepX = Math.round(this.x / 10) * 10  // Quantize to 10-unit grid
        const sleepY = Math.round(this.y / 10) * 10

        if (!this.homeLandmark) {
            this.homeLandmark = {
                x: sleepX,
                y: sleepY,
                sleepCount: 1,
                lastSleptAt: this.world.clock.currentTick,
                significance: 1
            }
            return
        }

        // Check if slept at same location (within 10-unit grid)
        const sameLocation = Math.abs(this.homeLandmark.x - sleepX) <= 5 &&
                            Math.abs(this.homeLandmark.y - sleepY) <= 5

        if (sameLocation) {
            this.homeLandmark.sleepCount++
            this.homeLandmark.lastSleptAt = this.world.clock.currentTick

            // Home becomes significant after N reuses
            if (this.homeLandmark.sleepCount >= this.maxHomeReuseForSignificance) {
                this.homeLandmark.significance = Math.max(
                    this.homeLandmark.significance,
                    2 + (this.homeLandmark.sleepCount - this.maxHomeReuseForSignificance) * 0.2
                )
            }
        } else {
            // Moved to new location; reset tracking
            this.homeLandmark = {
                x: sleepX,
                y: sleepY,
                sleepCount: 1,
                lastSleptAt: this.world.clock.currentTick,
                significance: 1
            }
        }
    }

    // Social methods (delegated to PawnSocial module)
    registerProximityTrustGain(nearbyPawns = []) {
        return PawnSocial.registerProximityTrustGain(this, nearbyPawns)
    }

    registerHuntSuccess(huntingPartners = []) {
        return PawnSocial.registerHuntSuccess(this, huntingPartners)
    }

    notifyCacheSharing(cacheBuilderId) {
        return PawnSocial.notifyCacheSharing(this, cacheBuilderId)
    }

    // Tactical methods (delegated to PawnTactical module)
    recordTacticalMemory(type, location, description, significance = 0.5) {
        return PawnTactical.recordTacticalMemory(this, type, location, description, significance)
    }

    updateTacticalMemory(tick) {
        return PawnTactical.updateTacticalMemory(this, tick)
    }

    getTerritoryMemories(minSignificance = 0.3) {
        return PawnTactical.getTerritoryMemories(this, minSignificance)
    }

    updateTerritoryLandmarks() {
        return PawnTactical.updateTerritoryLandmarks(this)
    }

    assignPatrolRoute(member, waypoints) {
        return PawnTactical.assignPatrolRoute(this, member, waypoints)
    }

    assignDefensePosition(member, position) {
        return PawnTactical.assignDefensePosition(this, member, position)
    }

    // Security methods (delegated to PawnSecurity module)
    createSecurityContract(withGroup, type, terms = {}) {
        return PawnSecurity.createSecurityContract(this, withGroup, type, terms)
    }

    getActiveSecurityContracts() {
        return PawnSecurity.getActiveSecurityContracts(this)
    }

    terminateSecurityContract(contractId) {
        return PawnSecurity.terminateSecurityContract(this, contractId)
    }

    createHuntParty(members, targetId, targetLocation) {
        return PawnSecurity.createHuntParty(this, members, targetId, targetLocation)
    }

    updateHuntParty(newTargetLocation) {
        return PawnSecurity.updateHuntParty(this, newTargetLocation)
    }

    endHuntParty(success = false) {
        return PawnSecurity.endHuntParty(this, success)
    }

    registerSharedCacheContribution(cacheId, otherContributors = []) {
        // When pawn adds to a shared cache location, gain trust with other contributors
        // Represents collaborative resource building and investment in shared future
        if (!cacheId || !otherContributors.length) return

        for (const contributor of otherContributors) {
            if (!contributor?.id || contributor.id === this.id) continue

            // Shared cache contribution: +0.12 trust (more than single cache use, represents collective work)
            const baseTrust = 0.12
            const currentTrust = this.getGroupTrustIn(contributor) ?? 0
            const newTrust = Math.min(1, currentTrust + baseTrust)

            this.setGroupTrustIn(contributor, newTrust)

            // Log thought about shared resource investment
            this.addThought(`Adding to the shared cache with ${contributor.name} builds our common reserve.`, 'social')
        }
    }

    registerSafeNightTrust(nearbyPawns = []) {
        // When pawn sleeps safely with shelter/group, gain modest trust with shelter provider
        // Represents safety, reliability, and mutual care
        if (!nearbyPawns.length) return

        for (const otherPawn of nearbyPawns) {
            if (!otherPawn?.id || otherPawn.id === this.id) continue

            // Safe night: +0.05 trust (modest, represents comfort and safety)
            // This accumulates slowly but is more reliable than hunt trust
            const baseTrust = 0.05
            const currentTrust = this.getGroupTrustIn(otherPawn) ?? 0
            const newTrust = Math.min(1, currentTrust + baseTrust)

            this.setGroupTrustIn(otherPawn, newTrust)

            // Log thought about shared safety (less effusive than hunts)
            if (newTrust % 0.2 < 0.06) {  // Log at trust milestones
                this.addThought(`Sleeping safely near ${otherPawn.name} is comforting.`, 'social')
            }
        }
    }

    checkTerritorialOverlapTrigger() {
        // Detect when pawns have memory of overlapping territory (>30% of landmarks)
        // This triggers tribal group formation (territory-based, not proximity-based)
        if (!this.world?.entitiesMap) return null

        const otherPawns = Array.from(this.world.entitiesMap.values()).filter(e =>
            e?.subtype === 'pawn' && e.id !== this.id
        )

        if (otherPawns.length < 1) return null

        // Find pawns with overlapping resource memory (territory overlap)
        const potentialMembers = otherPawns.filter(p => {
            const trust = this.getGroupTrustIn(p) ?? 0
            if (trust < 0.15) return false  // Slightly lower threshold than civic (territory-based)

            // Check if memory landmarks overlap
            const thisMemory = this.memoryMap.slice(0, 10)  // Recent landmarks
            const otherMemory = p.memoryMap?.slice(0, 10) ?? []

            if (!thisMemory.length || !otherMemory.length) return false

            const overlapCount = thisMemory.filter(lm1 =>
                otherMemory.some(lm2 =>
                    Math.hypot(lm2.x - lm1.x, lm2.y - lm1.y) < 40  // Within 40 units = same region
                )
            ).length

            const overlapRatio = overlapCount / Math.min(thisMemory.length, otherMemory.length)
            return overlapRatio >= 0.3  // 30% overlap = shared territory
        })

        if (potentialMembers.length < 1) return null

        return {
            type: 'tribal',
            initiatorId: this.id,
            members: [this, ...potentialMembers],
            territoryOrigin: { x: this.x, y: this.y },
            baseTrust: Math.min(...potentialMembers.map(p => this.getGroupTrustIn(p) ?? 0))
        }
    }

    checkMercantileGroupFormationTrigger() {
        // Detect when pawns have high skill specialization and fair trade history
        // This triggers mercantile group formation (trade-based, expertise-diverse)
        if (!this.world?.entitiesMap) return null

        const otherPawns = Array.from(this.world.entitiesMap.values()).filter(e =>
            e?.subtype === 'pawn' && e.id !== this.id
        )

        if (otherPawns.length < 1) return null

        // Find pawns with complementary skills and consistent positive trades
        const potentialMembers = otherPawns.filter(p => {
            const trust = this.getGroupTrustIn(p) ?? 0
            if (trust < 0.25) return false  // Slightly higher threshold (commerce requires reliability)

            // Check if skills are complementary (different domains)
            const mySkills = Object.keys(this.skills).filter(s => (this.skills[s] ?? 0) > 0.3)
            const theirSkills = Object.keys(p.skills || {}).filter(s => (p.skills[s] ?? 0) > 0.3)

            if (!mySkills.length || !theirSkills.length) return false

            // Simple check: do we have different specializations?
            const overlap = mySkills.filter(s => theirSkills.includes(s)).length
            const diversity = (mySkills.length + theirSkills.length - overlap) / (mySkills.length + theirSkills.length)

            return diversity > 0.4  // 40% different skills = good complementarity
        })

        if (potentialMembers.length < 1) return null

        return {
            type: 'mercantile',
            initiatorId: this.id,
            members: [this, ...potentialMembers],
            tradeValue: 100,  // Base value for trade routes
            baseTrust: Math.min(...potentialMembers.map(p => this.getGroupTrustIn(p) ?? 0))
        }
    }

    /**
     * Apply trust decay over time. Trust slowly erodes when pawns don't interact.
     * Called periodically from the game tick loop.
     */
    applyTrustDecay() {
        if (!this.trustDecayConfig.enabled) return

        const currentTick = this.world?.clock?.currentTick ?? 0
        const { decayPeriod, lastDecayTick, decayRate, decayFloor } = this.trustDecayConfig

        if (currentTick - lastDecayTick < decayPeriod) return

        this.trustDecayConfig.lastDecayTick = currentTick

        for (const [pawnId, trust] of Object.entries(this.groupTrust)) {
            if (trust <= decayFloor) {
                this.groupTrust[pawnId] = decayFloor
                continue
            }

            const newTrust = Math.max(decayFloor, trust - decayRate)
            this.groupTrust[pawnId] = newTrust
        }
    }

    /**
     * Record a behavioral signal that influences branch inclination.
     * @param {'tribal'|'civic'|'mercantile'} branch - The branch this behavior signals
     * @param {number} strength - Signal strength (0.01-0.1)
     */
    recordInclinationSignal(branch, strength = 0.05) {
        if (!this.branchInclination[branch]) return

        // Apply signal
        this.branchInclination[branch] = Math.min(1, this.branchInclination[branch] + strength)

        // Store in history for smoothing
        this.inclinationHistory.push({
            branch,
            strength,
            tick: this.world?.clock?.currentTick ?? 0
        })

        if (this.inclinationHistory.length > this.maxInclinationHistory) {
            this.inclinationHistory.shift()
        }

        // Normalize so inclinations sum to ~1.0
        this.normalizeInclinations()
    }

    /**
     * Normalize inclination values so they sum to 1.0.
     */
    normalizeInclinations() {
        const total = Object.values(this.branchInclination).reduce((a, b) => a + b, 0)
        if (total <= 0) return

        for (const branch of Object.keys(this.branchInclination)) {
            this.branchInclination[branch] = this.branchInclination[branch] / total
        }
    }

    /**
     * Get a bias multiplier for goal selection based on branch inclination.
     * Goals matching the pawn's dominant inclination get a bonus.
     * @param {string} goalType - The goal type to check (e.g., 'hunt', 'build_structure', 'trade')
     * @returns {number} Multiplier (1.0 = neutral, >1.0 = favored, <1.0 = deprioritized)
     */
    getInclinationBias(goalType) {
        const goalBranchMap = {
            // Tribal goals
            'hunt': 'tribal',
            'hunt_animal': 'tribal',
            'follow': 'tribal',
            'protect': 'tribal',
            'scout': 'tribal',
            'mark': 'tribal',
            'fight': 'tribal',
            // Civic goals
            'build_structure': 'civic',
            'stage_build_materials': 'civic',
            'negotiate_group': 'civic',
            'teach_skill': 'civic',
            'socialize': 'civic',
            'rest': 'civic',
            // Mercantile goals
            'trade': 'mercantile',
            'accumulate_valuables': 'mercantile',
            'search_resource': 'mercantile',
            'gather_specific': 'mercantile',
            'craft_item': 'mercantile'
        }

        const goalBranch = goalBranchMap[goalType]
        if (!goalBranch) return 1.0

        const inclination = this.branchInclination[goalBranch] ?? 0.33
        // Map inclination (0-1) to bias multiplier (0.7-1.3)
        return 0.7 + (inclination * 0.6)
    }

    /**
     * Get the dominant branch inclination.
     * @returns {'tribal'|'civic'|'mercantile'} The branch with highest inclination
     */
    getDominantBranch() {
        let maxBranch = 'civic'
        let maxVal = 0

        for (const [branch, val] of Object.entries(this.branchInclination)) {
            if (val > maxVal) {
                maxVal = val
                maxBranch = branch
            }
        }

        return maxBranch
    }

    auditRememberedCaches() {
        const tick = this.world?.clock?.currentTick ?? 0
        if (!this.world?.entitiesMap) return
        if (tick - this.lastCacheAuditTick < 120) return
        this.lastCacheAuditTick = tick

        const knownCaches = this.memoryMap.filter(lm => lm.type === 'resource_cache' && lm.cacheId)
        if (!knownCaches.length) return

        const missing = knownCaches.filter(lm => !this.world.entitiesMap.has(lm.cacheId))
        if (!missing.length) return

        this.cacheLossEvents += missing.length
        this.recordChallengeContext('cache_decay_loss', Math.min(0.12, 0.04 * missing.length), {
            durationTicks: 900,
            count: missing.length
        })
        this.addThought('A cache I relied on is gone. I need sturdier storage.', 'loss')
        this.ponderProblem('need_shelter', {
            reason: 'Temporary cache decayed before retrieval',
            inspiration: 'hardship'
        })
    }
    
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
        
        const purposeBonus = this.getPurposePressureBonus()
        const challengeBonus = this.getChallengeContextBonus(problem.type)
        const ponderWindowBonus = this.getPonderWindowBonus()

        let totalChance = baseChance + attemptBonus + successBonus + observationBonus + lateralBonus + purposeBonus + challengeBonus + ponderWindowBonus

        if (ponderWindowBonus <= 0.02) {
            totalChance *= 0.75
        }

        totalChance = Math.min(0.95, Math.max(0.001, totalChance))
        
        // Apply user intervention multiplier
        totalChance = this.getEffectiveInventionChance(totalChance)
        
        // Try to solve the problem
        if (Math.random() < totalChance) {
            const solution = this.discoverSolution(problem.type, problem.context)
            if (solution) {
                console.log(`💡 ${this.name} has an epiphany: ${solution.name}!`)
                this.addThought(`I have a way to ${solution.unlocks?.replace?.(/_/g, ' ') ?? 'solve this'}.`, 'epiphany')
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

    inferGroupType(groupId = '') {
        const normalized = String(groupId ?? '').toLowerCase()
        if (normalized.startsWith('civic-')) return 'civic'
        if (normalized.startsWith('tribal-')) return 'tribal'
        if (normalized.startsWith('mercantile-')) return 'mercantile'
        return 'generic'
    }

    setActiveGroupState(groupId = null) {
        if (!groupId) {
            this.groupState = {
                id: null,
                role: 'none',
                leaderId: null,
                joinedAt: null,
                cohesion: 0
            }
            return
        }

        const membership = this.groupMemberships[groupId]
        if (!membership) {
            this.setActiveGroupState(null)
            return
        }

        this.groupState = membership
    }

    registerGroupMembership(groupId, { role = 'member', leaderId = null, cohesion = 0.1, type = null } = {}) {
        if (!groupId) return null

        const groupType = type ?? this.inferGroupType(groupId)
        const existingForType = this.groupAffiliationsByType[groupType]
        if (existingForType && existingForType !== groupId) {
            this.leaveGroup(existingForType)
        }

        const existing = this.groupMemberships[groupId] ?? {}
        const membership = {
            id: groupId,
            type: groupType,
            role,
            leaderId,
            joinedAt: existing.joinedAt ?? Date.now(),
            cohesion: Math.max(existing.cohesion ?? 0, cohesion)
        }

        this.groupMemberships[groupId] = membership
        this.groupAffiliationsByType[groupType] = groupId
        this.reputation.membership[groupId] = role
        this.setActiveGroupState(groupId)
        return membership
    }

    createGroup(groupId = `group-${this.id}-${Date.now()}`) {
        this.registerGroupMembership(groupId, {
            role: 'leader',
            leaderId: this.id,
            cohesion: Math.max(this.groupState?.cohesion ?? 0, 0.2),
            type: this.inferGroupType(groupId)
        })
        return groupId
    }

    joinGroup(leaderPawn, groupId = leaderPawn?.groupState?.id) {
        if (!leaderPawn?.id || !groupId) return false

        this.registerGroupMembership(groupId, {
            role: 'member',
            leaderId: leaderPawn.id,
            cohesion: Math.max(this.groupState?.cohesion ?? 0, 0.1),
            type: this.inferGroupType(groupId)
        })
        return true
    }

    leaveGroup(groupId = this.groupState?.id) {
        if (!groupId) return

        const membership = this.groupMemberships[groupId]
        const groupType = membership?.type ?? this.inferGroupType(groupId)

        if (groupId && this.reputation?.membership) {
            delete this.reputation.membership[groupId]
        }

        if (this.groupMemberships[groupId]) {
            delete this.groupMemberships[groupId]
        }

        if (this.groupAffiliationsByType[groupType] === groupId) {
            delete this.groupAffiliationsByType[groupType]
        }

        if (this.groupNegotiation?.groupId === groupId) {
            this.groupNegotiation = null
        }

        if (this.groupState?.id === groupId) {
            const nextGroupId = Object.keys(this.groupMemberships)[0] ?? null
            this.setActiveGroupState(nextGroupId)
            this.groupCommandQueue = []
        }
    }

    getNearbyPawns(radius = 30, includeSelf = false) {
        if (!this.world?.entitiesMap) return []

        return Array.from(this.world.entitiesMap.values()).filter(entity => {
            if (entity?.subtype !== 'pawn') return false
            if (!includeSelf && entity.id === this.id) return false

            const dx = (entity.x ?? 0) - this.x
            const dy = (entity.y ?? 0) - this.y
            return Math.sqrt(dx * dx + dy * dy) <= radius
        })
    }

    getCivicNegotiationMembers(trigger = null, meetingRadius = 34) {
        const civicTrigger = trigger ?? this.checkCivicGroupFormationTrigger?.()
        if (!civicTrigger?.members?.length) return []

        return civicTrigger.members.filter(member => {
            if (!member?.id) return false
            if (member.id === this.id) return true

            const dx = (member.x ?? 0) - this.x
            const dy = (member.y ?? 0) - this.y
            return Math.sqrt(dx * dx + dy * dy) <= meetingRadius
        })
    }

    beginCivicNegotiation(trigger = null, options = {}) {
        const civicTrigger = trigger ?? this.checkCivicGroupFormationTrigger?.()
        if (!civicTrigger?.members?.length) return null

        const tick = this.world?.clock?.currentTick ?? 0
        const dayPhase = this.world?.clock?.getDayPhase?.() ?? 'day'
        const meetingRadius = options.meetingRadius ?? 34
        const presentMembers = this.getCivicNegotiationMembers(civicTrigger, meetingRadius)

        if (presentMembers.length < 2) return null

        const nearbyCivicGroupId = presentMembers
            .map(member => member.groupAffiliationsByType?.civic ?? null)
            .find(Boolean) ?? null

        const existingGroupId = this.groupAffiliationsByType?.civic ?? null
        const groupId = nearbyCivicGroupId || existingGroupId || civicTrigger.groupId || `civic-${this.id}-${tick}`
        const recruitmentDeadlineTick = tick + (options.recruitmentWindowTicks ?? 720)
        const memberIds = civicTrigger.members.map(member => member.id)

        if (!this.groupMemberships?.[groupId]) {
            this.createGroup(groupId)
        }

        const existingMembers = this.getGroupMembers(groupId)
        const leader = existingMembers.find(member => {
            const role = member.groupMemberships?.[groupId]?.role ?? member.groupState?.role
            return role === 'leader'
        }) ?? this.getGroupLeader?.() ?? this
        const groupMembers = presentMembers.slice()

        for (const member of groupMembers) {
            const currentCivicGroup = member.groupAffiliationsByType?.civic
            if (currentCivicGroup && currentCivicGroup !== groupId) {
                member.leaveGroup(currentCivicGroup)
            }

            if (member.id === leader.id) {
                member.registerGroupMembership(groupId, {
                    role: 'leader',
                    leaderId: leader.id,
                    cohesion: Math.max(member.groupState?.cohesion ?? 0, groupMembers.length >= 3 ? 0.45 : 0.3),
                    type: 'civic'
                })
                continue
            }

            member.joinGroup(leader, groupId)
            member.groupState.cohesion = Math.max(member.groupState.cohesion ?? 0, groupMembers.length >= 3 ? 0.35 : 0.2)
        }

        for (const member of groupMembers) {
            member.groupNegotiation = {
                type: 'civic',
                groupId,
                initiatedBy: this.id,
                targetCount: 3,
                memberIds,
                presentMemberIds: groupMembers.map(entry => entry.id),
                pendingThird: groupMembers.length < 3 || memberIds.length > groupMembers.length,
                createdAt: tick,
                recruitmentDeadlineTick,
                nextRecruitAttemptTick: tick + 60,
                dayPhase
            }
        }

        if (groupMembers.length >= 3) {
            for (const member of groupMembers) {
                member.groupNegotiation.pendingThird = false
            }
        }

        const bonusTrust = groupMembers.length >= 3 ? 0.12 : 0.08
        for (const member of groupMembers) {
            for (const other of groupMembers) {
                if (member.id === other.id) continue
                const currentTrust = member.getGroupTrustIn(other) ?? 0
                member.setGroupTrustIn(other, Math.min(1, currentTrust + bonusTrust))
            }

            member.addThought(
                groupMembers.length >= 3
                    ? 'We settled our plans together and the group feels real now.'
                    : 'We started a civic plan and will need one more voice soon.',
                'social'
            )
        }

        return {
            groupId,
            members: groupMembers,
            pendingThird: groupMembers.length < 3,
            recruitmentDeadlineTick
        }
    }

    completeCivicNegotiation(goal = null) {
        const trigger = goal?.negotiationTrigger ?? this.checkCivicGroupFormationTrigger?.()
        const meetingRadius = goal?.meetingRadius ?? 34
        const participants = goal?.negotiationMembers ?? this.getCivicNegotiationMembers(trigger, meetingRadius)

        if (participants.length < 2) return null

        return this.beginCivicNegotiation(trigger ?? { members: participants }, {
            meetingRadius,
            recruitmentWindowTicks: goal?.recruitmentWindowTicks ?? 720
        })
    }

    getGroupLeader() {
        const leaderId = this.groupState?.leaderId
        if (!leaderId || !this.world?.entitiesMap) return null
        return this.world.entitiesMap.get(leaderId) ?? null
    }

    getGroupMembers(groupId = this.groupState?.id) {
        if (!groupId || !this.world?.entitiesMap) return []

        return Array.from(this.world.entitiesMap.values()).filter(entity =>
            entity?.subtype === 'pawn' &&
            (entity.groupMemberships?.[groupId] || entity.groupState?.id === groupId)
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
        if (!this.canObeyLeader(issuedByPawn, minTrust)) {
            this.groupStats.rejectedCommands = (this.groupStats.rejectedCommands ?? 0) + 1
            this.groupState.cohesion = Math.max(0, (this.groupState.cohesion ?? 0) - 0.02)
            return false
        }

        this.groupCommandQueue.push({
            ...command,
            issuedBy: issuedByPawn.id,
            issuedAt: Date.now()
        })
        this.groupStats.obeyedCommands = (this.groupStats.obeyedCommands ?? 0) + 1
        this.groupState.cohesion = Math.min(1, (this.groupState.cohesion ?? 0) + 0.02)
        return true
    }

    issueGroupCommand(command) {
        if (!command || this.groupState?.role !== 'leader') return 0

        if (command.type === 'obey') {
            const newLeader = command.newLeader ?? command.target ?? null
            if (!newLeader?.id) return 0

            const reassigned = this.getGroupMembers().filter(member => member.id !== this.id)
            const transferred = this.transferGroupLeadership(newLeader)
            if (!transferred) return 0

            const obeyCommand = {
                type: 'obey',
                target: newLeader,
                priority: command.priority ?? 9,
                duration: command.duration ?? 80,
                minTrust: -1,
                issuedBy: newLeader.id,
                issuedAt: Date.now()
            }

            for (const member of reassigned) {
                if (member.id === newLeader.id) continue
                member.groupCommandQueue.push({ ...obeyCommand })
            }

            return reassigned.length
        }

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

        if (command.type === 'scout') {
            return {
                type: 'scout_area',
                priority: basePriority,
                description: 'Scout assigned area for group',
                targetType: 'location',
                targetLocation: command.targetLocation ?? { x: this.x, y: this.y },
                radius: command.radius ?? 120,
                action: 'scout',
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

        if (command.type === 'patrol') {
            return {
                type: 'patrol_route',
                priority: basePriority,
                description: 'Patrol assigned route for group defense',
                targetType: 'route',
                waypoints: command.waypoints ?? [],
                routeId: command.routeId ?? null,
                action: 'patrol',
                duration,
                groupCommand: true
            }
        }

        if (command.type === 'defend') {
            const target = command.target ?? null
            return {
                type: 'defend_position',
                priority: basePriority,
                description: 'Defend assigned position for group',
                targetType: 'location',
                targetLocation: command.targetLocation ?? (target ? { x: target.x, y: target.y } : { x: this.x, y: this.y }),
                target,
                action: 'defend',
                duration,
                groupCommand: true
            }
        }

        if (command.type === 'obey') {
            const newLeader = command.newLeader ?? command.target ?? null
            return {
                type: 'obey_leader',
                priority: basePriority,
                description: 'Obey leadership transfer order',
                targetType: 'entity',
                targetSubtype: 'pawn',
                targetId: newLeader?.id,
                target: newLeader,
                action: 'obey',
                duration,
                groupCommand: true
            }
        }

        return null
    }

    transferGroupLeadership(newLeaderPawn) {
        const groupId = this.groupState?.id
        if (!groupId || !newLeaderPawn?.id || newLeaderPawn.id === this.id) return false
        if (newLeaderPawn.groupState?.id !== groupId) return false
        if (this.groupState?.role !== 'leader') return false

        const members = this.getGroupMembers()
        for (const member of members) {
            if (member.id === newLeaderPawn.id) {
                member.groupState.role = 'leader'
                member.groupState.leaderId = newLeaderPawn.id
                member.groupState.cohesion = Math.max(member.groupState.cohesion ?? 0, 0.4)
                member.reputation.membership[groupId] = 'leader'
            } else {
                member.groupState.role = 'member'
                member.groupState.leaderId = newLeaderPawn.id
                member.reputation.membership[groupId] = 'member'
            }
        }

        this.groupStats.promotions = (this.groupStats.promotions ?? 0) + 1
        return true
    }

    shouldPromoteNewLeader() {
        if (this.groupState?.role !== 'member') return false
        const leader = this.getGroupLeader()
        if (!leader) return false

        const cohesion = this.groupState.cohesion ?? 0
        const trust = this.getGroupTrustIn(leader)
        const leadershipAptitude = (this.getSkill('planning') + this.getSkill('cooperation')) / 2

        return (
            cohesion >= this.groupConfig.promotionCohesion &&
            trust >= this.groupConfig.promotionTrust &&
            leadershipAptitude >= 6
        )
    }

    updateGroupDynamics(tick) {
        if (!this.groupState?.id || tick % 50 !== 0) return

        if (this.groupNegotiation?.recruitmentDeadlineTick && tick > this.groupNegotiation.recruitmentDeadlineTick) {
            const negotiationGroupId = this.groupNegotiation.groupId ?? this.groupState?.id
            const groupType = this.inferGroupType(negotiationGroupId)
            const members = this.getGroupMembers(negotiationGroupId)

            if (this.groupNegotiation.pendingThird && groupType === 'civic' && members.length > 0 && members.length < 3) {
                for (const member of members) {
                    member.addThought('Our civic plan lost momentum and dissolved.', 'social')
                    member.leaveGroup(negotiationGroupId)
                }
                return
            }

            this.groupNegotiation = null
        }

        if (this.groupNegotiation?.pendingThird && (this.groupState?.id || this.groupNegotiation?.groupId)) {
            const members = this.getGroupMembers(this.groupNegotiation.groupId ?? this.groupState?.id)
            if (members.length >= 3) {
                this.groupNegotiation.pendingThird = false
            }
        }

        if (this.groupState.role === 'leader') {
            this.groupState.cohesion = Math.max(0.1, (this.groupState.cohesion ?? 0) - 0.001)
            return
        }

        const leader = this.getGroupLeader()
        if (!leader) {
            this.leaveGroup()
            return
        }

        const dx = leader.x - this.x
        const dy = leader.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const maxDistance = this.groupConfig.maxCohesionDistance

        if (distance > maxDistance) {
            this.groupState.cohesion = Math.max(0, (this.groupState.cohesion ?? 0) - this.groupConfig.cohesionDecayFar)
        } else {
            this.groupState.cohesion = Math.max(0, (this.groupState.cohesion ?? 0) - this.groupConfig.cohesionDecayNear)
            if (distance < 90) {
                this.groupState.cohesion = Math.min(1, (this.groupState.cohesion ?? 0) + 0.01)
            }
        }

        if ((this.groupState.cohesion ?? 0) <= 0.01) {
            this.leaveGroup()
            return
        }

        if (this.shouldPromoteNewLeader()) {
            this.groupState.role = 'leader-candidate'
        }

        // Phase 1: Update tactical memory and territory loops
        this.updateTacticalMemory(tick)

        // Phase 1: Update patrol routes if assigned
        if (this.groupState.role === 'member' && Object.keys(this.patrolRoutes).length > 0) {
            this.updatePatrolRoutes(tick)
        }

        // Phase 1: Update defense assignments if assigned
        if (Object.keys(this.defenseAssignments).length > 0) {
            this.updateDefenseAssignments(tick)
        }

        // Phase 1: Update hunt party coordination
        if (this.huntParty) {
            this.updateHuntParty(tick)
        }
    }

    /**
     * Record tactical memory for territory awareness.
     * @param {string} type - 'territory'|'route'|'threat'|'resource'
     * @param {object} location - { x, y }
     * @param {string} description - Human-readable description
     * @param {number} significance - 0-1 importance weight
     */
    recordTacticalMemory(type, location, description, significance = 0.5) {
        const tick = this.world?.clock?.currentTick ?? 0
        this.tacticalMemory.push({ type, location, description, tick, significance })

        if (this.tacticalMemory.length > this.maxTacticalMemory) {
            // Keep most significant memories
            this.tacticalMemory.sort((a, b) => b.significance - a.significance)
            this.tacticalMemory = this.tacticalMemory.slice(0, this.maxTacticalMemory)
        }
    }

    /**
     * Update tactical memory decay and territory awareness.
     */
    updateTacticalMemory(tick) {
        if (tick % 100 !== 0) return

        // Decay old memories
        this.tacticalMemory = this.tacticalMemory.filter(memory => {
            const age = tick - memory.tick
            if (age > 1000) return false // Remove very old memories
            memory.significance = Math.max(0, memory.significance - 0.01) // Slow decay
            return memory.significance > 0
        })

        // Update territory landmarks based on recent memories
        const territoryMemories = this.tacticalMemory.filter(m => m.type === 'territory')
        if (territoryMemories.length > 0) {
            this.updateTerritoryLandmarks(territoryMemories)
        }
    }

    /**
     * Update territory landmarks from tactical memories.
     */
    updateTerritoryLandmarks(territoryMemories) {
        const tick = this.world?.clock?.currentTick ?? 0

        for (const memory of territoryMemories) {
            const existing = this.territoryLandmarks.find(
                l => Math.abs(l.x - memory.location.x) < 20 && Math.abs(l.y - memory.location.y) < 20
            )

            if (existing) {
                existing.significance = Math.min(1, existing.significance + 0.05)
            } else if (memory.significance > 0.3) {
                this.territoryLandmarks.push({
                    x: memory.location.x,
                    y: memory.location.y,
                    type: memory.description,
                    significance: memory.significance,
                    claimedAt: tick
                })
            }
        }
    }

    /**
     * Get territory memories that influence patrol and defense decisions.
     */
    getTerritoryMemories() {
        return this.tacticalMemory.filter(m => m.type === 'territory' && m.significance > 0.2)
    }

    /**
     * Assign a patrol route to a group member.
     * @param {string} routeId - Unique route identifier
     * @param {Array} waypoints - Array of { x, y } waypoints
     * @param {object} issuedByPawn - Pawn issuing the patrol assignment
     */
    assignPatrolRoute(routeId, waypoints, issuedByPawn) {
        if (this.groupState?.role !== 'leader' || !waypoints?.length) return false

        const tick = this.world?.clock?.currentTick ?? 0
        const members = this.getGroupMembers().filter(m => m.id !== this.id)

        for (const member of members) {
            member.patrolRoutes[routeId] = {
                waypoints,
                assignedAt: tick,
                active: true,
                assignedBy: this.id
            }
        }

        this.recordTacticalMemory('route', waypoints[0], `Patrol route ${routeId} assigned`, 0.6)
        return true
    }

    /**
     * Update patrol route execution for assigned member.
     */
    updatePatrolRoutes(tick) {
        for (const [routeId, route] of Object.entries(this.patrolRoutes)) {
            if (!route.active) continue

            // Patrol execution is handled by goal system when patrol_route goal is active
            // This just ensures route data stays current
            route.active = true
        }
    }

    /**
     * Assign a defense position to a group member.
     * @param {string} assignmentId - Unique assignment identifier
     * @param {object} position - { x, y } position to defend
     * @param {object} issuedByPawn - Pawn issuing the defense assignment
     */
    assignDefensePosition(assignmentId, position, issuedByPawn) {
        if (this.groupState?.role !== 'leader' || !position) return false

        const tick = this.world?.clock?.currentTick ?? 0
        const members = this.getGroupMembers().filter(m => m.id !== this.id)

        for (const member of members) {
            member.defenseAssignments[assignmentId] = {
                position,
                assignedAt: tick,
                defendingGroup: this.groupState?.id,
                active: true,
                assignedBy: this.id
            }
        }

        this.recordTacticalMemory('territory', position, `Defense position ${assignmentId} assigned`, 0.7)
        return true
    }

    /**
     * Update defense assignment execution for assigned member.
     */
    updateDefenseAssignments(tick) {
        for (const [assignmentId, assignment] of Object.entries(this.defenseAssignments)) {
            if (!assignment.active) continue

            // Defense execution is handled by goal system when defend_position goal is active
            assignment.active = true
        }
    }

    /**
     * Create a coordinated hunt with party members.
     * @param {object} target - Target entity or { x, y, type }
     * @param {Array} partyMembers - Array of pawn IDs to include in hunt party
     */
    createHuntParty(target, partyMembers = []) {
        if (this.groupState?.role !== 'leader') return null

        const tick = this.world?.clock?.currentTick ?? 0
        const partyId = `hunt-${this.id}-${tick}`
        const targetLocation = target ? { x: target.x ?? 0, y: target.y ?? 0 } : { x: this.x, y: this.y }

        const huntParty = {
            partyId,
            targetId: target?.id ?? null,
            targetLocation,
            target,
            members: [this.id, ...partyMembers],
            startedAt: tick,
            active: true
        }

        // Assign hunt party to all members
        for (const memberId of partyMembers) {
            const member = this.world?.entitiesMap?.get(memberId)
            if (member && member.subtype === 'pawn') {
                member.huntParty = { ...huntParty }
                member.recordTacticalMemory('threat', targetLocation, `Hunt target ${target?.type ?? 'unknown'}`, 0.8)
            }
        }

        this.huntParty = huntParty
        this.recordTacticalMemory('threat', targetLocation, `Leading hunt for ${target?.type ?? 'unknown'}`, 0.9)

        return huntParty
    }

    /**
     * Update hunt party coordination during active hunt.
     */
    updateHuntParty(tick) {
        if (!this.huntParty || !this.huntParty.active) return

        // Check if hunt target is still valid
        if (this.huntParty.targetId) {
            const target = this.world?.entitiesMap?.get(this.huntParty.targetId)
            if (!target) {
                // Target no longer exists, end hunt
                this.endHuntParty(false)
                return
            }

            // Update target location for party coordination
            this.huntParty.targetLocation = { x: target.x, y: target.y }
        }

        // Check if hunt duration has expired
        const huntDuration = tick - this.huntParty.startedAt
        if (huntDuration > 600) { // 600 tick max hunt duration
            this.endHuntParty(false)
        }
    }

    /**
     * End hunt party and record results.
     * @param {boolean} success - Whether the hunt was successful
     */
    endHuntParty(success = false) {
        if (!this.huntParty) return

        const tick = this.world?.clock?.currentTick ?? 0
        const huntTarget = this.huntParty.target
        const partySize = this.huntParty.members.length

        this.huntHistory.push({
            target: huntTarget,
            success,
            tick,
            partySize
        })

        // Notify all party members
        for (const memberId of this.huntParty.members) {
            const member = this.world?.entitiesMap?.get(memberId)
            if (member && member.subtype === 'pawn') {
                member.huntParty = null
                member.huntHistory.push({
                    target: huntTarget,
                    success,
                    tick,
                    partySize
                })

                if (success) {
                    member.addThought('Our hunt was successful!', 'social')
                } else {
                    member.addThought('Our hunt ended without success.', 'social')
                }
            }
        }

        this.huntParty = null
    }

    /**
     * Create a security contract between groups for patrol or defense.
     * @param {string} contractId - Unique contract identifier
     * @param {string} withGroup - Group ID to contract with
     * @param {string} type - 'patrol'|'defense'
     * @param {object} terms - Contract terms { waypoints, position, duration, compensation }
     */
    createSecurityContract(contractId, withGroup, type, terms = {}) {
        if (this.groupState?.role !== 'leader') return null

        const tick = this.world?.clock?.currentTick ?? 0
        const contract = {
            contractId,
            withGroup,
            type,
            terms,
            active: true,
            createdAt: tick
        }

        this.securityContracts[contractId] = contract
        this.recordTacticalMemory(type === 'patrol' ? 'route' : 'territory', terms.waypoints?.[0] ?? terms.position ?? { x: this.x, y: this.y }, `Security contract ${contractId}`, 0.8)

        return contract
    }

    /**
     * Get active security contracts.
     */
    getActiveSecurityContracts() {
        return Object.values(this.securityContracts).filter(c => c.active)
    }

    /**
     * Terminate a security contract.
     * @param {string} contractId - Contract to terminate
     */
    terminateSecurityContract(contractId) {
        const contract = this.securityContracts[contractId]
        if (contract && contract.active) {
            contract.active = false
            return true
        }
        return false
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
            this.recordChallengeContext('water_handling_hardship', 0.06, {
                durationTicks: 700,
                itemType: 'water'
            })
            this.addThought('I can gather water, but I cannot carry it like this.', 'constraint')
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
            this.recordChallengeContext('inventory_pressure', 0.06, {
                durationTicks: 700,
                itemType: item.type
            })
            this.addThought('My hands are full. I need better ways to carry things.', 'constraint')
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

        // Pre-check availability (inventory + optional at-source ingredients)
        for (const req of recipe.requiredItems) {
            const invCount = this.inventory.filter(item => item.type === req.type).length
            if (invCount >= req.count) continue

            if (!req.allowSourceUse) {
                console.warn(`${this.name} lacks ${req.type} (need ${req.count}, have ${invCount})`)
                return null
            }

            const sourceCount = this.countNearbySourceUnits(req)
            if ((invCount + sourceCount) < req.count) {
                console.warn(`${this.name} lacks ${req.type} near source (need ${req.count}, have ${invCount} + ${sourceCount} source)`)
                return null
            }
        }

        // Collect and remove required items from inventory
        const consumed = []
        for (const req of recipe.requiredItems) {
            const items = this.inventory.filter(item => item.type === req.type)
            const neededFromInventory = Math.min(req.count, items.length)

            // Remove required count
            for (let i = 0; i < neededFromInventory; i++) {
                const item = items[i]
                this.removeItemFromInventory(item.id)
                consumed.push(item)
            }

            const stillNeeded = req.count - neededFromInventory
            if (stillNeeded > 0) {
                const sourced = this.consumeRecipeRequirementAtSource(req, stillNeeded)
                if (sourced < stillNeeded) {
                    console.warn(`${this.name} failed to source ${req.type} at crafting site`)
                    return null
                }
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

        this.setRecentAction(`Crafted ${output.name}`)

        console.log(`${this.name} crafted ${output.name} (quality: ${output.quality.toFixed(2)}, durability: ${output.durability.toFixed(2)})`)
        return output
    }

    setRecentAction(action) {
        if (!action) return
        this.recentAction = String(action)
        this.recentActionTick = this.world?.clock?.currentTick ?? this.recentActionTick ?? 0
    }

    getDayTicks() {
        const turnSeconds = this.constructor.TURN_GAME_SECONDS ?? 48
        const daySeconds = this.constructor.GAME_DAY_SECONDS ?? (6 * 60 * 48)
        const dayTicks = Math.round(daySeconds / turnSeconds)
        return Math.max(1, dayTicks)
    }

    getNearbyCaches(radius = 90) {
        const entities = this.world?.entitiesMap ? Array.from(this.world.entitiesMap.values()) : []
        return entities.filter(entity => {
            if (entity?.subtype !== 'cache') return false
            const dx = (entity.x ?? 0) - this.x
            const dy = (entity.y ?? 0) - this.y
            return Math.sqrt(dx * dx + dy * dy) <= radius
        })
    }

    createResourceCache({ x = this.x, y = this.y, purpose = 'general', name = null } = {}) {
        if (!this.world) return null
        const tick = this.world.clock?.currentTick ?? 0
        const id = `cache_${this.id}_${tick}_${Math.random().toString(36).slice(2, 7)}`
        const cache = new ResourceCache(id, name ?? `${this.name} Cache`, x, y, {
            ownerId: this.id,
            purpose,
            shared: true
        })
        this.world.addEntity(cache)
        this.rememberResourceCache(cache, { significance: 4, event: 'created' })
        this.setRecentAction(`Created ${purpose} cache`)
        return cache
    }

    rememberResourceCache(cache, { significance = 4, event = 'seen' } = {}) {
        if (!cache) return
        this.rememberLandmark({
            x: cache.x,
            y: cache.y,
            type: 'resource_cache',
            significance,
            name: cache.name,
            event,
            cacheId: cache.id,
            purpose: cache.purpose
        })
    }

    findOrCreateResourceCache({ purpose = 'general', radius = 60, x = this.x, y = this.y } = {}) {
        const nearby = this.getNearbyCaches(radius)
        const matching = nearby.find(cache => cache.purpose === purpose) ?? nearby[0]
        if (matching) {
            this.rememberResourceCache(matching, { significance: 4, event: 'reused' })
            return matching
        }
        return this.createResourceCache({ x, y, purpose })
    }

    stashInventoryInCache({
        cache = null,
        itemTypes = [],
        maxItems = Infinity,
        purpose = 'general',
        location = null
    } = {}) {
        const targetCache = cache ?? this.findOrCreateResourceCache({
            purpose,
            x: location?.x ?? this.x,
            y: location?.y ?? this.y
        })

        if (!targetCache) return { cache: null, stashed: 0 }

        const tick = this.world?.clock?.currentTick ?? 0
        const wanted = Array.isArray(itemTypes) ? new Set(itemTypes) : new Set()
        const shouldInclude = item => wanted.size === 0 || wanted.has(item.type)

        const toMove = []
        for (const item of this.inventory) {
            if (!shouldInclude(item)) continue
            toMove.push(item)
            if (toMove.length >= maxItems) break
        }

        let moved = 0
        for (const item of toMove) {
            if (!targetCache.addItem(item, tick)) continue
            this.removeItemFromInventory(item.id)
            moved++
        }

        if (moved > 0) {
            if (!Array.isArray(targetCache.contributorIds)) {
                targetCache.contributorIds = []
            }
            if (!targetCache.contributorIds.includes(this.id)) {
                targetCache.contributorIds.push(this.id)
            }

            const contributors = targetCache.contributorIds
                .filter(id => id && id !== this.id)
                .map(id => this.world?.entitiesMap?.get(id))
                .filter(entity => entity?.subtype === 'pawn')

            if (contributors.length > 0) {
                this.registerSharedCacheContribution(targetCache.id, contributors)
            }

            this.rememberResourceCache(targetCache, {
                significance: Math.min(8, 4 + moved * 0.2),
                event: 'stashed'
            })
            this.setRecentAction(`Stashed ${moved} item(s) at cache`)
        }

        return { cache: targetCache, stashed: moved }
    }

    retrieveFromCache({ cache, itemType, count = 1 } = {}) {
        if (!cache || !itemType || count <= 0) return 0
        const tick = this.world?.clock?.currentTick ?? 0
        const pulled = cache.takeItems(itemType, count, tick)

        let added = 0
        for (const item of pulled) {
            const ok = this.addItemToInventory(item)
            if (!ok) {
                cache.addItem(item, tick)
                continue
            }
            added++
        }

        if (added > 0) {
            const contributorIds = Array.isArray(cache.contributorIds) ? cache.contributorIds : []
            const trustedContributorId = contributorIds.find(id => id && id !== this.id) ?? null
            const builderId = cache.ownerId && cache.ownerId !== this.id
                ? cache.ownerId
                : trustedContributorId

            if (builderId) {
                this.notifyCacheSharing(builderId)
            }

            this.rememberResourceCache(cache, { significance: 5, event: 'retrieved' })
            this.setRecentAction(`Retrieved ${added} ${itemType} from cache`)
        }

        return added
    }

    startFiberSoakAtCache({ cache = null, fiberCount = 1 } = {}) {
        const targetCache = cache ?? this.findOrCreateResourceCache({ purpose: 'fiber_soak' })
        if (!targetCache) return false

        const dayTicks = this.getDayTicks()
        const tick = this.world?.clock?.currentTick ?? 0
        const moved = this.stashInventoryInCache({
            cache: targetCache,
            itemTypes: ['fiber'],
            maxItems: fiberCount,
            purpose: 'fiber_soak'
        }).stashed

        if (moved <= 0) return false

        const started = targetCache.startSoakJob({
            inputType: 'fiber',
            outputType: 'soaked_fiber',
            quantity: moved,
            durationTicks: dayTicks,
            tick,
            itemFactory: index => ({
                id: `soaked_fiber_${tick}_${index}_${Math.random().toString(36).slice(2, 8)}`,
                type: 'soaked_fiber',
                name: 'Soaked Fiber',
                quality: 1.1,
                durability: 1.2,
                weight: 1,
                size: 1,
                tags: ['material', 'fiber', 'soaked']
            })
        })

        if (started) {
            this.rememberResourceCache(targetCache, { significance: 7, event: 'soak_started' })
            this.setRecentAction('Started fiber soak (1 day)')
            return true
        }

        return false
    }

    discoverNearbyCaches(radius = 120) {
        const nearby = this.getNearbyCaches(radius)
        for (const cache of nearby) {
            const itemCount = cache.totalItems?.() ?? 0
            const significance = Math.min(8, 3 + itemCount * 0.15)
            this.rememberResourceCache(cache, { significance, event: 'discovered' })
        }
        return nearby.length
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

    /**
     * Serialize Phase 0 state for save/load persistence.
     * Includes group state, trust, inclinations, and home landmark.
     * @returns {object} Serializable state object
     */
    serializePhase0State() {
        return {
            groupState: { ...this.groupState },
            groupTrust: { ...this.groupTrust },
            groupMemberships: { ...this.groupMemberships },
            groupAffiliationsByType: { ...this.groupAffiliationsByType },
            groupNegotiation: this.groupNegotiation ? { ...this.groupNegotiation } : null,
            groupStats: { ...this.groupStats },
            branchInclination: { ...this.branchInclination },
            inclinationHistory: [...this.inclinationHistory],
            trustDecayConfig: { ...this.trustDecayConfig },
            homeLandmark: this.homeLandmark ? { ...this.homeLandmark } : null
        }
    }

    /**
     * Serialize Phase 1 state for save/load persistence.
     * Includes tactical memory, patrol routes, defense assignments, hunt coordination, and security contracts.
     * @returns {object} Serializable state object
     */
    serializePhase1State() {
        return {
            tacticalMemory: [...this.tacticalMemory],
            patrolRoutes: { ...this.patrolRoutes },
            defenseAssignments: { ...this.defenseAssignments },
            territoryLandmarks: [...this.territoryLandmarks],
            huntParty: this.huntParty ? { ...this.huntParty } : null,
            huntHistory: [...this.huntHistory],
            securityContracts: { ...this.securityContracts }
        }
    }

    /**
     * Load Phase 0 state from a serialized object.
     * @param {object} state - Previously serialized Phase 0 state
     */
    loadPhase0State(state) {
        if (!state) return

        if (state.groupState) Object.assign(this.groupState, state.groupState)
        if (state.groupTrust) Object.assign(this.groupTrust, state.groupTrust)
        if (state.groupMemberships) Object.assign(this.groupMemberships, state.groupMemberships)
        if (state.groupAffiliationsByType) Object.assign(this.groupAffiliationsByType, state.groupAffiliationsByType)
        if (state.groupNegotiation) Object.assign(this.groupNegotiation ?? {}, state.groupNegotiation)
        if (state.groupStats) Object.assign(this.groupStats, state.groupStats)
        if (state.branchInclination) Object.assign(this.branchInclination, state.branchInclination)
        if (state.inclinationHistory) this.inclinationHistory = [...state.inclinationHistory]
        if (state.trustDecayConfig) Object.assign(this.trustDecayConfig, state.trustDecayConfig)
        if (state.homeLandmark) {
            this.homeLandmark = { ...state.homeLandmark }
        }
    }

    /**
     * Load Phase 1 state from a serialized object.
     * @param {object} state - Previously serialized Phase 1 state
     */
    loadPhase1State(state) {
        if (!state) return

        if (state.tacticalMemory) this.tacticalMemory = [...state.tacticalMemory]
        if (state.patrolRoutes) Object.assign(this.patrolRoutes, state.patrolRoutes)
        if (state.defenseAssignments) Object.assign(this.defenseAssignments, state.defenseAssignments)
        if (state.territoryLandmarks) this.territoryLandmarks = [...state.territoryLandmarks]
        if (state.huntParty) this.huntParty = { ...state.huntParty }
        if (state.huntHistory) this.huntHistory = [...state.huntHistory]
        if (state.securityContracts) Object.assign(this.securityContracts, state.securityContracts)
    }

}

export default Pawn
