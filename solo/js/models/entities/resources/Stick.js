import Resource from './Resource.js'

class Stick extends Resource {
  constructor(id, x, y) {
    super(id, 'Stick', x, y)
    this.subtype = 'stick'
    this.tags.push('stick', 'wood', 'material', 'harvestable')
    this.color = '#8B4513'
    this.size = 4
    this.amount = 2
    this.maxAmount = 2
    this.regenerationRate = 0 // Fallen branches don't regenerate
  }

  gather(amount = 1) {
    if (this.amount <= 0) return null
    this.amount = Math.max(0, this.amount - amount)
    return {
      id: `${this.id}_gathered_${Date.now()}`,
      type: 'stick',
      name: 'Stick',
      tags: ['material', 'wood'],
      weight: 1,
      size: 2
    }
  }

  canGather() {
    return this.amount > 0
  }
}

export default Stick
