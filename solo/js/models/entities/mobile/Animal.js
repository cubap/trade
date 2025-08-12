import MobileEntity from './MobileEntity.js'

class Animal extends MobileEntity {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'animal'
        this.tags.push('animal')  // Add animal-specific tag
        this.color = '#e74c3c'  // Default color for animals
        
        // Basic animal attributes
        this.species = 'generic'
        this.diet = 'omnivore'  // herbivore, carnivore, omnivore
        this.predator = false
        this.flockBehavior = false
        this.lifeStage = 'adult'  // baby, juvenile, adult, elder
        
        // Needs/drives system
        this.drives = {
            hunger: 0,     // 0-100, higher means more hungry
            thirst: 0,     // 0-100, higher means more thirsty
            rest: 0,       // 0-100, higher means more tired
            security: 0,   // 0-100, higher means feels threatened
            social: 0      // 0-100, higher means needs interaction
        }
        
        // Physical traits
        this.traits = {
            healthMax: 100,
            health: 100,
            enduranceMax: 100,
            endurance: 100,
            stealth: 15,        // How well it can hide
            detection: 50,      // How well it can detect others
            speed: this.speed,  // Base movement speed
            strength: 10        // For combat or interactions
        }
        
        // Tolerances define when drives become priority actions
        this.tolerances = {
            hunger: {
                thresholds: [0, 30, 60, 90, 100],
                priorities: [0, 15, 50, 80, 100]
            },
            thirst: {
                thresholds: [0, 30, 50, 80, 100],
                priorities: [0, 15, 50, 80, 100]
            },
            rest: {
                thresholds: [0, 75, 85, 95, 100],
                priorities: [0, 20, 40, 60, 100]
            },
            security: {
                thresholds: [0, 30, 60, 100],
                priorities: [0, 50, 85, 100]
            }
        }
        
        // Action queue with priorities
        this.actionQueue = []
        
        // Memory and knowledge
        this.memory = {
            knownFood: [],
            knownWater: [],
            knownShelter: [],
            knownDanger: [],
            lastShelter: null
        }
        
        // Current behavior state
        this.behaviorState = 'idle'  // idle, foraging, fleeing, etc.
        
        // Home/nest system
        this.home = null // { x, y, type: 'nest' | 'den' | ... }
        this.hasNest = false
        // Reproduction
        this.isPregnant = false
        this.pregnancyTimer = 0
        this.offspringToProduce = 0
        // Carcass and specialty drops
        this.hiddenInventory = [] // Items dropped on death
        this.specialtyDrops = [] // e.g. feathers, tusks
    }

    // Tag helper to support Array or Set-backed tags
    hasTag(entity, tag) {
        const t = entity?.tags
        if (!t) return false
        if (Array.isArray(t)) return t.includes(tag)
        if (typeof t.has === 'function') return t.has(tag)
        return false
    }
    
    // Override update to properly handle cover and movement
    update(tick) {
        // If our behavior is changing from resting, leave any cover
        if (this.behaviorState === 'resting') {
            const oldBehavior = this.behaviorState
            
            // Call parent update which will also call move()
            const result = super.update(tick)
            
            // If behavior changed from resting, leave cover
            if (oldBehavior === 'resting' && this.behaviorState !== 'resting') {
                this.leaveCover()
            }
            
            return result
        }
        
        // Standard update otherwise, which will also handle movement
        return super.update(tick)
    }
    
    updateDrives(tick) {
        // Increase drives over time
        const ticksSinceLastUpdate = tick - this.lastDriveUpdate || 1
        const rate = 0.01 * ticksSinceLastUpdate
        
        this.drives.hunger += rate * (this.species === 'rabbit' ? 0.8 : 1.2)
        this.drives.thirst += rate * (this.lifeStage === 'juvenile' ? 1.5 : 1.0)
        this.drives.rest += rate * 0.5
        
        // Cap values
        this.drives.hunger = Math.min(100, this.drives.hunger)
        this.drives.thirst = Math.min(100, this.drives.thirst)
        this.drives.rest = Math.min(100, this.drives.rest)
        
        this.lastDriveUpdate = tick
    }
    
    evaluatePriorities() {
        this.actionQueue = []
        
        // Check each drive against its tolerance thresholds
        for (const drive in this.drives) {
            if (!this.tolerances[drive]) continue
            
            const value = this.drives[drive]
            const thresholds = this.tolerances[drive].thresholds
            const priorities = this.tolerances[drive].priorities
            
            // Find the appropriate threshold index
            let thresholdIndex = 0
            for (let i = 0; i < thresholds.length; i++) {
                if (value <= thresholds[i]) {
                    thresholdIndex = i
                    break
                }
                
                // If we reach the end, use the last index
                if (i === thresholds.length - 1) {
                    thresholdIndex = i
                }
            }
            
            // Get priority for this drive
            const priority = priorities[thresholdIndex]
            
            // If priority is significant, add to action queue
            if (priority > 0) {
                this.actionQueue.push({
                    drive,
                    priority,
                    value
                })
            }
        }
        
        // Add exploration as a potential activity with a base priority
        const knowledge = this.assessKnowledge()
        
        // If rest is low and knowledge is incomplete, add exploration to queue
        if (this.drives.rest < 50 && knowledge.needsExploration) {
            const explorationPriority = 10 + (1 - knowledge.knowledgeScore) * 20
            
            this.actionQueue.push({
                drive: 'exploration',
                priority: explorationPriority,
                value: 1 - knowledge.knowledgeScore
            })
        }
        
        // Sort action queue by priority (highest first)
        this.actionQueue.sort((a, b) => b.priority - a.priority)
        
        // Set behavior based on highest priority
        if (this.actionQueue.length > 0) {
            const highestPriority = this.actionQueue[0]
            
            switch (highestPriority.drive) {
                case 'hunger':
                    this.behaviorState = 'foraging'
                    break
                case 'thirst':
                    this.behaviorState = 'seeking_water'
                    break
                case 'rest':
                    this.behaviorState = 'resting'
                    break
                case 'security':
                    this.behaviorState = 'fleeing'
                    break
                case 'exploration':
                    this.behaviorState = 'exploring'
                    break
                default:
                    this.behaviorState = 'idle'
            }
        } else {
            this.behaviorState = 'idle'
        }
    }
    
    executeBehavior() {
        // Different behaviors lead to different movement patterns
        switch (this.behaviorState) {
            case 'foraging':
                this.forage()
                break
            case 'seeking_water':
                this.seekWater()
                break
            case 'resting':
                this.rest()
                break
            case 'fleeing':
                this.flee()
                break
            case 'exploring':
                this.explore()
                break
            case 'idle':
            default:
                this.wander()
        }
    }
    
    // Different movement behaviors
    forage() {
        // Methodical, short-range movement looking for food
        const originalRange = this.moveRange
        this.moveRange = originalRange * 0.6  // Shorter movements for careful searching
        
        // Look for nearby food
    const nearbyFood = this.world?.getNearbyEntities?.(this.x, this.y, this.traits.detection) || []
    const food = nearbyFood.filter(e => this.hasTag(e, 'food') && !e.depleted)
        
        if (food.length > 0) {
            // Sort by distance
            food.sort((a, b) => this.distanceTo(a) - this.distanceTo(b))
            
            // Move toward nearest food
            const nearest = food[0]
            this.nextTargetX = nearest.x
            this.nextTargetY = nearest.y
            
            // If close enough, consume food
            const distance = this.distanceTo(nearest)
            if (distance < this.size + nearest.size) {
                // Consume food and reduce hunger
                const consumed = nearest.consume(20)
                this.drives.hunger = Math.max(0, this.drives.hunger - consumed * 0.5)
                
                // Add to memory if not already known
                if (!this.memory.knownFood.some(f => f.id === nearest.id)) {
                    this.memory.knownFood.push({
                        id: nearest.id,
                        x: nearest.x,
                        y: nearest.y,
                        lastVisited: this.world.clock.currentTick
                    })
                    
                    // Limit memory size
                    if (this.memory.knownFood.length > 5) {
                        this.memory.knownFood.shift()
                    }
                } else {
                    // Update last visited time for existing memory
                    const memoryEntry = this.memory.knownFood.find(f => f.id === nearest.id)
                    if (memoryEntry) {
                        memoryEntry.lastVisited = this.world.clock.currentTick
                    }
                }
            }
        } else if (this.memory.knownFood.length > 0) {
            // No visible food, but we remember some - go to most recently visited
            this.memory.knownFood.sort((a, b) => b.lastVisited - a.lastVisited)
            
            // Head toward remembered food
            this.nextTargetX = this.memory.knownFood[0].x
            this.nextTargetY = this.memory.knownFood[0].y
        } else {
            // No food found or remembered, explore more widely
            this.exploreForResources()
        }
        
        // Restore original move range
        this.moveRange = originalRange
    }
    
    seekWater() {
        // Similar to foraging but looking for water
    const nearbyWater = this.world?.getNearbyEntities?.(this.x, this.y, this.traits.detection) || []
    const water = nearbyWater.filter(e => this.hasTag(e, 'water') && !e.depleted)
        
        if (water.length > 0) {
            // Sort by distance
            water.sort((a, b) => this.distanceTo(a) - this.distanceTo(b))
            
            // Move toward nearest water
            const nearest = water[0]
            this.nextTargetX = nearest.x
            this.nextTargetY = nearest.y
            
            // If close enough, drink
            const distance = this.distanceTo(nearest)
            if (distance < this.size + nearest.size) {
                // Consume water and reduce thirst
                const consumed = nearest.consume(30)
                this.drives.thirst = Math.max(0, this.drives.thirst - consumed * 0.3)
                
                // Add to memory if not already known
                if (!this.memory.knownWater.some(w => w.id === nearest.id)) {
                    this.memory.knownWater.push({
                        id: nearest.id,
                        x: nearest.x,
                        y: nearest.y,
                        lastVisited: this.world.clock.currentTick
                    })
                    
                    // Limit memory size
                    if (this.memory.knownWater.length > 3) {
                        this.memory.knownWater.shift()
                    }
                } else {
                    // Update last visited time for existing memory
                    const memoryEntry = this.memory.knownWater.find(w => w.id === nearest.id)
                    if (memoryEntry) {
                        memoryEntry.lastVisited = this.world.clock.currentTick
                    }
                }
            }
        } else if (this.memory.knownWater.length > 0) {
            // No visible water, but we remember some - go to most recently visited
            this.memory.knownWater.sort((a, b) => b.lastVisited - a.lastVisited)
            
            // Head toward remembered water
            this.nextTargetX = this.memory.knownWater[0].x
            this.nextTargetY = this.memory.knownWater[0].y
        } else {
            // No water found or remembered, explore more widely
            this.exploreForResources()
        }
    }
    
    rest() {
        // Try to find shelter to rest in
    const nearbyCovers = this.world?.getNearbyEntities?.(this.x, this.y, this.traits.detection) || []
    const covers = nearbyCovers.filter(e => this.hasTag(e, 'cover') && e.hasSpace?.())
        
        if (covers.length > 0) {
            // Sort by distance and security value
            covers.sort((a, b) => {
                // Weighted combination of distance and security
                const distA = this.distanceTo(a)
                const distB = this.distanceTo(b)
                const securityA = a.securityValue || 50
                const securityB = b.securityValue || 50
                
                // Lower is better (closer and more secure)
                return (distA * 0.7 - securityA * 0.3) - (distB * 0.7 - securityB * 0.3)
            })
            
            // Move toward best cover
            const bestCover = covers[0]
            this.nextTargetX = bestCover.x
            this.nextTargetY = bestCover.y
            
            // If close enough, rest
            const distance = this.distanceTo(bestCover)
            if (distance < this.size + bestCover.size) {
                // Enter cover and rest
                if (bestCover.enter?.()) {
                    // Successfully entered cover
                    this.drives.rest = Math.max(0, this.drives.rest - 8)
                    this.drives.security = Math.max(0, this.drives.security - 12)
                    
                    // Stay still
                    this.nextTargetX = this.x
                    this.nextTargetY = this.y
                    
                    // Remember this shelter
                    if (!this.memory.knownShelter.some(s => s.id === bestCover.id)) {
                        this.memory.knownShelter.push({
                            id: bestCover.id,
                            x: bestCover.x,
                            y: bestCover.y,
                            securityValue: bestCover.securityValue,
                            lastVisited: this.world.clock.currentTick
                        })
                        
                        // Limit memory size
                        if (this.memory.knownShelter.length > 3) {
                            this.memory.knownShelter.shift()
                        }
                    } else {
                        // Update last visited time
                        const memoryEntry = this.memory.knownShelter.find(s => s.id === bestCover.id)
                        if (memoryEntry) {
                            memoryEntry.lastVisited = this.world.clock.currentTick
                        }
                    }
                    
                    // When leaving, update cover
                    this.lastCoverUsed = bestCover.id
                }
            }
        } else if (this.memory.knownShelter.length > 0) {
            // No visible shelter, but we remember some - go to most secure remembered one
            this.memory.knownShelter.sort((a, b) => 
                (b.securityValue || 50) - (a.securityValue || 50))
            
            // Head toward remembered shelter
            this.nextTargetX = this.memory.knownShelter[0].x
            this.nextTargetY = this.memory.knownShelter[0].y
        } else {
            // No cover found or remembered, rest in place with minimal movement
            const originalRange = this.moveRange
            this.moveRange = originalRange * 0.1
            
            if (Math.random() < 0.2) {
                // Small chance to make minor movements
                this.moveRandomly()
            } else {
                // Stay still
                this.nextTargetX = this.x
                this.nextTargetY = this.y
                this.drives.rest = Math.max(0, this.drives.rest - 2)
            }
            
            this.moveRange = originalRange
        }
    }
    
    flee() {
        // Rapid movement away from threats
    const nearbyThreats = this.world?.getNearbyEntities?.(this.x, this.y, this.traits.detection) || []
    const threats = nearbyThreats.filter(e => e.predator || this.hasTag(e, 'threat'))
        
        if (threats.length > 0) {
            // Calculate average threat position
            let threatX = 0
            let threatY = 0
            
            for (const threat of threats) {
                threatX += threat.x
                threatY += threat.y
            }
            
            threatX /= threats.length
            threatY /= threats.length
            
            // Move in opposite direction
            const dx = this.x - threatX
            const dy = this.y - threatY
            const length = Math.sqrt(dx*dx + dy*dy)
            
            const speed = 1.5  // Flee faster than normal movement
            
            this.nextTargetX = this.x + (dx / length) * this.moveRange * speed
            this.nextTargetY = this.y + (dy / length) * this.moveRange * speed
            
            // Fleeing uses more endurance
            this.traits.endurance = Math.max(0, this.traits.endurance - 5)
        } else {
            // No immediate threats, seek shelter
            const nearbyCovers = this.world?.getNearbyEntities?.(this.x, this.y, this.traits.detection) || []
            const covers = nearbyCovers.filter(e => this.hasTag(e, 'cover'))
            
            if (covers.length > 0) {
                const nearest = covers[0]
                this.nextTargetX = nearest.x
                this.nextTargetY = nearest.y
            } else {
                this.moveRandomly()
            }
            
            // Security decreases over time when no threats are visible
            this.drives.security = Math.max(0, this.drives.security - 5)
        }
    }
    
    wander() {
        // Default behavior when no pressing needs
        // More purposeful than pure random
        if (!this.wanderDirection || Math.random() < 0.1) {
            // Occasionally change direction
            this.wanderDirection = Math.random() * Math.PI * 2
        }
        
        this.nextTargetX = this.x + Math.cos(this.wanderDirection) * this.moveRange
        this.nextTargetY = this.y + Math.sin(this.wanderDirection) * this.moveRange
        
        // Small chance of random movement instead
        if (Math.random() < 0.2) {
            this.moveRandomly()
        }
    }
    
    // Different movement behaviors
    moveRandomly() {
        const angle = Math.random() * Math.PI * 2
        const distance = this.moveRange * (0.5 + Math.random() * 0.5)
        
        this.nextTargetX = Math.round(this.x + Math.cos(angle) * distance)
        this.nextTargetY = Math.round(this.y + Math.sin(angle) * distance)
    }

    moveLinearly() {
        // Initialize direction if needed
        if (!this.directionX) {
            this.directionX = Math.random() * 2 - 1
            this.directionY = Math.random() * 2 - 1
            
            // Normalize
            const length = Math.sqrt(this.directionX*this.directionX + this.directionY*this.directionY)
            this.directionX /= length
            this.directionY /= length
        }
        
        // Check for world boundaries and bounce
        if (this.world) {
            if ((this.x <= 0 && this.directionX < 0) || 
                (this.x >= this.world.width && this.directionX > 0)) {
                this.directionX *= -1
            }
            
            if ((this.y <= 0 && this.directionY < 0) || 
                (this.y >= this.world.height && this.directionY > 0)) {
                this.directionY *= -1
            }
        }
        
        const distance = this.moveRange
        
        this.nextTargetX = Math.round(this.x + this.directionX * distance)
        this.nextTargetY = Math.round(this.y + this.directionY * distance)
    }

    moveInCircles() {
        // Initialize orbit if needed
        if (!this.orbitCenterX) {
            this.orbitCenterX = this.x
            this.orbitCenterY = this.y
            this.orbitRadius = 50 + Math.random() * 100
            this.orbitAngle = Math.random() * Math.PI * 2
            this.orbitSpeed = 0.1 + Math.random() * 0.2
        }
        
        // Update orbit angle
        this.orbitAngle += this.orbitSpeed
        
        this.nextTargetX = Math.round(this.orbitCenterX + Math.cos(this.orbitAngle) * this.orbitRadius)
        this.nextTargetY = Math.round(this.orbitCenterY + Math.sin(this.orbitAngle) * this.orbitRadius)
    }
    
    // Override default decideNextMove to use our behavior system
    decideNextMove() {
        // Only use basic movement if behavioral system hasn't set nextTarget
        if (this.nextTargetX === undefined || this.nextTargetY === undefined) {
            // Use a simple random movement as fallback
            this.moveRandomly()
        }
    }

    // Add a new exploration method for when animals need resources but don't know where they are
    exploreForResources() {
        // Enhanced chunk-aware exploration
        if (this.world?.chunkManager) {
            this.exploreByChunks()
        } else {
            // Fallback to original exploration method
            this.exploreRandomly()
        }
    }
    
    exploreByChunks() {
        const currentChunk = this.currentChunk || this.world.chunkManager.getChunkAtPosition(this.x, this.y)
        
        if (!currentChunk) {
            this.exploreRandomly()
            return
        }
        
        // Track explored chunks in memory
        if (!this.memory.exploredChunks) {
            this.memory.exploredChunks = new Set()
        }
        
        // Add current chunk to explored
        this.memory.exploredChunks.add(`${currentChunk.x},${currentChunk.y}`)
        
        // Get nearby chunks
        const nearbyChunks = currentChunk.getNearbyChunks(this.world.chunkManager, 2)
        
        // Find unexplored chunks or chunks with better resources
        const targetChunk = this.selectBestChunkToExplore(nearbyChunks)
        
        if (targetChunk && targetChunk !== currentChunk) {
            // Move toward the center of the target chunk
            const chunkCenterX = targetChunk.worldX + targetChunk.size / 2
            const chunkCenterY = targetChunk.worldY + targetChunk.size / 2
            
            // Add some randomness to avoid always going to exact center
            const offsetX = (Math.random() - 0.5) * targetChunk.size * 0.3
            const offsetY = (Math.random() - 0.5) * targetChunk.size * 0.3
            
            this.nextTargetX = chunkCenterX + offsetX
            this.nextTargetY = chunkCenterY + offsetY
        } else {
            // Explore within current chunk
            this.exploreWithinChunk(currentChunk)
        }
    }
    
    selectBestChunkToExplore(chunks) {
        if (!chunks || chunks.length === 0) return null
        
        let bestChunk = null
        let bestScore = -1
        
        for (const chunk of chunks) {
            const chunkKey = `${chunk.x},${chunk.y}`
            let score = 0
            
            // Prefer unexplored chunks
            if (!this.memory.exploredChunks.has(chunkKey)) {
                score += 50
            }
            
            // Score based on resource density for current needs
            if (this.drives.hunger > 60) {
                score += chunk.foodDensity * 20
            }
            if (this.drives.thirst > 60) {
                score += chunk.waterDensity * 20
            }
            if (this.drives.rest > 80) {
                score += chunk.shelterDensity * 15
            }
            
            // Biome variety bonus - explore different biomes
            if (!this.memory.visitedBiomes) {
                this.memory.visitedBiomes = new Set()
            }
            
            if (!this.memory.visitedBiomes.has(chunk.biome)) {
                score += 30
                this.memory.visitedBiomes.add(chunk.biome)
            }
            
            // Distance penalty (prefer closer chunks)
            const distance = Math.sqrt(
                Math.pow(chunk.worldX + chunk.size/2 - this.x, 2) + 
                Math.pow(chunk.worldY + chunk.size/2 - this.y, 2)
            )
            score -= distance * 0.01
            
            if (score > bestScore) {
                bestScore = score
                bestChunk = chunk
            }
        }
        
        return bestChunk
    }
    
    exploreWithinChunk(chunk) {
        // Explore systematically within the current chunk
        if (!this.memory.chunkExplorationTarget) {
            // Pick a random point within the chunk
            this.memory.chunkExplorationTarget = {
                x: chunk.worldX + Math.random() * chunk.size,
                y: chunk.worldY + Math.random() * chunk.size
            }
        }
        
        const target = this.memory.chunkExplorationTarget
        const distance = Math.sqrt(
            Math.pow(target.x - this.x, 2) + 
            Math.pow(target.y - this.y, 2)
        )
        
        // If we're close to the target, pick a new one
        if (distance < 20) {
            this.memory.chunkExplorationTarget = {
                x: chunk.worldX + Math.random() * chunk.size,
                y: chunk.worldY + Math.random() * chunk.size
            }
        } else {
            this.nextTargetX = target.x
            this.nextTargetY = target.y
        }
    }
    
    exploreRandomly() {
        // Original exploration method as fallback
        if (!this.explorationDirection || Math.random() < 0.1) {
            this.explorationDirection = Math.random() * Math.PI * 2
            this.explorationSteps = 0
        }
        
        // Increase range for exploration
        const exploreRange = this.moveRange * 1.2
        
        // Move in the exploration direction
        this.nextTargetX = this.x + Math.cos(this.explorationDirection) * exploreRange
        this.nextTargetY = this.y + Math.sin(this.explorationDirection) * exploreRange
        
        // Count steps in this direction
        this.explorationSteps = (this.explorationSteps || 0) + 1
        
        // If we've gone too far in one direction, change next time
        if (this.explorationSteps > 5) {
            this.explorationDirection = null
        }
    }

    // Add cleanup for when animals leave cover
    leaveCover() {
        if (this.lastCoverUsed && this.world) {
            const cover = Array.from(this.world.entitiesMap.values())
                .find(e => e.id === this.lastCoverUsed)
            
            if (cover && cover.leave) {
                cover.leave()
                this.lastCoverUsed = null
            }
        }
    }

    // Add this method to the Animal class to assess knowledge completeness
    assessKnowledge() {
        // Check if animal has sufficient knowledge of different resource types
        const knownFoodCount = this.memory.knownFood.length
        const knownWaterCount = this.memory.knownWater.length
        const knownShelterCount = this.memory.knownShelter.length
        
        // Calculate a knowledge score (0-1)
        const foodScore = Math.min(1, knownFoodCount / 3)
        const waterScore = Math.min(1, knownWaterCount / 2)
        const shelterScore = Math.min(1, knownShelterCount / 2)
        
        // Combined knowledge score
        const knowledgeScore = (foodScore + waterScore + shelterScore) / 3
        
        return {
            complete: knowledgeScore >= 0.7,
            knowledgeScore,
            foodScore,
            waterScore,
            shelterScore,
            needsExploration: knowledgeScore < 0.7
        }
    }

    // New dedicated exploration method
    explore() {
        // Methodical exploration to find new resources
        
        // First, assess what resources we need most knowledge about
        const knowledge = this.assessKnowledge()
        
        // Check for any resources in detection range
        const nearbyEntities = this.world?.getNearbyEntities?.(this.x, this.y, this.traits.detection) || []
        
        // Filter for resources that are unknown to the animal
        const resourceEntities = nearbyEntities.filter(e => 
            (this.hasTag(e, 'food') || this.hasTag(e, 'water') || this.hasTag(e, 'cover')) && 
            !this.isKnownResource(e)
        )
        
        if (resourceEntities.length > 0) {
            // Found unknown resources, move toward one of them
            // Prioritize the resource type we know least about
            let targetResource
            
            if (knowledge.foodScore <= knowledge.waterScore && 
                knowledge.foodScore <= knowledge.shelterScore) {
                // Need food knowledge most
                targetResource = resourceEntities.find(e => this.hasTag(e, 'food'))
            } else if (knowledge.waterScore <= knowledge.shelterScore) {
                // Need water knowledge most
                targetResource = resourceEntities.find(e => this.hasTag(e, 'water'))
            } else {
                // Need shelter knowledge most
                targetResource = resourceEntities.find(e => this.hasTag(e, 'cover'))
            }
            
            // If didn't find priority resource, just go to the closest
            if (!targetResource) {
                resourceEntities.sort((a, b) => this.distanceTo(a) - this.distanceTo(b))
                targetResource = resourceEntities[0]
            }
            
            // Move toward the resource
            this.nextTargetX = targetResource.x
            this.nextTargetY = targetResource.y
            
            // Record if we're close enough
            const distance = this.distanceTo(targetResource)
            if (distance < this.size + targetResource.size + 10) {
                this.recordResourceInMemory(targetResource)
            }
        } else {
            // No unknown resources nearby, explore in a systematic pattern
            this.systematicExploration()
        }
        
        // Exploration increases hunger and thirst slightly
        this.drives.hunger = Math.min(100, this.drives.hunger + 0.1)
        this.drives.thirst = Math.min(100, this.drives.thirst + 0.05)
    }

    // Check if resource is already known
    isKnownResource(resource) {
    if (this.hasTag(resource, 'food')) {
            return this.memory.knownFood.some(f => f.id === resource.id)
        }
        
    if (this.hasTag(resource, 'water')) {
            return this.memory.knownWater.some(w => w.id === resource.id)
        }
        
    if (this.hasTag(resource, 'cover')) {
            return this.memory.knownShelter.some(s => s.id === resource.id)
        }
        
        return false
    }

    // Record resource in memory
    recordResourceInMemory(resource) {
    if (this.hasTag(resource, 'food') && !this.memory.knownFood.some(f => f.id === resource.id)) {
            this.memory.knownFood.push({
                id: resource.id,
                x: resource.x,
                y: resource.y,
                lastVisited: this.world.clock.currentTick
            })
            
            // Limit memory size
            if (this.memory.knownFood.length > 5) {
                this.memory.knownFood.shift()
            }
        }
        
    if (this.hasTag(resource, 'water') && !this.memory.knownWater.some(w => w.id === resource.id)) {
            this.memory.knownWater.push({
                id: resource.id,
                x: resource.x,
                y: resource.y,
                lastVisited: this.world.clock.currentTick
            })
            
            // Limit memory size
            if (this.memory.knownWater.length > 3) {
                this.memory.knownWater.shift()
            }
        }
        
    if (this.hasTag(resource, 'cover') && !this.memory.knownShelter.some(s => s.id === resource.id)) {
            this.memory.knownShelter.push({
                id: resource.id,
                x: resource.x,
                y: resource.y,
                securityValue: resource.securityValue,
                lastVisited: this.world.clock.currentTick
            })
            
            // Limit memory size
            if (this.memory.knownShelter.length > 3) {
                this.memory.knownShelter.shift()
            }
        }
    }

    // More strategic exploration pattern
    systematicExploration() {
        // Use a more methodical approach than random wandering
        
        // If we don't have an exploration state yet, create one
        if (!this.explorationState) {
            this.explorationState = {
                // Split the world into quadrants and explore each
                currentQuadrant: Math.floor(Math.random() * 4),
                quadrantProgress: 0,
                spiral: false,
                spiralRadius: 50,
                spiralAngle: 0,
                gridX: 0,
                gridY: 0
            }
        }
        
        // Every so often, or if we've fully explored current pattern, switch patterns
        if (!this.explorationPatternTimer || this.world.clock.currentTick - this.explorationPatternTimer > 20) {
            this.explorationPatternTimer = this.world.clock.currentTick
            this.explorationState.spiral = !this.explorationState.spiral
            
            // Sometimes change quadrant
            if (Math.random() < 0.3) {
                this.explorationState.currentQuadrant = (this.explorationState.currentQuadrant + 1) % 4
            }
        }
        
        if (this.explorationState.spiral) {
            // Spiral outward pattern
            this.explorationState.spiralAngle += 0.2
            this.explorationState.spiralRadius += 0.5
            
            // Get quadrant center
            const quadrantCenterX = this.getQuadrantCenterX()
            const quadrantCenterY = this.getQuadrantCenterY()
            
            // Calculate position on spiral
            this.nextTargetX = quadrantCenterX + 
                Math.cos(this.explorationState.spiralAngle) * this.explorationState.spiralRadius
            this.nextTargetY = quadrantCenterY + 
                Math.sin(this.explorationState.spiralAngle) * this.explorationState.spiralRadius
            
            // Reset spiral if radius gets too large
            if (this.explorationState.spiralRadius > Math.min(this.world.width, this.world.height) / 6) {
                this.explorationState.spiralRadius = 50
                this.explorationState.spiralAngle = 0
            }
        } else {
            // Grid-based search pattern
            // Move in a zig-zag grid pattern within the quadrant
            const gridSize = 100
            this.explorationState.gridX += 1
            
            // When reaching end of row, move to next row
            if (this.explorationState.gridX > 4) {
                this.explorationState.gridX = 0
                this.explorationState.gridY += 1
                
                // When grid is complete, reset
                if (this.explorationState.gridY > 4) {
                    this.explorationState.gridY = 0
                    this.explorationState.currentQuadrant = (this.explorationState.currentQuadrant + 1) % 4
                }
            }
            
            // Calculate target based on grid position and quadrant
            const quadrantWidth = this.world.width / 2
            const quadrantHeight = this.world.height / 2
            const quadrantX = this.explorationState.currentQuadrant % 2 === 0 ? 0 : 1
            const quadrantY = this.explorationState.currentQuadrant < 2 ? 0 : 1
            
            this.nextTargetX = quadrantX * quadrantWidth + this.explorationState.gridX * gridSize
            this.nextTargetY = quadrantY * quadrantHeight + this.explorationState.gridY * gridSize
        }
    }

    // Helper methods for quadrant-based exploration
    getQuadrantCenterX() {
        const quadrantWidth = this.world.width / 2
        const quadrantX = this.explorationState.currentQuadrant % 2 === 0 ? 0 : 1
        return quadrantX * quadrantWidth + quadrantWidth / 2
    }

    getQuadrantCenterY() {
        const quadrantHeight = this.world.height / 2
        const quadrantY = this.explorationState.currentQuadrant < 2 ? 0 : 1
        return quadrantY * quadrantHeight + quadrantHeight / 2
    }

    // Override update to include pregnancy and ensure leaving cover when behavior changes
    update(tick) {
        // Pregnancy/egg laying proceeds regardless of behavior
        if (this.isPregnant) {
            this.pregnancyTimer--
            if (this.pregnancyTimer <= 0) {
                this.layEggs()
            }
        }

        const wasResting = this.behaviorState === 'resting'
        const result = super.update(tick)

        // If we were resting and behavior changed, leave cover
        if (wasResting && this.behaviorState !== 'resting') {
            this.leaveCover()
        }

        return result
    }
    
    // Reproduction methods
    reproduce(partner) {
        // Simple reproduction logic
        if (!this.home) this.establishHome()
        this.isPregnant = true
        this.pregnancyTimer = 100 + Math.floor(Math.random() * 100)
        this.offspringToProduce = 1 + Math.floor(Math.random() * 3)
    }

    layEggs() {
        if (!this.home) this.establishHome('nest')
        // Add eggs to world at home location (pseudo)
        if (this.world?.addEntity) {
            for (let i = 0; i < this.offspringToProduce; i++) {
                this.world.addEntity({ type: 'egg', x: this.home.x, y: this.home.y, parent: this.id })
            }
        }
        this.isPregnant = false
        this.offspringToProduce = 0
    }

    // Home/nest methods
    establishHome(type = 'nest') {
        this.home = { x: this.x, y: this.y, type }
        this.hasNest = true
    }

    returnHome() {
        if (this.home) {
            this.nextTargetX = this.home.x
            this.nextTargetY = this.home.y
        }
    }

    die() {
        // Drop carcass and specialty items
        if (this.world?.addEntity) {
            this.world.addEntity({ type: 'carcass', x: this.x, y: this.y, source: this.id })
            for (const item of this.specialtyDrops) {
                this.world.addEntity({ ...item, x: this.x, y: this.y })
            }
        }
        // Drop hidden inventory
        for (const item of this.hiddenInventory) {
            this.world?.addEntity?.({ ...item, x: this.x, y: this.y })
        }
        // Remove from world (pseudo)
        this.isDead = true
    }
}

export default Animal
