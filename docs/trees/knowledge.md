# Knowledge Tree

This tree covers how pawns discover, refine, and share knowledge — the meta-layer that drives all other trees. It encompasses the invention/pondering system, lateral learning, social learning, and cross-domain insight.

---

## Core Discovery Mechanisms

### Pondering ✅
> Holding a problem in mind and working toward a solution through idle reflection.

- **Triggered by (any):**
  - `inventory_full` event: pawn attempts to pick up item with full hands
  - `need_water_container` event: pawn attempts to carry water without a vessel
  - `need_better_tools` event: pawn gathers slowly with primitive tools
  - `need_shelter` event: pawn is exposed to harsh conditions
  - *Future:* any blocked goal type can trigger a pondering event
- **Discovery chance per cycle:**
  - `(invention × 1%) + (experimentation × 0.5%) + (attempts × 1%)`
  - Max 20 attempts before temporary give-up
  - Idle pawns process queue every 20 ticks; busy pawns every 50 ticks
- **On discovery:**
  - Solution added to `pawn.discoveredSolutions`
  - XP granted: 10–30 invention, 5–25 experimentation
  - Cooldown: 100 ticks before next problem is processed
- **Enables:**
  - `basket` recipe (from `inventory_full`)
  - `water_basket` recipe (from `need_water_container`)
  - `stone_axe` recipe (from `need_better_tools`)
  - `lean_to` recipe (from `need_shelter`)

---

### Lateral Learning ✅
> Applying knowledge of one material to a related material in the same group.

- **Triggered by:**
  - Pawn knows a recipe AND encounters a new material from the same [material group](materials.md#material-groups-for-lateral-discovery)
- **Discovery chance:** 10% per encounter when conditions are met
- **Bonus:** 15% if pawn has previously observed the craft (`observedCrafts` set)
- **Example:**
  - Pawn knows `reed_basket` → encounters linen (both `fibers` group) → may discover `linen_basket`
- **Enables:**
  - Material-substitution variants of existing recipes
  - Diversified crafting paths without rigid prerequisite chains

---

### Social Learning ✅
> Gaining insight by observing or hearing about another pawn's discoveries.

- **Triggered by:**
  - Pawn within 100 units when another pawn completes a craft
  - Pawn hears a story from a storyteller (`hearStory()`)
- **Effect:**
  - Observed item added to `pawn.observedCrafts`
  - Small skill gain: +0.1 in the relevant skill
  - Easier pondering: 15% discovery bonus for that craft type
- **Inspiration (via story):**
  - Chance = `(invention + storytelling) × 0.5%`
  - Inspired inventions can unlock legendary or special recipes
- **Enables:**
  - Accelerated diffusion of discoveries across a settlement
  - Cross-pawn specialisation without direct instruction

---

### Skill Synergies ✅
> Knowledge in one skill reducing difficulty and increasing quality in related skills.

- **How it works:**
  - Synergy bonus in crafting: `0.5% quality per related skill level` (max 30%)
  - Cross-domain transfer makes related skills easier to level
- **Key synergy chains:**
  | Primary Skill | Synergises With |
  |--------------|----------------|
  | `weaving` | basketry, textile_work, rope_craft, gathering |
  | `knapping` | stonework, tool_making, masonry |
  | `herbalism` | gathering, alchemy, medicine, foraging |
  | `hunting` | tracking, archery, spear_fighting, butchery |
  | `construction_basics` | carpentry, masonry, planning |
  | `planning` | cartography, leadership, governance |
  | `storytelling` | social_learning, inspiration, teaching |
  | `cooperation` | leadership, teaching, collaborative_craft |
- **Enables:**
  - Natural specialisation: pawns build depth in synergy chains they begin
  - Diverse emergence: different starting conditions lead to different expert types

---

### Preference for Successful Paths ✅
> Past success increases the chance of succeeding in related discoveries.

- **How it works:**
  - `solutionSuccessCount` tracks each time a discovered recipe is successfully crafted
  - Related solutions get `+2% discovery chance per success` (max +20%)
- **Example domains:**
  - `inventory_full` → related: `basket_concept`, `container_concept`, `storage_concept`
  - `need_better_tools` → related: `stone_tool_concept`, `advanced_tool_concept`
- **Enables:**
  - Natural specialisation: pawns who succeed in basketry find container improvements easier
  - Tech branching: different pawns develop along different paths even from the same starting point

---

## Advanced Discovery

### Observed Crafts ✅
> A set of item types the pawn has seen being crafted by others.

- **Populated by:** Social learning, proximity to crafting pawns
- **Effect:** 15% bonus to pondering discovery chance for observed craft types
- **Interacts with:** Lateral learning (observed + same material group = amplified chance)

---

### Known Materials ✅
> A set of material types the pawn has gathered, examined, or used.

- **Populated by:** `trackMaterialEncounter()` on gather or craft
- **Effect:** Enables lateral material substitution (10% chance when same group)
- **Interacts with:** Skill synergies (knowing diverse materials accelerates generalisation)

---

### Crafting History ✅
> Log of items crafted, including quality outcomes.

- **Populated by:** Each successful craft
- **Effect:** Feeds `solutionSuccessCount`; supports quality trend analysis
- **Interacts with:** `accumulate_valuables` goal (seeks high-quality craft opportunities)

---

### Inspiration via Story 🔮
> Hearing a narrative about a legendary technique sparks a new invention.

- **Prerequisites:**
  - `storytelling ≥ 3` AND `invention ≥ 5` in either teller or listener
  - Story must reference an item type or technique the listener hasn't yet mastered
- **Discovery chance:** `(invention + storytelling) × 0.5%`
- **Enables:**
  - Legendary/special recipes with unique properties
  - Cross-domain leaps: a story about far-off metallurgy may inspire ore investigation
  - Motivation events (temporary goal priority boost)

---

## Knowledge Sharing

### Teaching ✅
> Directly transferring a portion of a skill to another pawn.

- **Prerequisites:**
  - `cooperation ≥ 3` AND pawn has skill level ≥ 5 in any skill
- **Goal type:** `teach_skill`
- **Effect:**
  - Both teacher and student gain XP
  - Student gains `(teacher_skill_level × 0.1)` per session
  - Teacher gains `cooperation + storytelling` XP
- **Enables:**
  - Rapid diffusion of specialist skills
  - Guild and school multipliers when structure present

---

### Publication 🔮
> Recording knowledge in a scroll or plan that others can consult independently.

- **Prerequisites:**
  - `cartography ≥ 2` OR `planning ≥ 4`
  - Access to writing materials (bark, clay tablet, or paper — future materials)
- **Effect:**
  - Creates a knowledge artefact item that any pawn can read
  - Reading grants a discovery bonus for the recorded domain
  - Increases diffusion radius: knowledge spreads without direct pawn contact
- **Enables:**
  - Guild curriculum events
  - Long-range knowledge diffusion (caravans carry scrolls)

---

## Skill Decay ✅

Skills decay when unused for an extended period (configurable via `InventionConfig.js`):

| Parameter | Default |
|-----------|---------|
| `enableSkillDecay` | `true` |
| `skillDecayRate` | 0.1 per period |
| `skillDecayFloor` | 0.5 (50% of peak) |
| `skillDecayPeriod` | 200 ticks |
| `skillDecayInactiveThreshold` | 2000 ticks |

Decay creates a natural pressure toward specialisation: pawns who spread effort across many skills will see all of them decay slightly; pawns who focus retain high levels.

---

## User Intervention Points ✅

| Method | Effect |
|--------|--------|
| `pawn.setGoalPriorities({ hunger: 1.5, social: 0.5 })` | Adjust relative need priorities |
| `pawn.assignArbitraryGoal({ type: 'craft_item', ... })` | Inject a high-priority goal |
| `pawn.setResourceValuePreferences({ fiber: 0.9, rock: 0.5 })` | Adjust resource attractiveness |
| `pawn.adjustInventionRate(2.0)` | Speed up or slow down all discoveries |
