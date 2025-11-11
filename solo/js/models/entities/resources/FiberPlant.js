import Resource from './Resource.js'

class FiberPlant extends Resource {
  constructor(id, x, y) {
    super(id, 'Fiber Plant', x, y)
    this.subtype = 'fiber_plant'
    this.tags.push('fiber', 'plant', 'material', 'harvestable')
    this.color = '#9ACD32'
    this.size = 3
    this.amount = 3
    this.maxAmount = 3
    this.regenerationRate = 0.01 // Slowly regenerates
  }

  gather(amount = 1) {
    if (this.amount <= 0) return null
    const gathered = Math.min(amount, this.amount)
    this.amount = Math.max(0, this.amount - gathered)
    return {
      id: `${this.id}_gathered_${Date.now()}`,
      type: 'fiber',
      name: 'Plant Fiber',
      tags: ['material', 'fiber'],
      weight: 0.5,
      size: 1
    }
  }

  canGather() {
    return this.amount > 0
  }

  update(tick) {
    super.update(tick)
    // Regenerate slowly
    if (this.amount < this.maxAmount && Math.random() < this.regenerationRate) {
      this.amount = Math.min(this.maxAmount, this.amount + 0.1)
    }
    return true
  }
}

export default FiberPlant
