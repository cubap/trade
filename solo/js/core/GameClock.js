class GameClock {
    constructor(msPerTick = 1000) {
        this.msPerTick = msPerTick
        this.lastTimestamp = 0
        this.accumulatedTime = 0
        this.currentTick = 0
        this.isPaused = false
        this.lastProgressTimestamp = 0

    // Universal game-time mapping (aligned with Pawn constants)
    this.gameSecondsPerTick = 48 // 1 tick == 48 in-game seconds
    this.gameHourSeconds = 60 * 48 // 2880 in-game seconds per hour
    this.gameDayHours = 6 // 6 in-game hours per day
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

    // Universal helpers
    getGameSeconds() {
        return this.currentTick * this.gameSecondsPerTick
    }

    // 0 .. gameDayHours-1
    getGameHour() {
        const hours = Math.floor(this.getGameSeconds() / this.gameHourSeconds)
        return hours % this.gameDayHours
    }

    // Map compact game day to a 24-hour clock (0..23) using game seconds for granularity
    getHour24(offset = 0) {
        const daySeconds = this.gameDayHours * this.gameHourSeconds
        const gs = this.getGameSeconds() % daySeconds
        const scaled = Math.floor((gs * 24) / daySeconds)
        return (scaled + offset + 24) % 24
    }
}

export default GameClock
