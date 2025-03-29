class ActionQueue {
    constructor() {
        this.queue = []
        this.scheduledActions = new Map()  // Map ticks to actions
    }

    addAction(action) {
        this.queue.push(action)
    }

    scheduleAction(action, executionTick) {
        if (!this.scheduledActions.has(executionTick)) {
            this.scheduledActions.set(executionTick, [])
        }
        this.scheduledActions.get(executionTick).push(action)
    }

    processActions() {
        // Process immediate actions
        for (const action of this.queue) {
            action()
        }
        this.queue = []
    }
    
    processTick(currentTick) {
        // Process immediate actions
        this.processActions()
        
        // Process scheduled actions for this tick
        if (!this.scheduledActions.has(currentTick)) return
        
        const tickActions = this.scheduledActions.get(currentTick)
        for (const action of tickActions) {
            action()
        }
        this.scheduledActions.delete(currentTick)
    }
}

export default ActionQueue
