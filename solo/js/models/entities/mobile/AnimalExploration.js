class AnimalExploration {
    constructor(animal) {
        this.animal = animal
    }
    
    exploreForResources() {
        // Enhanced chunk-aware exploration
        if (this.animal.world?.chunkManager) {
            this.exploreByChunks()
        } else {
            // Fallback to original exploration method
            this.exploreRandomly()
        }
    }
    
    exploreByChunks() {
        const currentChunk = this.animal.currentChunk || this.animal.world.chunkManager.getChunkAtPosition(this.animal.x, this.animal.y)
        
        if (!currentChunk) {
            this.exploreRandomly()
            return
        }
        
        // Track explored chunks in memory
        if (!this.animal.memory.exploredChunks) {
            this.animal.memory.exploredChunks = new Set()
        }
        
        // Add current chunk to explored
        this.animal.memory.exploredChunks.add(`${currentChunk.x},${currentChunk.y}`)
        
        // Get nearby chunks
        const nearbyChunks = currentChunk.getNearbyChunks(this.animal.world.chunkManager, 2)
        
        // Find unexplored chunks or chunks with better resources
        const targetChunk = this.selectBestChunkToExplore(nearbyChunks)
        
        if (targetChunk && targetChunk !== currentChunk) {
            // Move toward the center of the target chunk
            const chunkCenterX = targetChunk.worldX + targetChunk.size / 2
            const chunkCenterY = targetChunk.worldY + targetChunk.size / 2
            
            // Add some randomness to avoid always going to exact center
            const offsetX = (Math.random() - 0.5) * targetChunk.size * 0.3
            const offsetY = (Math.random() - 0.5) * targetChunk.size * 0.3
            
            this.animal.nextTargetX = chunkCenterX + offsetX
            this.animal.nextTargetY = chunkCenterY + offsetY
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
            if (!this.animal.memory.exploredChunks.has(chunkKey)) {
                score += 50
            }
            
            // Score based on resource density for current needs
            if (this.animal.drives.hunger > 60) {
                score += chunk.foodDensity * 20
            }
            if (this.animal.drives.thirst > 60) {
                score += chunk.waterDensity * 20
            }
            if (this.animal.drives.rest > 80) {
                score += chunk.shelterDensity * 15
            }
            
            // Biome variety bonus - explore different biomes
            if (!this.animal.memory.visitedBiomes) {
                this.animal.memory.visitedBiomes = new Set()
            }
            
            if (!this.animal.memory.visitedBiomes.has(chunk.biome)) {
                score += 30
                this.animal.memory.visitedBiomes.add(chunk.biome)
            }
            
            // Distance penalty (prefer closer chunks)
            const distance = Math.sqrt(
                Math.pow(chunk.worldX + chunk.size/2 - this.animal.x, 2) + 
                Math.pow(chunk.worldY + chunk.size/2 - this.animal.y, 2)
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
        if (!this.animal.memory.chunkExplorationTarget) {
            // Pick a random point within the chunk
            this.animal.memory.chunkExplorationTarget = {
                x: chunk.worldX + Math.random() * chunk.size,
                y: chunk.worldY + Math.random() * chunk.size
            }
        }
        
        const target = this.animal.memory.chunkExplorationTarget
        const distance = Math.sqrt(
            Math.pow(target.x - this.animal.x, 2) + 
            Math.pow(target.y - this.animal.y, 2)
        )
        
        // If we're close to the target, pick a new one
        if (distance < 20) {
            this.animal.memory.chunkExplorationTarget = {
                x: chunk.worldX + Math.random() * chunk.size,
                y: chunk.worldY + Math.random() * chunk.size
            }
        } else {
            this.animal.nextTargetX = target.x
            this.animal.nextTargetY = target.y
        }
    }
    
    exploreRandomly() {
        // Original exploration method as fallback
        if (!this.animal.explorationDirection || Math.random() < 0.1) {
            this.animal.explorationDirection = Math.random() * Math.PI * 2
            this.animal.explorationSteps = 0
        }
        
        // Increase range for exploration
        const exploreRange = this.animal.moveRange * 1.2
        
        // Move in the exploration direction
        this.animal.nextTargetX = this.animal.x + Math.cos(this.animal.explorationDirection) * exploreRange
        this.animal.nextTargetY = this.animal.y + Math.sin(this.animal.explorationDirection) * exploreRange
        
        // Count steps in this direction
        this.animal.explorationSteps = (this.animal.explorationSteps || 0) + 1
        
        // If we've gone too far in one direction, change next time
        if (this.animal.explorationSteps > 5) {
            this.animal.explorationDirection = null
        }
    }
    
    systematicExploration() {
        // Systematic exploration pattern within current area
        if (!this.animal.explorationGrid) {
            this.animal.explorationGrid = {
                centerX: this.animal.x,
                centerY: this.animal.y,
                radius: 150,
                currentAngle: 0,
                visited: new Set()
            }
        }
        
        const grid = this.animal.explorationGrid
        
        // Spiral outward pattern
        const angle = grid.currentAngle
        const radius = Math.min(grid.radius, 20 + (grid.currentAngle / (Math.PI * 2)) * 20)
        
        const targetX = grid.centerX + Math.cos(angle) * radius
        const targetY = grid.centerY + Math.sin(angle) * radius
        
        this.animal.nextTargetX = targetX
        this.animal.nextTargetY = targetY
        
        // Advance angle for next exploration
        grid.currentAngle += Math.PI / 8  // 22.5 degree increments
        
        // Reset if we've completed a full circle
        if (grid.currentAngle >= Math.PI * 2) {
            grid.currentAngle = 0
            grid.radius += 30  // Expand search radius
        }
    }
}

export default AnimalExploration
