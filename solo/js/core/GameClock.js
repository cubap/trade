class GameClock {
    constructor(msPerTick = 1000) {
        this.msPerTick = msPerTick
        this.lastTimestamp = 0
        this.accumulatedTime = 0
        this.currentTick = 0
        this.isPaused = false
        this.lastProgressTimestamp = 0
    }
    
    pause() {
        this.isPaused = true
    }
    
    resume() {
        this.isPaused = true
        // Reset last timestamp on resume to prevent time accumulation during pause
        this.lastTimestamp = performance.now()
        this.accumulatedTime = 0
        this.isPaused = false
    }
    
    update(timestamp) {
        // If first update or resuming from pause, just store time and return
        if (this.lastTimestamp === 0 || this.isPaused) {
            this.lastTimestamp = timestamp
            return false
        }
        
        // Calculate time since last update
        const deltaTime = timestamp - this.lastTimestamp
        
        // Add to accumulated time
        this.accumulatedTime += deltaTime
        
        // Check if we've accumulated enough time for a tick
        if (this.accumulatedTime >= this.msPerTick) {
            // Increment tick counter
            this.currentTick++
            
            // Subtract processed time from accumulator
            this.accumulatedTime -= this.msPerTick
            
            // Update last timestamp
            this.lastTimestamp = timestamp
            
            // Record time for progress calculation
            this.lastProgressTimestamp = timestamp
            
            return true
        }
        
        // Not enough time for a tick
        this.lastTimestamp = timestamp
        return false
    }
    
    getProgress() {
        // Calculate how far we are into the next tick (0-1)
        const progress = this.accumulatedTime / this.msPerTick
        
        // Also determine if we just reset (for renderer to handle transitions)
        const reset = this.accumulatedTime < 10
        
        return { progress, reset }
    }
}

export default GameClock
