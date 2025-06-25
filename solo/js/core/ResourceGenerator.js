import { FoodSource, WaterSource, Cover } from '../models/entities/resources/index.js'

class ResourceGenerator {
    constructor(world) {
        this.world = world
    }
    
    // Generate resources throughout the world using chunk-based placement
    generateResources() {
        this.generateChunkBasedResources()
    }
    
    generateChunkBasedResources() {
        const chunkManager = this.world.chunkManager
        
        // Generate resources for each chunk based on its properties
        for (let x = 0; x < chunkManager.chunksX; x++) {
            for (let y = 0; y < chunkManager.chunksY; y++) {
                const chunk = chunkManager.getChunk(x, y)
                if (chunk) {
                    this.generateResourcesForChunk(chunk)
                }
            }
        }
    }
    
    generateResourcesForChunk(chunk) {
        this.generateFoodSourcesForChunk(chunk)
        this.generateWaterSourcesForChunk(chunk)
        this.generateCoverAreasForChunk(chunk)
    }
    
    generateFoodSourcesForChunk(chunk) {
        // Base food count adjusted by chunk's food density
        const baseFoodCount = 2 + Math.floor(Math.random() * 4)
        const foodCount = Math.floor(baseFoodCount * chunk.foodDensity)
        
        if (foodCount === 0) return
        
        // Food types vary by biome
        let foodTypes
        switch (chunk.biome) {
            case 'forest':
                foodTypes = ['Mushroom Patch', 'Berry Bush', 'Nut Tree', 'Root Vegetable']
                break
            case 'plains':
                foodTypes = ['Grain Field', 'Fruit Tree', 'Herb Patch']
                break
            case 'wetland':
                foodTypes = ['Water Plants', 'Marsh Berry', 'Reed Shoots']
                break
            case 'mountain':
                foodTypes = ['Mountain Berry', 'Pine Nuts', 'Wild Tubers']
                break
            default:
                foodTypes = ['Berry Bush', 'Fruit Tree', 'Mushroom Patch', 'Root Vegetable']
        }
        
        // Create clusters within the chunk
        const clusters = Math.max(1, Math.floor(foodCount / 3))
        
        for (let i = 0; i < clusters; i++) {
            // Cluster center within chunk bounds
            const centerX = chunk.worldX + 50 + Math.random() * (chunk.size - 100)
            const centerY = chunk.worldY + 50 + Math.random() * (chunk.size - 100)
            
            const itemsInCluster = Math.ceil(foodCount / clusters)
            const clusterRadius = 30 + Math.random() * 50
            
            for (let j = 0; j < itemsInCluster; j++) {
                const angle = Math.random() * Math.PI * 2
                const distance = Math.random() * clusterRadius
                
                const x = Math.max(chunk.worldX, 
                    Math.min(chunk.worldX + chunk.size, 
                        centerX + Math.cos(angle) * distance))
                const y = Math.max(chunk.worldY, 
                    Math.min(chunk.worldY + chunk.size, 
                        centerY + Math.sin(angle) * distance))
                
                const foodType = foodTypes[Math.floor(Math.random() * foodTypes.length)]
                
                const foodSource = new FoodSource(
                    `food_${chunk.x}_${chunk.y}_${i}_${j}`,
                    foodType,
                    x, 
                    y
                )
                
                // Adjust properties based on biome
                if (chunk.biome === 'forest') {
                    foodSource.nutritionalValue *= 1.2
                } else if (chunk.biome === 'wetland') {
                    foodSource.regenerationRate *= 1.5
                }
                
                this.world.addEntity(foodSource)
            }
        }
    }
    
    generateWaterSourcesForChunk(chunk) {
        // Water generation based on chunk's water density
        const baseWaterChance = 0.3  // 30% chance per chunk
        const waterChance = baseWaterChance * chunk.waterDensity
        
        if (Math.random() > waterChance) return
        
        // Water types vary by biome
        let waterTypes
        switch (chunk.biome) {
            case 'wetland':
                waterTypes = ['Pond', 'Marsh', 'Stream', 'Spring']
                break
            case 'mountain':
                waterTypes = ['Mountain Spring', 'Stream', 'Snow Melt']
                break
            case 'forest':
                waterTypes = ['Forest Spring', 'Creek', 'Pond']
                break
            default:
                waterTypes = ['Pond', 'Stream', 'Spring']
        }
        
        // Position within chunk
        const x = chunk.worldX + 30 + Math.random() * (chunk.size - 60)
        const y = chunk.worldY + 30 + Math.random() * (chunk.size - 60)
        
        const waterType = waterTypes[Math.floor(Math.random() * waterTypes.length)]
        
        const waterSource = new WaterSource(
            `water_${chunk.x}_${chunk.y}`,
            waterType,
            x,
            y
        )
        
        // Adjust size based on biome and density
        const baseSize = 18 + Math.floor(Math.random() * 8)
        if (chunk.biome === 'wetland') {
            waterSource.size = baseSize * 1.5
            waterSource.capacity *= 2
        } else if (chunk.biome === 'mountain') {
            waterSource.size = baseSize * 0.8
            waterSource.purity = 95  // Mountain water is cleaner
        }
        
        this.world.addEntity(waterSource)
    }
    
    generateCoverAreasForChunk(chunk) {
        // Cover generation based on chunk's shelter density
        const baseCoverCount = 2 + Math.floor(Math.random() * 3)
        const coverCount = Math.floor(baseCoverCount * chunk.shelterDensity)
        
        if (coverCount === 0) return
        
        // Cover types vary by biome
        let coverTypes
        switch (chunk.biome) {
            case 'forest':
                coverTypes = ['Hollow Log', 'Dense Bush', 'Tree', 'Root Cave']
                break
            case 'mountain':
                coverTypes = ['Rock Formation', 'Cave', 'Stone Shelter', 'Cliff Overhang']
                break
            case 'plains':
                coverTypes = ['Tall Grass', 'Rock Outcrop', 'Shrub']
                break
            case 'wetland':
                coverTypes = ['Reed Bed', 'Fallen Log', 'Dense Marsh']
                break
            default:
                coverTypes = ['Rock Formation', 'Dense Bush', 'Hollow Log', 'Tall Grass', 'Tree']
        }
        
        for (let i = 0; i < coverCount; i++) {
            const x = chunk.worldX + 20 + Math.random() * (chunk.size - 40)
            const y = chunk.worldY + 20 + Math.random() * (chunk.size - 40)
            
            const coverType = coverTypes[Math.floor(Math.random() * coverTypes.length)]
            
            const cover = new Cover(
                `cover_${chunk.x}_${chunk.y}_${i}`,
                coverType,
                x,
                y
            )
            
            // Adjust properties based on biome and type
            if (chunk.biome === 'mountain') {
                cover.securityValue *= 1.3
                if (coverType === 'Cave') {
                    cover.capacity = 6
                    cover.securityValue = 95
                }
            } else if (chunk.biome === 'forest') {
                cover.size *= 1.1
                if (coverType === 'Tree') {
                    cover.capacity = 4
                }
            }
            
            this.world.addEntity(cover)
        }
    }
}

export default ResourceGenerator
