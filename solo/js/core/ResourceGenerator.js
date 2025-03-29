import { FoodSource, WaterSource, Cover } from '../models/entities/resources/index.js'

class ResourceGenerator {
    constructor(world) {
        this.world = world
    }
    
    // Generate resources throughout the world
    generateResources() {
        this.generateFoodSources()
        this.generateWaterSources()
        this.generateCoverAreas()
    }
    
    generateFoodSources() {
        // Create clusters of food
        const clusters = Math.floor(this.world.width * this.world.height / 200000) + 3
        
        for (let i = 0; i < clusters; i++) {
            // Pick a center for the cluster
            const centerX = Math.random() * this.world.width
            const centerY = Math.random() * this.world.height
            
            // Create between 3-8 food sources in this cluster
            const count = 3 + Math.floor(Math.random() * 6)
            const clusterRadius = 100 + Math.random() * 150
            
            // Names for different food types
            const foodTypes = ['Berry Bush', 'Fruit Tree', 'Mushroom Patch', 'Root Vegetable']
            
            for (let j = 0; j < count; j++) {
                // Random position within the cluster radius
                const angle = Math.random() * Math.PI * 2
                const distance = Math.random() * clusterRadius
                
                const x = Math.max(0, Math.min(this.world.width, centerX + Math.cos(angle) * distance))
                const y = Math.max(0, Math.min(this.world.height, centerY + Math.sin(angle) * distance))
                
                // Select a random food type
                const foodType = foodTypes[Math.floor(Math.random() * foodTypes.length)]
                
                // Create the food source
                const foodSource = new FoodSource(
                    `food_${i}_${j}`,
                    foodType,
                    x, 
                    y
                )
                
                // Add to world
                this.world.addEntity(foodSource)
            }
        }
    }
    
    generateWaterSources() {
        // Create fewer water sources but make them larger
        const waterCount = Math.floor(this.world.width * this.world.height / 400000) + 2
        
        // Names for different water types
        const waterTypes = ['Pond', 'Stream', 'Spring', 'River Bend']
        
        for (let i = 0; i < waterCount; i++) {
            const x = Math.random() * this.world.width
            const y = Math.random() * this.world.height
            
            // Pick a water type
            const waterType = waterTypes[Math.floor(Math.random() * waterTypes.length)]
            
            // Create the water source
            const waterSource = new WaterSource(
                `water_${i}`,
                waterType,
                x,
                y
            )
            
            // Water sources are larger
            waterSource.size = 18 + Math.floor(Math.random() * 8)
            
            // Add to world
            this.world.addEntity(waterSource)
        }
    }
    
    generateCoverAreas() {
        // Create a mix of individual and clustered cover
        const coverCount = Math.floor(this.world.width * this.world.height / 100000) + 5
        
        // Names for different cover types
        const coverTypes = ['Rock Formation', 'Dense Bush', 'Hollow Log', 'Tall Grass', 'Tree']
        
        for (let i = 0; i < coverCount; i++) {
            const x = Math.random() * this.world.width
            const y = Math.random() * this.world.height
            
            // Pick a cover type
            const coverType = coverTypes[Math.floor(Math.random() * coverTypes.length)]
            
            // Create the cover
            const cover = new Cover(
                `cover_${i}`,
                coverType,
                x,
                y
            )
            
            // Vary size and capacity based on type
            if (coverType === 'Rock Formation') {
                cover.size = 20
                cover.capacity = 4
                cover.securityValue = 90
            } else if (coverType === 'Tree') {
                cover.size = 18
                cover.capacity = 3
                cover.securityValue = 75
            }
            
            // Add to world
            this.world.addEntity(cover)
        }
    }
}

export default ResourceGenerator
