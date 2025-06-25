export function createEntitySummary(entity) {
    if (!entity) return null
    const summary = {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        subtype: entity.subtype,
        position: { x: Math.round(entity.x), y: Math.round(entity.y) }
    }
    if (entity.world?.chunkManager) {
        const chunk = entity.currentChunk || entity.world.chunkManager.getChunkAtPosition(entity.x, entity.y)
        if (chunk) {
            summary.location = {
                chunk: { x: chunk.x, y: chunk.y },
                biome: chunk.biome,
                environment: {
                    temperature: chunk.temperature,
                    humidity: chunk.humidity,
                    fertility: chunk.fertility,
                    coverDensity: chunk.coverDensity
                },
                resourceDensities: {
                    food: chunk.foodDensity,
                    water: chunk.waterDensity,
                    shelter: chunk.shelterDensity
                }
            }
        }
    }
    if (entity.subtype === 'animal') {
        summary.species = entity.species
        summary.diet = entity.diet
        summary.predator = entity.predator
        summary.behaviorState = entity.behaviorState
        summary.drives = { ...entity.drives }
        if (entity.memory) {
            summary.memory = {
                knownFood: entity.memory.knownFood?.map(food => {
                    const chunk = entity.world?.chunkManager?.getChunkAtPosition(food.x, food.y)
                    return {
                        id: food.id,
                        position: { x: Math.round(food.x), y: Math.round(food.y) },
                        chunk: chunk ? { x: chunk.x, y: chunk.y, biome: chunk.biome } : null,
                        lastVisited: food.lastVisited,
                        ticksSinceLastVisit: entity.world?.clock?.currentTick 
                            ? entity.world.clock.currentTick - food.lastVisited 
                            : 'unknown'
                    }
                }) || [],
                knownWater: entity.memory.knownWater?.map(water => {
                    const chunk = entity.world?.chunkManager?.getChunkAtPosition(water.x, water.y)
                    return {
                        id: water.id,
                        position: { x: Math.round(water.x), y: Math.round(water.y) },
                        chunk: chunk ? { x: chunk.x, y: chunk.y, biome: chunk.biome } : null,
                        lastVisited: water.lastVisited,
                        ticksSinceLastVisit: entity.world?.clock?.currentTick 
                            ? entity.world.clock.currentTick - water.lastVisited 
                            : 'unknown'
                    }
                }) || [],
                knownShelter: entity.memory.knownShelter?.map(shelter => {
                    const chunk = entity.world?.chunkManager?.getChunkAtPosition(shelter.x, shelter.y)
                    return {
                        id: shelter.id,
                        position: { x: Math.round(shelter.x), y: Math.round(shelter.y) },
                        chunk: chunk ? { x: chunk.x, y: chunk.y, biome: chunk.biome } : null,
                        securityValue: shelter.securityValue,
                        lastVisited: shelter.lastVisited,
                        ticksSinceLastVisit: entity.world?.clock?.currentTick 
                            ? entity.world.clock.currentTick - shelter.lastVisited 
                            : 'unknown'
                    }
                }) || []
            }
            if (entity.memory.exploredChunks) {
                summary.memory.exploredChunks = Array.from(entity.memory.exploredChunks)
            }
            if (entity.memory.visitedBiomes) {
                summary.memory.visitedBiomes = Array.from(entity.memory.visitedBiomes)
            }
        }
    }
    if (entity.subtype === 'pawn') {
        summary.behaviorState = entity.behaviorState
        summary.inventory = [...(entity.inventory || [])]
        summary.skills = { ...(entity.skills || {}) }
        if (entity.needs) {
            summary.needs = {}
            for (const need in entity.needs.needs) {
                const value = entity.needs.needs[need]
                const thresholds = entity.needs.thresholds[need]
                let status = 'satisfied'
                if (value >= thresholds.critical) status = 'critical'
                else if (value >= thresholds.high) status = 'high'
                else if (value >= thresholds.medium) status = 'medium'
                else if (value >= thresholds.low) status = 'low'
                summary.needs[need] = {
                    value: Math.round(value),
                    status,
                    thresholds: thresholds
                }
            }
            const mostUrgent = entity.needs.getMostUrgentNeed()
            summary.mostUrgentNeed = {
                need: mostUrgent.need,
                value: Math.round(mostUrgent.value),
                urgency: mostUrgent.urgency
            }
        }
        if (entity.goals) {
            summary.currentGoal = entity.goals.currentGoal ? {
                type: entity.goals.currentGoal.type,
                description: entity.goals.currentGoal.description,
                priority: entity.goals.currentGoal.priority,
                targetType: entity.goals.currentGoal.targetType,
                targetTags: entity.goals.currentGoal.targetTags,
                action: entity.goals.currentGoal.action
            } : null
            summary.goalQueue = entity.goals.goalQueue.map(goal => ({
                type: goal.type,
                priority: goal.priority,
                description: goal.description
            }))
            summary.completedGoals = entity.goals.completedGoals.length
        }
        if (entity.currentTarget) {
            summary.currentTarget = {
                id: entity.currentTarget.id,
                name: entity.currentTarget.name,
                position: { 
                    x: Math.round(entity.currentTarget.x), 
                    y: Math.round(entity.currentTarget.y) 
                },
                distance: Math.round(Math.sqrt(
                    Math.pow(entity.x - entity.currentTarget.x, 2) + 
                    Math.pow(entity.y - entity.currentTarget.y, 2)
                ))
            }
        }
    }
    if (entity.type === 'resource') {
        summary.quantity = entity.quantity
        summary.maxQuantity = entity.maxQuantity
        summary.depleted = entity.depleted
        if (entity.subtype === 'food') {
            summary.nutritionalValue = entity.nutritionalValue || 'standard'
        } else if (entity.subtype === 'water') {
            summary.cleanness = entity.cleanness || 'standard'
        } else if (entity.subtype === 'cover') {
            summary.capacity = entity.capacity
            summary.currentOccupants = entity.currentOccupants
            summary.securityValue = entity.securityValue
        }
    }
    return summary
}
