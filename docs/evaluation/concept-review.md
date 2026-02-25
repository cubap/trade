# Simulation Engine Concept Review

## Overview

Trade is a persistent-world simulation engine built around autonomous pawn agents. Its distinguishing feature is indirect player control: the player sets priorities and goals while agents plan, specialize, and develop emergent social structures entirely on their own. The core design pillars — Tribe, Town, and Traders — map cleanly to three economic archetypes whose interdependencies create natural gameplay tension without requiring micromanagement.

This review assesses the current codebase and design documents for points of drudgery, performance chokepoints, design inconsistencies, potential IP overlap, and opportunities for creative expansion.

---

## Strengths

### 1. The Tribe/Town/Traders Triad

The three-pillar framing is genuinely distinctive. Each group has concrete mechanical roles (security/gathering, production/governance, logistics/arbitrage) and real interdependencies. Tribe can't scale without town workshops; town can't distribute without traders; traders can't source without tribes. This creates supply-chain pressure that naturally specializes agents without explicit instruction.

### 2. Behavior-Driven Occupation

Removing class selection in favor of behavior-history specialization is the right design. When a pawn's occupation emerges from what it repeatedly does and succeeds at, progression feels earned rather than arbitrary. The invention system, skill synergies, and resource domain specialization already support this.

### 3. Configurable Balance via InventionConfig

Centralizing tunable constants in one file (`InventionConfig.js`) is good engineering practice. It means system designers can adjust feel without touching behavioral code. The documented timing targets (7-day adulthood, 20-day specialization) give the balancing work a concrete target.

### 4. Memory-Informed Planning

The hierarchical goal planner that consults resource memory before exploring is the right approach for autonomous agents. Route planning that weights remembered success/failure rates over proximity creates genuinely smart-feeling behavior. The clustering and social memory sharing phases are the right direction.

### 5. Chunk-Based Spatial Lookups

Using a chunk manager for spatial queries is the correct architectural choice for a 2000×2000 world with hundreds of entities. The foundation is sound.

---

## Points of Drudgery

### 1. Needs Are Mechanical, Not Playful

Eight needs (hunger, thirst, energy, safety, social, purpose, comfort, knowledge) all accumulate at flat rates and are satisfied by simple proximity actions. There is no variety in *how* they are satisfied. Finding food means walking to `forage_food` and consuming. Every time. This becomes a treadmill after a short while, especially because the rates cause full saturation quickly. Good solutions:

- **Seasonal and biome variation**: some foods only available in spring, water sources freeze in winter, rest quality depends on shelter tier.
- **Social satisfaction through interesting interactions**: barter events, storytelling, disputes — not just proximity.
- **Purpose and knowledge needs driving discovery**: a pawn's "purpose need" should create pressure toward invention attempts, exploration patterns, or apprenticeship seeking — not just be a number that increments.

### 2. Inventory Is Underexplored

Two inventory slots that expand only by having a container item is a good constraint, but there is no gameplay around it yet. Weight and size are tracked (`inventoryWeight`, `maxWeight`, `maxSize`) but not used to create interesting tension. A pawn that can only carry two things should face real tradeoffs during multi-material crafting runs. Currently the GoalPlanner generates gather subgoals without checking whether the pawn can carry everything for a full recipe in one trip.

### 3. Goal Queue Rebuilds Too Frequently

`evaluateAndSetGoals()` clears and rebuilds the entire goal queue on every evaluation, which includes re-checking deferred goals randomly at 10% each pass. This means a pawn working on a long gathering run can have its goal queue completely replaced if a higher-priority need spikes mid-journey. The result is pawn jitter — a pawn drops its stick-gathering trip to drink, returns to gather, drinks again. This is not drudgery for the player to *watch* so much as it makes the simulation feel jittery and reduces emergent storytelling.

### 4. No Consequence Loop

Currently there is no failure state at the single-pawn level that creates interesting recovery decisions. If a pawn's health drops, it gets a `healthEvent`, but there is no economic or social consequence — no other pawns react, no memory of the near-death event, no occupational shift. Death should scatter resources and transfer partial memory to witnesses; near-death should trigger social bonds from helpers.

---

## Performance Chokepoints

### 1. Every Entity Updated Every Tick

`World.update()` and `World.fastForwardTicks()` iterate `entitiesMap` completely for every tick with no sleeping or inactive-entity optimization. A world with 500 plants, 200 animals, and 50 pawns runs 750 entity updates per tick regardless of how many of those entities are dormant. Plants especially — a rock or fiber plant does not need to update while no entity is nearby and it is not growing. Consider:

- **Activity radius check**: only update an entity if a pawn is within its perception or production radius.
- **Tick stride for immobile entities**: rocks update every 30 ticks (for regrowth), not every tick.
- **Sleep flag early-out**: if `entity.isAsleep && !entity.shouldWakeCheck(tick)`, skip the full `update()` call.

### 2. Console Logging in the Hot Path

```js
if (this.clock.currentTick % 20 === 0) {
    console.log(`Tick: ${this.clock.currentTick}, Entities: ${this.entitiesMap.size}`)
}
```

`console.log` on every 20th tick is fine during development but at 2 ticks/second this fires every 10 seconds — acceptable. However, in fast-forward mode (`fastForwardTicks`) this path is called in a tight loop with no throttle. At 200-batch pre-simulation, this will log thousands of times. The fast-forward path already skips logging, but the comment suggests this was added for debugging and is not behind a debug flag.

### 3. Linear Scans in Memory Recall

`recallResourcesByType()` and related functions walk the full `resourceMemory` array on every lookup. With `maxResourceMemory = 20` this is negligible now, but the roadmap plans to grow this significantly. A small typed-object Map keyed by resource type would make lookups O(1) at the cost of slightly more complex insert logic.

### 4. `getAvailableRecipes()` Checks `pawn.unlocked?.recipes?.has()`

The unlock check requires `pawn.unlocked.recipes` to be a `Set`, but the `Pawn` constructor does not initialize `this.unlocked`. The test mode in `app.js` compensates by setting `player.unlocked = { recipes: new Set() }` on demand, but any cold-start recipe availability check will silently return zero available recipes without error. This is a latent bug that grows more impactful as the recipe list expands.

---

## Design Errors and Inconsistencies

### 1. `timeTick()` Is Never Called from World

`Pawn.timeTick(gameTime)` updates `this.gameTime`, which is read by `isDaytime()`, `updateNeedsDecay()`, `checkSleepDeprivation()`, and `applyRegularHoursBonus()`. However, `World.update()` only calls `entity.update(currentTick)` — it never calls `timeTick()`. As a result, `this.gameTime` is always zero: `isDaytime()` always returns the same value and the pawn's day/night behavior never engages. The world clock already tracks game seconds via `getGameSeconds()`; it just needs to pass that value into entities.

### 2. `GameClock.resume()` Sets `isPaused = true` Before Toggling Off

```js
resume() {
    this.isPaused = true  // ← bug: should not be here
    this.lastTimestamp = performance.now()
    this.accumulatedTime = 0
    this.isPaused = false
}
```

The extra `this.isPaused = true` line is harmless if `resume()` is only ever called when paused, but if called on an already-running clock it will briefly pause it. The intent is clearly to reset timing state; the extra line should be removed.

### 3. InventionConfig Tick-Count Comments Are Off by 10×

The comments inside `InventionConfig.js` say:

> Assuming ~10 ticks/second (36,000 ticks/hour, 864,000 ticks/day):
> - 7 days = 6,048,000 ticks

But `earlyCraftingTicks: 604800` is labeled `~7 days`. At 10 ticks/second, 604,800 ticks is only 0.7 real days, not 7. One of these is wrong (either the comment or the constant). The world's actual tick rate of 2 ticks/second compounds this: at 2 ticks/s, 604,800 ticks = 3.5 real days. The timing targets deserve a single authoritative constant (ticks per game day) derived from the clock so that balancing numbers are not computed freehand.

### 4. Skill Scale Ambiguity

The trees use unlock thresholds of 2–5, InventionConfig uses `specialistThreshold: 40` and `masterThreshold: 80`. The alignment document notes this discrepancy and recommends a dual-scale (0–10 unlock tiers, 0–100 mastery levels). This resolution has not been implemented yet; `getSkill()` returns a single number used for both purposes. Until this is resolved, skill-gated recipe unlocks (`requiredSkills: { knapping: 2 }`) and progression milestones like `specialistThreshold: 40` are measuring different scales and cannot both be correct.

### 5. `decomposeGoal()` Imports Recipes Synchronously

The function `getRecipeSync` inside `GoalPlanner.js` is called but defined locally as a synchronous wrapper. If the recipe list ever becomes async (loaded from a server or split-bundle), this will silently fail. This is acceptable now but worth flagging for when multiplayer persistence is added.

---

## IP and Reference Concerns

### One Hour One Life

The design is explicitly influenced by OHOL. The key differentiator is that Trade is observation-only rather than first-person embodied — the player watches and nudges rather than playing as a specific pawn. This is a meaningful distinction. The risk is that without player embodiment, the social drama that makes OHOL compelling (gratitude toward parents, responsibility toward children, fear of griefers) may be harder to generate. Trade needs its own emotional hook for the observer position.

**Suggestion**: the player as a *patron god* or *merchant lord* who gains currency/influence from watching their pawns thrive, and can spend it to "intervene" (drop a resource cache, send a message, attract a wandering specialist) without controlling anyone directly.

### Dwarf Fortress / RimWorld

The autonomous agent colony manager with needs, skills, and emergent events is the core of DF and RimWorld. Trade's distinguishing factors are: no catastrophic failure state, a trade-network focus rather than military defense, and a progression model rooted in material/social history rather than random events. Lean into the trade network as the primary gameplay loop.

**Suggestion**: make price and availability visible as a flowing map overlay — players watching supply chains tighten and loosen get the same dopamine hit DF players get from crisis management, but without the death spiral.

### Vintage Story / Minecraft

The tech-bracket progression (stone → copper → iron → workshops) is similar. Trade's path is more socially gated than recipe-gated, which is a genuine differentiator. Make sure the social prerequisites for tech progression are visible in the UI so players understand why certain recipes haven't appeared yet.

---

## Creative Prompts for Implementation

The following are concrete implementation ideas generated from this review. Each is designed to be a self-contained feature that adds playability with minimal surface area.

---

### Prompt 1: Day/Night Behavioral Modulation

**Problem addressed**: `timeTick()` is defined but never called; day/night cycle is dead code.

**Feature**: Wire the world clock into entities so that:
- Predator animals become more active at night (higher move speed, wider perception radius)
- Pawns develop a `sleepNeed` that peaks at night and is satisfied by resting in shelter
- Forager animals only graze during daylight hours
- Visual: the renderer shifts canvas color temperature (warm amber at dusk, cool blue at night)

**Scope**: Small — fix the call site in World, add a `getDayPhase()` method to GameClock returning `dawn / day / dusk / night`, use it in one or two entity behaviors.

---

### Prompt 2: Seasonal Resource Cycles

**Problem addressed**: Needs feel like a treadmill; world feels static.

**Feature**: Introduce four seasons (spring, summer, autumn, winter), each spanning ~90 game days. Resource behaviors change:
- Plants grow faster in spring, produce seed in autumn, go dormant in winter
- Water sources can flood in spring or dry in summer
- Animals migrate or hibernate
- Fiber plants only produce harvestable fiber in late spring through summer

**Scope**: Medium — add a `getSeason()` method to GameClock, add season-awareness to `Flora.js` and `FiberPlant.js` growth rates, update `ResourceGenerator` spawn weights by season.

---

### Prompt 3: Pawn Death and Memory Inheritance

**Problem addressed**: No consequence loop; no emotional engagement with individual pawns.

**Feature**: When a pawn's health reaches zero:
1. Its inventory scatters as droppable resources nearby
2. Nearby pawns gain a share of the deceased's `resourceMemory` (filtered by confidence > 0.5)
3. A `deathEvent` is logged with cause of death and any social bonds present at time of death
4. Pawns with high social bonds to the deceased apply a temporary grief modifier to `purpose` need

**Scope**: Medium — adds a `die()` method, memory transfer logic, and a small grief modifier to PawnNeeds.

---

### Prompt 4: Economic Visibility Overlay

**Problem addressed**: The trade network is the core hook but it is invisible to the player.

**Feature**: A toggleable overlay mode on the canvas renderer that draws:
- Arrows between entities showing recent resource transfers (thickness = volume)
- Color-coded supply pressure: red = scarcity, green = surplus, grey = inactive
- Rolling price average annotations over shop/market entities

**Scope**: Medium — canvas overlay pass in the renderer, no simulation changes required.

---

### Prompt 5: Pawn Story Seeds

**Problem addressed**: Observer gameplay needs emotional engagement; pawns need to feel like individuals.

**Feature**: When a pawn achieves a significant milestone, generate a short natural-language "story seed":
- "Alder discovered that twisted grass makes strong rope after watching a spider build its web."
- "Brook carried food to a sick pawn twice, earning trust within the group."
- "Flint's stone knife lasted three seasons before it finally broke."

Store the last N story seeds per pawn. Display them in the entity summary panel. Use milestone events already tracked by the invention system (discovery events, craft history, health events, social bonds) as source material.

**Scope**: Small-to-medium — a `StoryGenerator.js` module that maps event types to sentence templates. No simulation changes, only observation and presentation.

---

### Prompt 6: Demand Signal Broadcasting

**Problem addressed**: Occupation specialization is driven by individual behavior history but not by external market signals; traders and towns have no way to pull talent toward needed skills.

**Feature**: Settlement and shop entities can emit periodic `demandSignal` objects into their local area:
```js
{ type: 'demand', resource: 'cordage', quantity: 10, rewardEstimate: 2.5, origin: shopId }
```
Nearby pawns with the relevant skill observe demand signals and get a goal-priority boost toward producing that resource. Traders pick up demand signals from one settlement to carry as market intelligence to another.

**Scope**: Medium — add a broadcast method to ImmobileEntity, add demand signal scanning to PawnGoals long-term goal generation.

---

### Prompt 7: Inventory Trip Planning

**Problem addressed**: GoalPlanner creates gather subgoals without checking inventory capacity; pawns attempt impossible multi-material crafting runs.

**Feature**: Before generating a full set of gather subgoals for a recipe, check available inventory space. If the pawn cannot carry all required materials in one trip, split the subgoals into trips: gather what fits, return to a drop cache, gather the rest. The drop cache (a new entity type or a flag on the ground) persists until the pawn returns.

**Scope**: Medium — modify `decomposeGoal()` in GoalPlanner to check `pawn.inventorySlots` and `pawn.inventoryWeight`, add a `DropCache` resource entity.

---

### Prompt 8: Weather Events

**Problem addressed**: The world has no source of non-pawn drama; everything proceeds at a steady rate.

**Feature**: A lightweight weather system: periodic random events (rain shower, drought, cold snap, windstorm) that last for a defined duration and affect:
- Rain: increases water source levels, slows pawn movement slightly
- Drought: reduces water sources, stresses plants
- Cold snap: increases food/energy need rates, increases value of shelter and fire
- Windstorm: knocks down loose structures, scatters light resources

**Scope**: Medium — a `WeatherSystem.js` singleton that `World` holds; it ticks alongside entities and applies multipliers to need rates and resource production. No AI changes required; needs system already supports rate modification.

---

## Summary Recommendations

| Priority | Issue | Action |
|----------|-------|--------|
| High | `timeTick()` never wired | Call from `World.update()` using `clock.getGameSeconds()` |
| High | `GameClock.resume()` bug | Remove spurious `this.isPaused = true` line |
| High | `pawn.unlocked` not initialized | Initialize in `Pawn` constructor |
| Medium | InventionConfig tick constants inconsistent | Derive from a single `TICKS_PER_GAME_DAY` constant |
| Medium | Skill dual-scale not implemented | Add `getSkillTier()` (0–10) separate from `getSkill()` (0–100) |
| Medium | All entities update every tick | Add stride/sleep optimization to `World.update()` |
| Low | Goal queue full-rebuild on every evaluation | Add dirty flag; only rebuild when needs change significantly |
| Low | Memory recall linear scan | Index `resourceMemory` by type for O(1) recall |
