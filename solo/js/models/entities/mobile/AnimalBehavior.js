class AnimalBehavior {
    constructor(animal) {
        this.animal = animal
    }
    
    // Drive management
    updateDrives(tick) {
        if (!this.animal.lastDriveUpdate || tick - this.animal.lastDriveUpdate >= 5) {
            const rate = 1.5
            
            // Drives naturally increase over time
            this.animal.drives.hunger += rate
            this.animal.drives.thirst += rate * 1.2
            
            // Rest decreases during activity, increases during rest
            if (this.animal.behaviorState === 'resting') {
                this.animal.drives.rest -= rate * 2
            } else {
                this.animal.drives.rest += rate * 0.5
            }
            
            // Cap values
            this.animal.drives.hunger = Math.min(100, this.animal.drives.hunger)
            this.animal.drives.thirst = Math.min(100, this.animal.drives.thirst)
            this.animal.drives.rest = Math.min(100, this.animal.drives.rest)
            
            this.animal.lastDriveUpdate = tick
        }
    }
    
    evaluatePriorities() {
        this.animal.actionQueue = []
        
        // Check each drive against its tolerance thresholds
        for (const drive in this.animal.drives) {
            if (!this.animal.tolerances[drive]) continue
            
            const value = this.animal.drives[drive]
            const thresholds = this.animal.tolerances[drive].thresholds
            const priorities = this.animal.tolerances[drive].priorities
            
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
                this.animal.actionQueue.push({
                    drive,
                    priority,
                    value
                })
            }
        }
        
        // Add exploration as a potential activity with a base priority
        const knowledge = this.assessKnowledge()
        
        // If rest is low and knowledge is incomplete, add exploration to queue
        if (this.animal.drives.rest < 50 && knowledge.needsExploration) {
            const explorationPriority = 10 + (1 - knowledge.knowledgeScore) * 20
            
            this.animal.actionQueue.push({
                drive: 'exploration',
                priority: explorationPriority,
                value: 1 - knowledge.knowledgeScore
            })
        }
        
        // Sort action queue by priority (highest first)
        this.animal.actionQueue.sort((a, b) => b.priority - a.priority)
        
        // Set behavior based on highest priority
        if (this.animal.actionQueue.length > 0) {
            const highestPriority = this.animal.actionQueue[0]
            
            switch (highestPriority.drive) {
                case 'hunger':
                    this.animal.behaviorState = 'foraging'
                    break
                case 'thirst':
                    this.animal.behaviorState = 'seeking_water'
                    break
                case 'rest':
                    this.animal.behaviorState = 'resting'
                    break
                case 'exploration':
                    this.animal.behaviorState = 'exploring'
                    break
                default:
                    this.animal.behaviorState = 'idle'
            }
        } else {
            this.animal.behaviorState = 'idle'
        }
    }
    
    assessKnowledge() {
        // Check if animal has sufficient knowledge of different resource types
        const knownFoodCount = this.animal.memory.knownFood.length
        const knownWaterCount = this.animal.memory.knownWater.length
        const knownShelterCount = this.animal.memory.knownShelter.length
        
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
}

export default AnimalBehavior
