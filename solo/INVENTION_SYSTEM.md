# Invention & Pondering System

## Overview
Pawns can now discover solutions to problems they encounter through an emergent pondering system. When a pawn faces an obstacle (like full inventory or needing a water container), they add it to their pondering queue and gradually work towards discovering a solution.

## Skills
- **Invention** (0-100): Primary skill for discovering new solutions. Higher values increase discovery chance.
- **Experimentation** (0-100): Secondary skill that provides bonus discovery chance.

## How It Works

### 1. Problem Detection
Pawns automatically detect problems when:
- **Inventory Full**: Trying to pick up items when both hand slots are occupied
- **Water Container Needed**: Attempting to carry water without a container
- **Better Tools Needed**: (Future) Gathering with primitive tools
- **Shelter Needed**: (Future) Exposed to harsh conditions

### 2. Pondering Queue
Problems are added to `pawn.ponderingQueue`:
```javascript
{
  type: 'inventory_full',
  context: { item: 'fiber_plant' },
  timestamp: Date.now(),
  attempts: 0
}
```

### 3. Processing
The pondering queue is processed:
- Every 50 ticks normally
- Every 20 ticks when pawn is idle
- Discovery chance = (invention × 1%) + (experimentation × 0.5%) + (attempts × 1%)
- Maximum 20 attempts before giving up temporarily

### 4. Discovery
When a solution is discovered:
- Solution is logged to console with 💡 icon
- Added to `pawn.discoveredSolutions` Set
- Experience granted: 10-30 XP for invention, 5-25 XP for experimentation
- Cooldown of 100 ticks before processing next problem

## Solutions & Requirements

| Problem Type | Solution | Requirements | Unlocks |
|-------------|----------|--------------|---------|
| `inventory_full` | Basket Weaving | gathering ≥ 5 | `basket` recipe |
| `need_water_container` | Container Crafting | gathering ≥ 5, invention ≥ 3 | `water_basket` recipe |
| `need_better_tools` | Stone Tool Making | crafting ≥ 10 | `stone_axe` recipe |
| `need_shelter` | Basic Shelter | crafting ≥ 5, invention ≥ 5 | `lean_to` recipe |

## Testing

Use the console commands in `test_goals.js`:

```javascript
// Check invention system status
goalTests.testInventionSystem()

// Boost skills for faster discovery
goalTests.boostInventionSkills(pawn)

// Force multiple pondering attempts
goalTests.forcePonderingCycle(pawn)

// Full simulation: problem → pondering → discovery
goalTests.simulateInventoryProblem(pawn)
```

## Integration with Crafting

Discovered solutions unlock recipes in the crafting system:
- Check if pawn has solution: `pawn.hasSolution('basket_concept')`
- Solutions are persistent once discovered
- Can be used to gate recipe availability in UI


## Implementation Status

✅ **IMPLEMENTED**: The autonomous invention system is now fully functional with the following features:

### User Intervention Points

Users can control pawn behavior through:

1. **Priority Adjustments**: `pawn.setGoalPriorities({ hunger: 1.5, social: 0.5 })`
   - Adjust relative importance of needs (0.1x to 3.0x)
   - Pawns will prioritize or deprioritize needs accordingly

2. **Arbitrary Goal Assignment**: `pawn.assignArbitraryGoal({ type: 'craft_item', description: '...' })`
   - Directly assign goals to pawns
   - High priority, executed immediately if pawn is idle

3. **Resource Value Preferences**: `pawn.setResourceValuePreferences({ fiber: 0.9, rock: 0.5 })`
   - Adjust perceived value of resources (0.0 to 1.0)
   - Influences gathering and trading decisions

4. **Invention Rate**: `pawn.adjustInventionRate(2.0)`
   - Speed up (2.0) or slow down (0.5) discoveries
   - Range: 0.1x to 5.0x normal rate

### Configuration File

All balancing parameters are centralized in `InventionConfig.js`:
- Discovery rates and bonuses
- Quality and durability thresholds  
- Skill synergies and material groups
- User intervention ranges
- Enable/disable skill decay

## Next-Generation Invention System: Design Sketch

### 1. Quality, Durability, and Effectiveness ✅ IMPLEMENTED
- **Quality** is not a separate stat, but determines where an item starts on its degradation curve.
- Poor quality (< 0.8) = starts partly degraded (0.6-0.9 durability), wears out faster, less effective.
- Excellent quality (> 1.2) = starts above max durability (1.0-1.5), provides bonuses
- Quality is calculated from: base quality + skill bonus + synergy bonus + variance
- Skill bonus: 1% per skill level
- Synergy bonus: up to 30% from related skills (e.g., weaving helps basketry)
- Variance: ±15-30% (less variance with higher skill)
- Items track `currentDurability` / `maxDurability` 
- Effectiveness: `currentDurability / maxDurability` (min 30%)
- Quality > 1.2 items provide bonus effectiveness even when worn

### 2. Lateral Learning & Material Substitution ✅ IMPLEMENTED
- Pawns track `observedCrafts` (Set of items seen) and `knownMaterials` (Set of materials)
- Materials auto-tracked when gathered, examined, or used in crafting
- Material groups: fibers, stones, woods, hides, metals, herbs
- If a pawn knows a recipe and encounters a material from the same group, 10% chance to ponder substitution
- Example: knows reed_basket, finds linen (both in fibers group) → may discover linen_basket
- Observed crafts give 15% discovery bonus when pondering that craft
- Lateral learning bonus: 10% if pawn knows the material type

### 3. Social Learning & Inspiration ✅ IMPLEMENTED
- Pawns observe crafts within 100 unit range automatically
- When crafting completes, nearby pawns add item to `observedCrafts`
- Observed crafts trigger pondering with easier discovery (15% bonus)
- Small skill gain from observation (0.1 in relevant skill)
- Story system: `pawn.hearStory(story)` can inspire inventions
- Inspiration chance: (invention + storytelling) * 0.5%
- Inspired inventions unlock legendary/special recipes
- Teaches or demonstrates items to others through proximity

### 4. Skill Synergies & Cross-Domain Transfer ✅ IMPLEMENTED
- 12+ skill synergy relationships defined in `getSkillSynergies()`
- Key domains: textiles, stonework, medicine, construction, hunting, survival
- Example synergies:
  - `weaving → basketry, textile_work, rope_craft, gathering`
  - `knapping → stonework, tool_making, mining`
  - `herbalism → gathering, alchemy, medicine, foraging`
  - `hunting → tracking, archery, spear_fighting, butchery`
- Synergy bonus in crafting: 0.5% quality per related skill level (max 30%)
- Cross-domain transfer makes learning related skills easier
- Natural specialization emerges through synergy chains

### 5. Preference for Successful Paths ✅ IMPLEMENTED
- `solutionSuccessCount` tracks successful uses of each discovered solution
- Success count increments when crafting with discovered recipes
- Related solutions boost discovery: 2% per success (max 20%)
- Example domains:
  - `inventory_full` related to: basket_concept, container_concept, storage_concept
  - `need_better_tools` related to: stone_tool_concept, advanced_tool_concept
- Success tracking creates natural specialization over time
- Pawns become experts in areas where they've succeeded
- Tech tree naturally branches based on individual success paths

### 6. Multiple Paths to Value ✅ PARTIALLY IMPLEMENTED
Multiple value paths implemented through new goal types:
- **Accumulate Valuables**: `accumulate_valuables` goal crafts high-quality items (quality > 1.2) for trade
- **Collaborative Projects**: `collaborative_craft` goal finds partner, works together 200 ticks, grants cooperation skill
- **Teaching & Learning**: `teach_skill` goal shares highest skill with others, both gain experience
- **Basic Needs**: Existing food/water/shelter goals continue to work
- **Social Paths**: Teaching, collaboration, and trade goals satisfy social needs
- **Material Paths**: Resource value preferences guide gathering priorities
- **Skill Mastery**: Success tracking creates specialization, synergies encourage skill exploration

### 7. Skill Decay (Optional) ✅ IMPLEMENTED
- Skill decay already implemented in `decaySkills()` method
- Runs every 200 ticks
- Skills decay by 0.1 if unused for 2000 ticks
- Configurable through `InventionConfig.js`:
  - `enableSkillDecay`: true/false toggle
  - `skillDecayRate`: 0.1 per period
  - `skillDecayFloor`: 0.5 (50% of peak minimum)
  - `skillDecayPeriod`: 200 ticks between checks
  - `skillDecayInactiveThreshold`: 2000 ticks before decay starts
- Can disable entirely for playtesting: `INVENTION_CONFIG.enableSkillDecay = false`

### 8. Example Flow: Lateral & Social Learning ✅ WORKING
1. Pawn A invents a reed basket and crafts it.
2. Pawn B sees the basket, adds 'reed_basket' to `observedCrafts`.
3. Pawn B finds linen, knows weaving, and ponders making a linen basket.
4. Pawn B invents 'linen_basket' with a lower difficulty due to prior knowledge.
5. Pawn C hears a story about a legendary backpack, ponders making one if they know basketry and tailoring.

### 9. Implementation Status ✅ COMPLETE
- ✅ Added `observedCrafts`, `knownMaterials`, `craftingHistory` to Pawn
- ✅ Implemented `observeCraftedItem()`, `hearStory()`, `trackMaterialEncounter()` methods
- ✅ Expanded `discoverSolution()` to support:
  - Material substitution discoveries
  - Inspired inventions from stories
  - Observed craft learning
  - Dynamic problem types
- ✅ Track `solutionSuccessCount` for each solution
- ✅ Success path bonuses: 2% per success, max 20%
- ✅ Added quality and durability to crafted items with degradation
- ✅ Created comprehensive synergy table with 12+ relationships
- ✅ Skill decay system with configurable parameters
- ✅ User intervention methods for priorities, goals, and resource values
- ✅ Centralized configuration in `InventionConfig.js`

## Example Flow

1. Pawn tries to gather 3rd item → inventory full
2. `ponderProblem('inventory_full', {...})` called
3. Added to pondering queue
4. Every 20-50 ticks: `processPonderingQueue()` checks for discovery
5. After N attempts with sufficient skills: Discovery!
6. Console shows: "💡 [PawnName] has an epiphany: Basket Weaving!"
7. `basket` recipe now available for crafting
8. Pawn can now craft basket to expand inventory

## Code Locations

- **Pawn.js**: 
  - Constructor: invention/experimentation skills, ponderingQueue, discoveredSolutions
  - Methods: `ponderProblem()`, `processPonderingQueue()`, `discoverSolution()`, `hasSolution()`
  - Update cycle: Calls `processPonderingQueue()` periodically
  - Triggers: `addItemToInventory()` detects problems

- **test_goals.js**: 
  - `testInventionSystem()`: Check status
  - `boostInventionSkills()`: Increase discovery chance
  - `forcePonderingCycle()`: Run multiple attempts
  - `simulateInventoryProblem()`: Full test scenario
