import Structure from './Structure.js'

/**
 * Market structure — a trade hub where pawns gather to exchange goods.
 * 
 * Provides buffs to nearby merchants (bartering skill gain, price discovery)
 * and serves as a focal point for trade activity.
 */
class Market extends Structure {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'market'
        this.color = '#e67e22' // Orange for markets
        this.size = 25
        this.deteriorationRate = 0.005 // Markets degrade slower
        
        // Market-specific attributes
        this.tradesRecorded = 0
        this.activeMerchants = 0
        this.providedBuffs = ['bartering_bonus', 'price_discovery']
    }
    
    applyBuffsToEntity(entity) {
        // Boost bartering skill gain for nearby merchants
        if (entity.subtype === 'pawn' && entity.getSkill('bartering')) {
            entity.gainSkill('bartering', 0.1)
        }
    }
    
    recordTrade() {
        this.tradesRecorded++
    }
    
    registerMerchant() {
        this.activeMerchants++
    }
    
    unregisterMerchant() {
        this.activeMerchants = Math.max(0, this.activeMerchants - 1)
    }
}

export default Market
