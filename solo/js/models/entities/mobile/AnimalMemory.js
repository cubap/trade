class AnimalMemory {
    constructor(animal) {
        this.animal = animal
    }
    
    recordResourceInMemory(resource) {
        if (!resource || !resource.tags) return
        
        const currentTick = this.animal.world?.clock?.currentTick || 0
        
        if (resource.tags.has('food')) {
            // Check if already known
            const existing = this.animal.memory.knownFood.find(f => f.id === resource.id)
            if (!existing) {
                this.animal.memory.knownFood.push({
                    id: resource.id,
                    x: resource.x,
                    y: resource.y,
                    nutritionalValue: resource.nutritionalValue || 10,
                    lastVisited: currentTick
                })
                
                // Limit memory size
                if (this.animal.memory.knownFood.length > 5) {
                    this.animal.memory.knownFood.shift()
                }
            } else {
                existing.lastVisited = currentTick
            }
        }
        
        if (resource.tags.has('water')) {
            const existing = this.animal.memory.knownWater.find(w => w.id === resource.id)
            if (!existing) {
                this.animal.memory.knownWater.push({
                    id: resource.id,
                    x: resource.x,
                    y: resource.y,
                    capacity: resource.capacity || 100,
                    lastVisited: currentTick
                })
                
                if (this.animal.memory.knownWater.length > 3) {
                    this.animal.memory.knownWater.shift()
                }
            } else {
                existing.lastVisited = currentTick
            }
        }
        
        if (resource.tags.has('cover')) {
            const existing = this.animal.memory.knownShelter.find(s => s.id === resource.id)
            if (!existing) {
                this.animal.memory.knownShelter.push({
                    id: resource.id,
                    x: resource.x,
                    y: resource.y,
                    securityValue: resource.securityValue || 50,
                    capacity: resource.capacity || 1,
                    lastVisited: currentTick
                })
                
                if (this.animal.memory.knownShelter.length > 3) {
                    this.animal.memory.knownShelter.shift()
                }
            } else {
                existing.lastVisited = currentTick
            }
        }
    }
    
    isKnownResource(resource) {
        if (!resource) return false
        
        const allMemories = [
            ...(this.animal.memory.knownFood || []),
            ...(this.animal.memory.knownWater || []),
            ...(this.animal.memory.knownShelter || [])
        ]
        
        return allMemories.some(memory => memory.id === resource.id)
    }
    
    getMemorizedResource(resourceType, preferClosest = true) {
        let memories = []
        
        switch (resourceType) {
            case 'food':
                memories = this.animal.memory.knownFood || []
                break
            case 'water':
                memories = this.animal.memory.knownWater || []
                break
            case 'shelter':
                memories = this.animal.memory.knownShelter || []
                break
        }
        
        if (memories.length === 0) return null
        
        if (preferClosest) {
            // Sort by distance to animal
            memories.sort((a, b) => {
                const distA = Math.sqrt((a.x - this.animal.x) ** 2 + (a.y - this.animal.y) ** 2)
                const distB = Math.sqrt((b.x - this.animal.x) ** 2 + (b.y - this.animal.y) ** 2)
                return distA - distB
            })
        } else {
            // Sort by recency of visit
            memories.sort((a, b) => b.lastVisited - a.lastVisited)
        }
        
        return memories[0]
    }
    
    forgetOldMemories(maxAge = 100) {
        const currentTick = this.animal.world?.clock?.currentTick || 0
        
        // Filter out old memories
        this.animal.memory.knownFood = this.animal.memory.knownFood.filter(
            memory => currentTick - memory.lastVisited < maxAge
        )
        this.animal.memory.knownWater = this.animal.memory.knownWater.filter(
            memory => currentTick - memory.lastVisited < maxAge
        )
        this.animal.memory.knownShelter = this.animal.memory.knownShelter.filter(
            memory => currentTick - memory.lastVisited < maxAge
        )
    }
}

export default AnimalMemory
