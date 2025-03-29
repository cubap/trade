class GameClock {
    constructor(tickRate = 1000) {
        this.currentTick = 0
        this.tickRate = tickRate
        this.lastTickTime = performance.now()
        this.accumulator = 0
        this.lastProgress = 0 // Track last progress value for detection of resets
    }

    update(currentTime) {
        // Calculate time delta since last update
        const delta = currentTime - this.lastTickTime
        this.lastTickTime = currentTime
        
        // Add to accumulator
        this.accumulator += delta
        
        // If we've accumulated enough time for a tick
        if (this.accumulator >= this.tickRate) {
            this.currentTick++
            this.accumulator -= this.tickRate  // Keep remainder for smooth transitions
            return true
        }
        return false
    }
    
    getProgress() {
        const progress = this.accumulator / this.tickRate
        // Detect if we've reset (new tick) and notify renderer
        const reset = progress < this.lastProgress && this.lastProgress > 0.8
        this.lastProgress = progress
        return { progress, reset }
    }
}

export default GameClock
