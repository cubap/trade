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


## Next-Generation Invention System: Design Sketch

### 1. Quality, Durability, and Effectiveness
- **Quality** is not a separate stat, but determines where an item starts on its degradation curve.
- Poor quality = starts partly degraded, wears out faster, less effective.
- Excellent quality = starts above max durability, provides bonuses (e.g. comfort, gather speed).
- Example:
  - `durability: 0.6` (poor, 40% degraded)
  - `durability: 1.2` (excellent, 20% above max, bonus effects)

### 2. Lateral Learning & Material Substitution
- Pawns track `observedCrafts` (items they've seen) and `knownMaterials` (materials encountered).
- If a pawn knows how to make a reed basket and sees a linen basket, and has found linen, they can easily invent a linen basket.
- Lateral steps are easier if the pawn has seen the result or the material.
- Observing others' crafts can inspire new solutions.

### 3. Social Learning & Inspiration
- Pawns can learn by observing others craft or use items.
- When a pawn sees a new item, it is added to `observedCrafts`.
- If the item is related to known solutions, the pawn may ponder how to replicate it.
- Hearing stories about heroes, events, or legendary items can inspire new inventions (e.g. better weapons after hearing a hero's tale).

### 4. Skill Synergies & Cross-Domain Transfer
- Skills are grouped into domains with synergies (e.g. weaving helps basketry, tailoring, rope-making).
- High skill in one domain makes related inventions easier to discover.
- Example synergy table:
  - `weaving: [basket_making, textile_work, rope_craft]`
  - `tailoring: [leather_work, armor_repair, tent_making]`
  - `hunting: [archery, spear_fighting, tracking]`

### 5. Preference for Successful Paths
- Pawns are more likely to pursue invention paths where they've had past success.
- Each solution tracks a `successCount` (uses, crafts, positive outcomes).
- Discovery chance is boosted for related problems if the pawn has succeeded in similar solutions.
- This creates natural specialization and tech tree branching.

### 6. Multiple Paths to Value
- Each invention path should allow pawns to:
  - Accumulate valuables (e.g. rare crafts, trade goods)
  - Group together (collaborative projects, shared tech)
  - Learn and grow (skill XP, new recipes)
  - Manage basic needs (food, shelter, safety)
- Paths can be social (teaching, group projects), material (rare resources), or skill-based (mastery, innovation).

### 7. Skill Decay (Optional)
- Skills can decay if unused, but never below a floor (e.g. 50% of peak).
- Some skills (intuition, memory) may be exempt.
- Decay is configurable and can be toggled for playtesting.

### 8. Example Flow: Lateral & Social Learning
1. Pawn A invents a reed basket and crafts it.
2. Pawn B sees the basket, adds 'reed_basket' to `observedCrafts`.
3. Pawn B finds linen, knows weaving, and ponders making a linen basket.
4. Pawn B invents 'linen_basket' with a lower difficulty due to prior knowledge.
5. Pawn C hears a story about a legendary backpack, ponders making one if they know basketry and tailoring.

### 9. Implementation Roadmap
- Add `observedCrafts` and `knownMaterials` to Pawn.
- Implement `observeCraftedItem()` and `hearStory()` methods.
- Expand `discoverSolution()` to support lateral and inspired discoveries.
- Track `successCount` for each solution and boost related discovery chances.
- Add durability/quality to crafted items.
- Create synergy table for cross-domain skill bonuses.
- (Optional) Add skill decay system.

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
