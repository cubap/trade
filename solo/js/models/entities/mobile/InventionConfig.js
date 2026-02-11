// Configuration for the Invention System
// These values can be tuned to balance fun and efficiency

export const INVENTION_CONFIG = {
    // Discovery rates
    baseInventionChance: 0.01,        // 1% per invention skill level
    experimentationChance: 0.005,     // 0.5% per experimentation level
    attemptBonus: 0.01,               // 1% per attempt
    maxAttemptBonus: 0.15,            // Cap at 15%
    
    // Success path bonuses
    successPathBonus: 0.02,           // 2% per related success
    maxSuccessBonus: 0.20,            // Cap at 20%
    maxTotalBonus: 0.40,              // Cap total bonuses at 40% to prevent trivial discovery
    
    // Observation bonuses
    observationBonus: 0.15,           // 15% if observed
    lateralLearningBonus: 0.10,       // 10% if know materials
    
    // Pondering system
    maxPonderingAttempts: 20,         // Give up after 20 attempts
    ponderingCooldown: 100,           // Ticks between problem solving
    quickPonderingCooldown: 10,       // Between attempts
    idlePonderingRate: 20,            // Process every 20 ticks when idle
    normalPonderingRate: 50,          // Process every 50 ticks normally
    
    // Quality system
    qualitySkillBonus: 0.01,          // 1% quality per skill level
    maxSynergyBonus: 0.30,            // 30% max from synergies
    synergyMultiplier: 0.005,         // 0.5% per related skill level
    qualityVarianceBase: 0.3,         // ±30% base variance
    qualityVarianceReduction: 0.002,  // Variance reduction per skill
    
    // Durability thresholds
    poorQualityThreshold: 0.8,        // Below this = degraded start
    excellentQualityThreshold: 1.2,   // Above this = bonus durability
    minDurability: 0.6,               // Worst starting condition
    maxDurability: 1.5,               // Best starting condition
    minEffectiveness: 0.3,            // Min effectiveness when worn
    
    // Social learning
    observationRange: 100,            // Distance to observe crafts
    inspirationChance: 0.005,         // Base inspiration from stories
    materialSubstitutionChance: 0.1,  // 10% to ponder substitution
    
    // Skill synergies (grouped by domain)
    skillDomains: {
        textiles: ['weaving', 'basketry', 'textile_work', 'rope_craft'],
        stonework: ['knapping', 'stonework', 'tool_making', 'mining'],
        medicine: ['herbalism', 'alchemy', 'medicine', 'poisoncraft'],
        construction: ['construction_basics', 'carpentry', 'engineering'],
        hunting: ['hunting', 'tracking', 'archery', 'butchery'],
        survival: ['gathering', 'foraging', 'survival', 'orienteering']
    },
    
    // Material groups for substitution
    materialGroups: {
        fibers: ['fiber', 'reed', 'linen', 'grass', 'hemp', 'cotton', 'wool'],
        stones: ['rock', 'stone', 'flint', 'obsidian', 'granite', 'marble'],
        woods: ['stick', 'branch', 'log', 'plank', 'timber', 'bark'],
        hides: ['leather', 'fur', 'skin', 'hide', 'pelt'],
        metals: ['copper', 'bronze', 'iron', 'steel', 'gold', 'silver'],
        herbs: ['herb', 'leaf', 'flower', 'root', 'bark', 'seed']
    },
    
    // User intervention ranges
    priorityMultiplierMin: 0.1,       // Min priority adjustment
    priorityMultiplierMax: 3.0,       // Max priority adjustment
    inventionRateMin: 0.1,            // Min invention rate
    inventionRateMax: 5.0,            // Max invention rate
    resourceValueMin: 0.0,            // Min resource value
    resourceValueMax: 1.0,            // Max resource value
    
    // Balancing flags
    enableSkillDecay: true,           // Whether skills decay over time
    skillDecayRate: 0.1,              // Decay per period
    skillDecayFloor: 0.5,             // Skills don't decay below 50% of peak
    skillDecayPeriod: 2000,           // Ticks between decay checks
    skillDecayInactiveThreshold: 2000, // Ticks before decay starts
    
    // Crafting history
    maxCraftingHistory: 20,           // Keep last N crafts
    
    // Resource memory
    maxObservedCrafts: 100,           // Max observed craft types
    maxKnownMaterials: 150            // Max material types tracked
}

export function getBalancedDiscoveryChance(pawn, problem) {
    // Calculate balanced discovery chance using config
    const invention = pawn.skills.invention ?? 0
    const experimentation = pawn.skills.experimentation ?? 0
    
    const baseChance = 
        (invention * INVENTION_CONFIG.baseInventionChance) + 
        (experimentation * INVENTION_CONFIG.experimentationChance)
    
    const attemptBonus = Math.min(
        INVENTION_CONFIG.maxAttemptBonus,
        problem.attempts * INVENTION_CONFIG.attemptBonus
    )
    
    // Apply total bonus cap to prevent trivial discovery rates
    const totalBonus = Math.min(
        INVENTION_CONFIG.maxTotalBonus,
        attemptBonus + 
        (problem.successCount ?? 0) * INVENTION_CONFIG.successPathBonus
    )
    
    return baseChance + totalBonus
}

export function getQualityVariance(skillLevel) {
    // Quality variance decreases with skill
    return INVENTION_CONFIG.qualityVarianceBase - 
           (skillLevel * INVENTION_CONFIG.qualityVarianceReduction)
}

export function shouldApplySkillDecay(pawn, skill, currentTick) {
    if (!INVENTION_CONFIG.enableSkillDecay) return false
    
    const lastUsed = pawn.skillLastUsed[skill] ?? 0
    return (currentTick - lastUsed) > INVENTION_CONFIG.skillDecayInactiveThreshold
}

export default INVENTION_CONFIG
