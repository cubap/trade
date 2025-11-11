# Hierarchical Goal Planning System

## Overview
The hierarchical goal planning system allows pawns to decompose complex goals (like crafting items) into prerequisite subgoals based on recipe requirements, resource memory, and skill levels.

## Key Components

### 1. GoalPlanner.js
Located at `solo/js/models/entities/mobile/GoalPlanner.js`

**Functions:**
- `decomposeGoal(pawn, goal)`: Breaks craft goals into subgoals
  - Checks inventory for required materials
  - Uses resource memory to find known resource locations
  - Generates `gather_specific` subgoals for known resources
  - Generates `search_resource` subgoals for unknown resources
  - Generates `train_skill` subgoals for missing skills
  - Returns array of subgoals to execute before main goal

- `isGoalReachable(pawn, goal)`: Validates if goal is achievable
  - Checks if all required materials are available (inventory + memory)
  - Checks if pawn has necessary skills
  - Returns reachability status with reason codes:
    - `needsExploration`: Unknown resource types need to be discovered
    - `canResearch`: Goal blocked but could be researched/pondered
    - `needsTraining`: Missing required skills

- `injectRecipes(recipes)`: Synchronous recipe lookup (called at app startup)

### 2. PawnGoals.js Enhancements

**New Properties:**
- `deferredGoals`: Array of goals that are currently unreachable (e.g., missing resources, skills)

**Modified Methods:**
- `evaluateAndSetGoals()`: Now re-evaluates deferred goals periodically (10% chance per tick)
- `planAndStartGoal(goal)`: New method that replaces direct `startGoal()` calls
  - Checks goal reachability via `isGoalReachable()`
  - If reachable: Decomposes goal into subgoals and injects them at front of queue
  - If unreachable: Defers goal or triggers exploration for unknown resources
- `startGoal(goal)`: Enhanced to use `targetLocation` from resource memory

**New Goal Types:**
- `gather_specific`: Navigate to known resource location and gather specific type/quantity
  - Properties: `targetResourceType`, `targetLocation`, `count`, `gatheredCount`
  - Behavior: Navigate to remembered location → scan for resource → gather → repeat until count met
  - Falls back to `search_resource` if location doesn't have resource anymore

- `search_resource`: Explore until specific resource type is discovered
  - Properties: `targetResourceType`
  - Behavior: Explore randomly → scan for resource → remember location when found → switch to `gather_specific`

- `gather_materials`: General gathering (already existed, now with better handling)
  - Seeks any harvestable resources nearby
  - Completes when inventory reaches 10 items

### 3. Pawn.js Resource Memory

**New Properties:**
- `resourceMemory`: Array storing observed resource locations with age tracking
- `maxResourceMemory`: 100 (max remembered locations)

**New Methods:**
- `rememberResource(entity)`: Records resource location with timestamp
- `recallResourcesByType(type)`: Returns sorted array of remembered locations for resource type
- `recallResourcesByTag(tag)`: Returns sorted array for resources with specific tag
- `observeNearbyResources(radius=50)`: Scans area and remembers all resources (called during exploration)

## Goal Decomposition Flow

### Example: Crafting Cordage
1. Pawn sets long-term goal: `craft_cordage`
2. `planAndStartGoal()` called
3. `isGoalReachable()` checks requirements:
   - Recipe requires: 3x fiber_plant
   - Pawn inventory: 0x fiber_plant
   - Resource memory: Has 2 known fiber_plant locations
   - Result: `needsExploration` (not enough known sources)
4. `decomposeGoal()` generates subgoals:
   - `gather_specific` for first known fiber_plant location (count: 2)
   - `search_resource` for fiber_plant (count: 1)
5. Subgoals injected at front of queue:
   ```
   Queue: [gather_specific, search_resource, craft_cordage, ...other goals]
   ```
6. Pawn executes:
   - Navigates to first remembered location
   - Gathers 2 fiber_plants
   - Explores to find more fiber_plants
   - Gathers remaining fiber_plant
   - Crafts cordage using recipe
   - Gains weaving skill, evaluates unlocks

### Example: Unreachable Goal
1. Pawn sets goal: `craft_stone_knife`
2. `isGoalReachable()` checks:
   - Recipe requires: sharp_stone (which requires cordage)
   - Pawn has: nothing
   - Result: `needsTraining` or `needsExploration` depending on context
3. `planAndStartGoal()` defers goal:
   - Adds to `deferredGoals` array
   - May trigger exploration if `needsExploration`
4. Re-evaluation:
   - Every tick, 10% chance to re-check deferred goals
   - When cordage is crafted, `isGoalReachable()` returns true
   - Goal moves back to active queue

## Integration Points

### Startup (app.js)
```javascript
import { RECIPES } from './models/crafting/Recipes.js'
import { injectRecipes } from './models/entities/mobile/GoalPlanner.js'

injectRecipes(RECIPES) // Make recipes available to planner
```

### Resource Seeding (app.js)
```javascript
async function seedCraftingResources() {
  // Spawns 30-40 rocks, 40-60 sticks, 20-30 fiber plants
  // Distributed across accessible chunks
}
```

### Goal Priority
Long-term goals now include:
- `gather_materials` (priority based on inventory level)
- Crafting goals (decompose into subgoals)
- Social/exploration goals

Idle planner triggers gathering when inventory < 5.

## Testing the System

### Manual Testing
1. Run `npm run serve` to start server
2. Open `http://localhost:5000` in browser
3. Watch pawn behavior:
   - Should explore and observe resources (yellow console logs)
   - Should gather materials when idle or inventory low
   - Should attempt crafting when materials available

### Testing Decomposition
Add to console:
```javascript
// Find pawn
const pawn = Array.from(world.entitiesMap.values()).find(e => e.subtype === 'pawn')

// Manually inject craft goal
pawn.goals.goalQueue.push({
  type: 'craft_cordage',
  priority: 10,
  description: 'Test craft cordage'
})
```

Watch console for:
- Reachability check messages
- Subgoal generation
- Gathering behaviors
- Crafting completion

## Future Enhancements

### Pondering/Research
When `canResearch` is true:
- Inject `ponder` or `study` goal
- Increase planning skill
- May unlock new recipes or reveal prerequisites

### Tool Usage
Crafted items should provide bonuses:
- `sharp_stone`: +50% gathering speed for fiber/sticks
- `stone_knife`: +100% gathering, +20% damage
- Track tool degradation

### UI Panel
Show available recipes with:
- Required materials (have/need counts)
- Skill requirements vs current levels
- Manual craft button
- Progress bars for active crafts

### Smarter Memory
- Forget resources that are depleted
- Update memory when resources are gathered
- Share resource knowledge between pawns
- Memory decay based on distance/time

## Architecture Benefits

1. **Emergent Behavior**: Pawns naturally explore → remember → plan → gather → craft
2. **Scalable**: Easy to add new recipes, resources, goal types
3. **Debugging**: Clear decomposition makes behavior traceable
4. **Reusable**: Goal planning logic works for any recipe-based system (buildings, tools, food, etc.)
5. **Extensible**: Can add goal types for trade, teaching, collaboration without changing core planner
