import Structure from './Structure.js'

class ResourceCache extends Structure {
  constructor(id, name, x, y, options = {}) {
    super(id, name, x, y)
    this.subtype = 'cache'
    this.tags = new Set(['structure', 'cover', 'resource_cache', 'landmark'])
    this.color = '#8b6f47'
    this.size = options.size ?? 12
    this.capacity = options.capacity ?? 80
    this.items = []
    this.shared = options.shared ?? true
    this.ownerId = options.ownerId ?? null
    this.purpose = options.purpose ?? 'general'
    this.soakJobs = []
    this.lastInteractionTick = 0
    this.maxIdleTicks = options.maxIdleTicks ?? 2400
    this.deteriorationRate = 0
  }

  update(tick) {
    super.update(tick)
    this.processSoakJobs(tick)

    const hasNoItems = this.items.length === 0
    const hasNoJobs = this.soakJobs.length === 0
    const idleTooLong = tick - (this.lastInteractionTick || this.spawned || tick) > this.maxIdleTicks

    if (hasNoItems && hasNoJobs && idleTooLong) {
      return false
    }

    return true
  }

  totalItems() {
    return this.items.length
  }

  countByType(type) {
    return this.items.filter(item => item?.type === type).length
  }

  addItem(item, tick = 0) {
    if (!item) return false
    if (this.items.length >= this.capacity) return false
    this.items.push(item)
    this.lastInteractionTick = tick
    return true
  }

  addItems(items, tick = 0) {
    if (!Array.isArray(items) || items.length === 0) return 0
    let added = 0
    for (const item of items) {
      if (!this.addItem(item, tick)) break
      added++
    }
    return added
  }

  takeItems(type, count = 1, tick = 0) {
    if (!type || count <= 0) return []
    const taken = []

    for (let i = this.items.length - 1; i >= 0 && taken.length < count; i--) {
      const item = this.items[i]
      if (item?.type !== type) continue
      taken.push(item)
      this.items.splice(i, 1)
    }

    if (taken.length > 0) {
      this.lastInteractionTick = tick
    }

    return taken
  }

  startSoakJob({
    inputType,
    outputType,
    quantity = 1,
    durationTicks = 360,
    itemFactory = null,
    tick = 0
  }) {
    if (!inputType || !outputType || quantity <= 0) return false
    const pulled = this.takeItems(inputType, quantity, tick)
    if (pulled.length < quantity) {
      this.addItems(pulled, tick)
      return false
    }

    this.soakJobs.push({
      inputType,
      outputType,
      quantity,
      startTick: tick,
      readyTick: tick + durationTicks,
      itemFactory
    })

    this.lastInteractionTick = tick
    return true
  }

  processSoakJobs(tick = 0) {
    if (!this.soakJobs.length) return
    const completed = []

    for (const job of this.soakJobs) {
      if (tick < job.readyTick) continue
      for (let i = 0; i < job.quantity; i++) {
        const outputItem = typeof job.itemFactory === 'function'
          ? job.itemFactory(i)
          : {
              id: `${job.outputType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              type: job.outputType,
              name: job.outputType.replace(/_/g, ' '),
              quality: 1,
              durability: 1.1,
              weight: 1,
              size: 1,
              soaked: true
            }
        this.addItem(outputItem, tick)
      }
      completed.push(job)
    }

    if (completed.length) {
      this.soakJobs = this.soakJobs.filter(job => !completed.includes(job))
      this.lastInteractionTick = tick
    }
  }
}

export default ResourceCache
