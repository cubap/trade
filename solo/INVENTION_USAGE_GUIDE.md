# Autonomous Invention System - Usage Guide

## Overview

The Autonomous Invention System allows pawns to make their own choices while providing user intervention at key points. Pawns can:
- Discover solutions through pondering
- Learn from observing others
- Specialize based on success
- Collaborate and teach
- Follow user-assigned priorities and goals

## Quick Start

### Running the System

1. Start the game normally
2. Pawns will automatically:
   - Ponder problems they encounter
   - Observe nearby crafting
   - Track materials they gather
   - Build specializations over time

### Testing the System

Load the test suite in browser console:
```javascript
// Load test_invention_system.js, then:
InventionTests.runAll()
```

Or use existing test helpers from test_goals.js:
```javascript
goalTests.testInventionSystem()
goalTests.boostInventionSkills(pawn)
goalTests.forcePonderingCycle(pawn)
goalTests.simulateInventoryProblem(pawn)
```

## User Intervention

### 1. Adjust Goal Priorities

Make certain needs more or less urgent:

```javascript
const pawn = Array.from(world.entitiesMap.values())
    .find(e => e.subtype === 'pawn')

// Make hunger 50% more urgent, social 50% less urgent
pawn.setGoalPriorities({ 
    hunger: 1.5,   // 150% of normal
    social: 0.5    // 50% of normal
})

// Reset to defaults
pawn.setGoalPriorities({})
```

Available needs:
- `hunger`, `thirst`, `energy`, `safety`
- `social`, `purpose`, `comfort`, `knowledge`

Range: 0.1x to 3.0x (10% to 300% of normal urgency)

### 2. Assign Arbitrary Goals

Directly command a pawn to do something:

```javascript
pawn.assignArbitraryGoal({
    type: 'craft_item',
    description: 'Craft a basket',
    targetType: 'activity',
    action: 'craft'
})

pawn.assignArbitraryGoal({
    type: 'explore',
    description: 'Scout the north area',
    targetType: 'location'
})

pawn.assignArbitraryGoal({
    type: 'teach_skill',
    description: 'Teach weaving to others',
    targetType: 'entity',
    targetSubtype: 'pawn',
    skill: 'weaving'
})
```

Common goal types:
- `craft_item`, `gather_materials`
- `explore`, `map_territory`
- `teach_skill`, `collaborative_craft`
- `socialize`, `establish_trade`

### 3. Set Resource Value Preferences

Influence which resources pawns prioritize:

```javascript
pawn.setResourceValuePreferences({
    fiber: 0.9,    // Highly valued (90%)
    rock: 0.3,     // Less valued (30%)
    stick: 0.7,    // Moderately valued (70%)
    herb: 0.8      // Quite valued (80%)
})
```

Range: 0.0 to 1.0 (0% to 100% value)

Affects:
- Gathering priorities
- Inventory management decisions
- Material substitution choices

### 4. Adjust Invention Rate

Speed up or slow down discovery:

```javascript
// Speed up discoveries (2x faster)
pawn.adjustInventionRate(2.0)

// Slow down discoveries (half speed)
pawn.adjustInventionRate(0.5)

// Reset to normal
pawn.adjustInventionRate(1.0)
```

Range: 0.1x to 5.0x (10% to 500% of normal rate)

Use cases:
- Speed up for testing
- Slow down for challenge
- Adjust for gameplay balance

## Configuration

All balancing parameters are in `InventionConfig.js`:

```javascript
import INVENTION_CONFIG from './InventionConfig.js'

// Disable skill decay for testing
INVENTION_CONFIG.enableSkillDecay = false

// Adjust discovery rates
INVENTION_CONFIG.baseInventionChance = 0.02  // 2% per level
INVENTION_CONFIG.maxAttemptBonus = 0.20      // 20% max

// Adjust quality system
INVENTION_CONFIG.maxSynergyBonus = 0.40      // 40% max synergy

// Adjust observation range
INVENTION_CONFIG.observationRange = 150      // 150 units
```

Key config sections:
- **Discovery rates**: Base chances and bonuses
- **Quality system**: Skill bonuses, variance, durability
- **Social learning**: Observation range, inspiration
- **Material groups**: Substitution categories
- **Skill synergies**: Domain relationships
- **User intervention**: Min/max ranges

## Monitoring Pawns

### Check Status

```javascript
const pawn = Array.from(world.entitiesMap.values())
    .find(e => e.subtype === 'pawn')

// Basic status
pawn.getStatus()

// Invention system status
console.log('Discovered solutions:', Array.from(pawn.discoveredSolutions))
console.log('Pondering queue:', pawn.ponderingQueue.length)
console.log('Success counts:', pawn.solutionSuccessCount)
console.log('Observed crafts:', Array.from(pawn.observedCrafts))
console.log('Known materials:', Array.from(pawn.knownMaterials))

// Skills
console.log('Invention:', pawn.skills.invention)
console.log('Experimentation:', pawn.skills.experimentation)

// Crafting history
console.log('Recent crafts:', pawn.craftingHistory.slice(-5))
```

### Watch Progress

```javascript
// Auto-update status every 5 seconds
const stopWatch = goalTests.autoWatch(pawn)

// Stop watching
stopWatch()

// Or manual updates
goalTests.watchPawnProgress(pawn)
```

## Common Scenarios

### Scenario 1: Encourage Specialization

```javascript
// Boost initial skills
pawn.skills.weaving = 10
pawn.skills.basketry = 5

// Favor textile materials
pawn.setResourceValuePreferences({
    fiber: 0.9,
    reed: 0.8,
    grass: 0.7
})

// Prioritize crafting work
pawn.setGoalPriorities({
    purpose: 1.5,
    knowledge: 1.3
})
```

### Scenario 2: Rapid Innovation

```javascript
// Boost invention skills
pawn.skills.invention = 20
pawn.skills.experimentation = 15

// Speed up discoveries
pawn.adjustInventionRate(3.0)

// Prioritize learning
pawn.setGoalPriorities({
    knowledge: 2.0,
    purpose: 1.5
})
```

### Scenario 3: Social Learning Focus

```javascript
// Boost social skills
pawn.skills.storytelling = 15
pawn.skills.cooperation = 10

// Prioritize social activities
pawn.setGoalPriorities({
    social: 2.0,
    purpose: 1.3
})

// Assign teaching goals
pawn.assignArbitraryGoal({
    type: 'teach_skill',
    description: 'Teach your expertise',
    targetType: 'entity'
})
```

### Scenario 4: Resource Accumulation

```javascript
// Value rare materials
pawn.setResourceValuePreferences({
    obsidian: 0.95,
    gold: 0.9,
    linen: 0.85
})

// Prioritize high-quality crafting
pawn.assignArbitraryGoal({
    type: 'accumulate_valuables',
    description: 'Craft masterworks',
    targetType: 'activity'
})
```

## Tips

1. **Natural Emergence**: Let pawns run autonomously for 1000+ ticks to see specializations emerge
2. **Gentle Intervention**: Use priority multipliers of 1.2-1.5 for subtle guidance
3. **Material Exposure**: Ensure pawns gather diverse materials to enable lateral learning
4. **Social Proximity**: Place pawns near each other (< 100 units) for observation learning
5. **Skill Synergies**: Related skills boost each other - encourage exploration
6. **Success Reinforcement**: Pawns naturally pursue successful paths - trust the system
7. **Quality Variance**: Higher skills = more consistent quality, not just better average
8. **Durability Matters**: Quality > 1.2 items last longer and stay effective when worn

## Troubleshooting

### Pawns not discovering solutions
- Check `pawn.skills.invention` and `.experimentation` levels
- Use `pawn.adjustInventionRate(2.0)` to speed up
- Ensure pawns have problems to solve (full inventory, etc.)
- Check pondering queue: `pawn.ponderingQueue`

### Pawns not observing crafts
- Verify pawns are within 100 units of each other
- Check `pawn.observedCrafts.size` is increasing
- Ensure `pawn.chunkManager` is set

### Materials not being tracked
- Verify `pawn.trackMaterialEncounter()` is called
- Check `pawn.knownMaterials.size`
- Ensure items have valid `type` property

### Skills not synergizing
- Verify related skills exist in `pawn.getSkillSynergies()`
- Check synergy bonus: `pawn.calculateSynergyBonus('weaving')`
- Ensure primary skill is defined in synergy table

## Advanced Usage

### Custom Material Groups

Edit `InventionConfig.js`:

```javascript
INVENTION_CONFIG.materialGroups.magical = [
    'mana_crystal', 'ether', 'moonstone'
]
```

### Custom Skill Synergies

```javascript
const customSynergies = pawn.getSkillSynergies()
customSynergies.mysticism = ['alchemy', 'herbalism', 'wisdom']
```

### Dynamic Goal Assignment

```javascript
// Assign goals based on conditions
if (pawn.inventory.length < 2) {
    pawn.assignArbitraryGoal({
        type: 'gather_materials',
        description: 'Stock up on resources'
    })
} else if (pawn.skills.weaving > 10) {
    pawn.assignArbitraryGoal({
        type: 'teach_skill',
        description: 'Share your weaving knowledge',
        skill: 'weaving'
    })
}
```

## Further Reading

- `INVENTION_SYSTEM.md` - Full design document
- `test_goals.js` - Console testing functions
- `test_invention_system.js` - Comprehensive test suite
- `InventionConfig.js` - Configuration reference
