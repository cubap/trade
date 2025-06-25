class Chunk {
    constructor(x, y, size = 200) {
        this.x = x  // Chunk grid position
        this.y = y
        this.size = size
        this.worldX = x * size  // World position
        this.worldY = y * size
        
        // Environmental properties
        this.biome = 'grassland'  // Default biome
        this.temperature = 20     // Celsius
        this.humidity = 50        // Percentage
        this.fertility = 50       // How well plants grow
        this.coverDensity = 30    // How much natural cover
        
        // Resource distributions
        this.foodDensity = 1.0    // Multiplier for food generation
        this.waterDensity = 1.0   // Multiplier for water generation
        this.shelterDensity = 1.0 // Multiplier for shelter generation
        
        // Entities in this chunk
        this.entities = new Set()
        
        // Cached resource lists for quick lookup
        this.foodSources = []
        this.waterSources = []
        this.shelters = []
    }
    
    // Check if a world position is within this chunk
    contains(worldX, worldY) {
        return worldX >= this.worldX && 
               worldX < this.worldX + this.size &&
               worldY >= this.worldY && 
               worldY < this.worldY + this.size
    }
    
    // Add entity to chunk
    addEntity(entity) {
        this.entities.add(entity)
        
        // Cache resources for quick access (only if entity has tags array)
        if (Array.isArray(entity.tags)) {
            if (entity.tags.includes('food')) {
                this.foodSources.push(entity)
            }
            if (entity.tags.includes('water')) {
                this.waterSources.push(entity)
            }
            if (entity.tags.includes('cover')) {
                this.shelters.push(entity)
            }
        }
    }
    
    // Remove entity from chunk
    removeEntity(entity) {
        this.entities.delete(entity)
        
        // Remove from cached lists
        this.foodSources = this.foodSources.filter(e => e !== entity)
        this.waterSources = this.waterSources.filter(e => e !== entity)
        this.shelters = this.shelters.filter(e => e !== entity)
    }
    
    // Get nearby chunks (including this one)
    getNearbyChunks(chunkManager, radius = 1) {
        const chunks = []
        
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const chunk = chunkManager.getChunk(this.x + dx, this.y + dy)
                if (chunk) {
                    chunks.push(chunk)
                }
            }
        }
        
        return chunks
    }
}

export default Chunk
