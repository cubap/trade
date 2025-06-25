import Chunk from './Chunk.js'

class ChunkManager {
    constructor(worldWidth, worldHeight, chunkSize = 200) {
        this.worldWidth = worldWidth
        this.worldHeight = worldHeight
        this.chunkSize = chunkSize
        this.chunksX = Math.ceil(worldWidth / chunkSize)
        this.chunksY = Math.ceil(worldHeight / chunkSize)
        
        // 2D array of chunks
        this.chunks = []
        this.initializeChunks()
        this.generateBiomes()
    }
    
    initializeChunks() {
        for (let x = 0; x < this.chunksX; x++) {
            this.chunks[x] = []
            for (let y = 0; y < this.chunksY; y++) {
                this.chunks[x][y] = new Chunk(x, y, this.chunkSize)
            }
        }
    }
    
    // Generate different biomes across chunks
    generateBiomes() {
        // Simple noise-based biome generation
        for (let x = 0; x < this.chunksX; x++) {
            for (let y = 0; y < this.chunksY; y++) {
                const chunk = this.chunks[x][y]
                
                // Use position to determine biome characteristics
                const distanceFromCenter = Math.sqrt(
                    Math.pow(x - this.chunksX/2, 2) + 
                    Math.pow(y - this.chunksY/2, 2)
                )
                
                // Simple biome assignment based on position
                if (distanceFromCenter < 2) {
                    // Central lake/river area
                    chunk.biome = 'wetland'
                    chunk.waterDensity = 3.0
                    chunk.foodDensity = 1.5
                    chunk.humidity = 80
                    chunk.fertility = 70
                } else if (x < this.chunksX * 0.3) {
                    // Western forest
                    chunk.biome = 'forest'
                    chunk.shelterDensity = 2.0
                    chunk.foodDensity = 1.3
                    chunk.coverDensity = 60
                    chunk.humidity = 65
                } else if (x > this.chunksX * 0.7) {
                    // Eastern plains
                    chunk.biome = 'plains'
                    chunk.foodDensity = 0.8
                    chunk.waterDensity = 0.6
                    chunk.coverDensity = 15
                    chunk.humidity = 35
                } else if (y < this.chunksY * 0.3) {
                    // Northern mountains
                    chunk.biome = 'mountain'
                    chunk.shelterDensity = 1.5
                    chunk.waterDensity = 1.2
                    chunk.temperature = 10
                    chunk.humidity = 45
                } else {
                    // Default grassland
                    chunk.biome = 'grassland'
                    chunk.foodDensity = 1.0
                    chunk.waterDensity = 1.0
                    chunk.shelterDensity = 1.0
                }
            }
        }
    }
    
    // Get chunk at world coordinates
    getChunkAtPosition(worldX, worldY) {
        const chunkX = Math.floor(worldX / this.chunkSize)
        const chunkY = Math.floor(worldY / this.chunkSize)
        return this.getChunk(chunkX, chunkY)
    }
    
    // Get chunk at chunk coordinates
    getChunk(chunkX, chunkY) {
        if (chunkX >= 0 && chunkX < this.chunksX && 
            chunkY >= 0 && chunkY < this.chunksY) {
            return this.chunks[chunkX][chunkY]
        }
        return null
    }
    
    // Add entity to appropriate chunk
    addEntity(entity) {
        const chunk = this.getChunkAtPosition(entity.x, entity.y)
        if (chunk) {
            chunk.addEntity(entity)
            entity.currentChunk = chunk
        }
    }
    
    // Update entity's chunk if it moved
    updateEntityChunk(entity, oldX, oldY) {
        const oldChunk = this.getChunkAtPosition(oldX, oldY)
        const newChunk = this.getChunkAtPosition(entity.x, entity.y)
        
        if (oldChunk !== newChunk) {
            if (oldChunk) {
                oldChunk.removeEntity(entity)
            }
            if (newChunk) {
                newChunk.addEntity(entity)
                entity.currentChunk = newChunk
            }
        }
    }
    
    // Get all entities within a radius
    getEntitiesInRadius(worldX, worldY, radius) {
        const entities = []
        
        // Calculate which chunks to check
        const minChunkX = Math.floor((worldX - radius) / this.chunkSize)
        const maxChunkX = Math.ceil((worldX + radius) / this.chunkSize)
        const minChunkY = Math.floor((worldY - radius) / this.chunkSize)
        const maxChunkY = Math.ceil((worldY + radius) / this.chunkSize)
        
        for (let x = minChunkX; x <= maxChunkX; x++) {
            for (let y = minChunkY; y <= maxChunkY; y++) {
                const chunk = this.getChunk(x, y)
                if (!chunk) continue
                
                // Check entities in this chunk
                for (const entity of chunk.entities) {
                    const dx = entity.x - worldX
                    const dy = entity.y - worldY
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    
                    if (distance <= radius) {
                        entities.push(entity)
                    }
                }
            }
        }
        
        return entities
    }
}

export default ChunkManager
