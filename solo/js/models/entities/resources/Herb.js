import Resource from './Resource.js'

/**
 * #129: the herbalism branch asked for `herb` and nothing in the world could
 * produce one. `herb_mash` needs two, `poultice` needs a third on top of the
 * mash, and both unlocks (`simple_poultice`, `mashed_herbs`) are gated on having
 * handled two herbs, so the entire medicine rung of the skill tree was waiting
 * on a plant that had never been written. This is that plant.
 *
 * It is a `Resource`, not a `Flora` plant, because the pawn-side gathering path
 * (`Pawn.gatherFromResource`) only speaks to `canGather()/gather()`, which is the
 * `Resource` half of the model tree - the same reason `FiberPlant` lives here
 * rather than next to `Grass`.
 *
 * Deliberately stingier than fibre: two picks per patch instead of three, and a
 * slower trickle back. Medicine that grows in hedges is not medicine.
 */
class Herb extends Resource {
  constructor(id, x, y) {
    super(id, 'Wild Herb', x, y)
    this.subtype = 'herb'
    // 'plant' is what earns herbalism practice from observeInteraction();
    // 'herb' is what earns it from examineItem() and what the gatherer matches on.
    this.tags.push('herb', 'plant', 'material', 'harvestable', 'medicinal')
    this.color = '#3F7A4E'
    this.size = 3
    this.amount = 2
    this.maxAmount = 2
    this.regenerationRate = 0.012 // Patches come back, just not quickly
  }

  gather(amount = 1) {
    if (this.amount <= 0) return null
    const gathered = Math.min(amount, this.amount)
    this.amount = Math.max(0, this.amount - gathered)
    return {
      id: `${this.id}_gathered_${Date.now()}`,
      type: 'herb',
      name: 'Wild Herb',
      tags: ['material', 'herb', 'medicinal'],
      weight: 0.2,
      size: 1
    }
  }

  canGather() {
    return this.amount > 0
  }

  update(tick) {
    super.update(tick)
    if (this.amount < this.maxAmount && Math.random() < this.regenerationRate) {
      this.amount = Math.min(this.maxAmount, this.amount + 0.1)
    }
    return true
  }
}

export default Herb
