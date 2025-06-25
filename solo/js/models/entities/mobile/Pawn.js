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
        this.inventory = []
        this.skills = {
            planning: 0, // Planning skill for idle automation
            orienteering: 0, // Affects map accuracy
            cartography: 0,  // Affects map detail and persistence
            storytelling: 0, // Affects oral map sharing
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
            this.behaviorState = resource.tags?.includes('food') ? 'eating' : 'drinking'
            
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
        if (!entity.tags || !Array.isArray(entity.tags)) return false
        
        return targetTags.some(tag => entity.tags.includes(tag))
    }
    
    update(tick) {
        super.update(tick)
        
        // Update needs system
        this.needs.updateNeeds(tick)
        
        // Evaluate and update goals based on current needs
        this.goals.evaluateAndSetGoals()

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
}

export default Pawn
