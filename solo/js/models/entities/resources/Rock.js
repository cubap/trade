import Resource from './Resource.js'

class Rock extends Resource {
  constructor(id, x, y) {
    super(id, 'Rock', x, y)
    this.subtype = 'rock'
    this.tags.push('rock', 'material', 'harvestable')
    this.color = '#8B7355'
    this.size = 3
    this.amount = 1
    this.maxAmount = 1
    this.regenerationRate = 0 // Rocks don't regenerate
  }

  gather(amount = 1) {
    if (this.amount <= 0) return null
    this.amount = Math.max(0, this.amount - amount)
    return {
      id: `${this.id}_gathered_${Date.now()}`,
      type: 'rock',
      name: 'Rock',
      tags: ['material', 'stone'],
      weight: 2,
      size: 1
    }
  }

  canGather() {
    return this.amount > 0
  }
}

export default Rock
