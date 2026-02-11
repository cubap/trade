import test from 'node:test'
import assert from 'node:assert'
import { INVENTION_CONFIG, getBalancedDiscoveryChance } from '../js/models/entities/mobile/InventionConfig.js'

test('Invention System - Bonus Stacking Cap', async (t) => {
    await t.test('should cap total bonuses at maxTotalBonus (40%)', () => {
        const mockPawn = {
            skills: {
                invention: 100,
                experimentation: 50
            }
        }
        
        const mockProblem = {
            attempts: 50,  // Would give 50% attempt bonus unbounded
            successCount: 100  // Would give 200% success bonus unbounded
        }
        
        const chance = getBalancedDiscoveryChance(mockPawn, mockProblem)
        const bonusOnly = chance - (100 * INVENTION_CONFIG.baseInventionChance + 50 * INVENTION_CONFIG.experimentationChance)
        
        assert.ok(bonusOnly <= INVENTION_CONFIG.maxTotalBonus, `Bonus (${bonusOnly}) should not exceed maxTotalBonus (${INVENTION_CONFIG.maxTotalBonus})`)
        assert.strictEqual(chance > 0, true, 'Discovery chance should be positive')
    })
    
    await t.test('maxTotalBonus should be 0.40', () => {
        assert.strictEqual(INVENTION_CONFIG.maxTotalBonus, 0.40)
    })
    
    await t.test('material substitution chance should be > 0', () => {
        assert.ok(INVENTION_CONFIG.materialSubstitutionChance > 0, 'Material substitution should have non-zero chance')
        assert.ok(INVENTION_CONFIG.materialSubstitutionChance <= 1.0, 'Material substitution chance should be <= 1.0')
    })
})

test('Invention System - Quality Calculation', async (t) => {
    await t.test('should have valid quality variance configuration', () => {
        assert.ok(INVENTION_CONFIG.qualityVarianceBase > 0)
        assert.ok(INVENTION_CONFIG.qualityVarianceReduction >= 0)
        assert.ok(INVENTION_CONFIG.minDurability <= INVENTION_CONFIG.maxDurability)
    })
    
    await t.test('should have valid synergy configuration', () => {
        assert.ok(INVENTION_CONFIG.maxSynergyBonus <= 0.30, 'Max synergy bonus capped at 30%')
        assert.ok(Object.keys(INVENTION_CONFIG.skillDomains).length >= 6, 'Should have at least 6 skill domains')
    })
})

test('Invention System - Configuration Structure', async (t) => {
    await t.test('should have all required configuration keys', () => {
        const requiredKeys = [
            'baseInventionChance',
            'maxAttemptBonus',
            'maxSuccessBonus',
            'maxTotalBonus',
            'observationBonus',
            'lateralLearningBonus',
            'skillDomains',
            'materialGroups'
        ]
        
        for (const key of requiredKeys) {
            assert.ok(key in INVENTION_CONFIG, `INVENTION_CONFIG should have property '${key}'`)
        }
    })
})
