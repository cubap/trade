# TradeGameNotes Alignment Plan

## Purpose

Translate early TradeGameNotes concepts into a concrete enhancement plan tied to existing workspace systems.

## Current Alignment Snapshot

### Strongly Implemented Foundations

- Autonomous needs, goals, and behavior state loops are in place.
- Hierarchical goal decomposition and deferred goals are active.
- Resource memory, clustering, route planning, and social sharing exist.
- Crafting and invention progression exist, with tuning centralized.
- Skill unlocks already support observation/exposure style progression.

### Partially Implemented (Good Hooks Exist)

- Teaching/apprenticeship loops exist, but not yet as contract-driven institutions.
- Structures exist with occupancy and deterioration, but no settlement governance layer.
- Trade intent goals exist, but no explicit market entity, inventory pressure, or price discovery loop.
- Reputation primitives exist, but not yet powering faction/civic/corporate systems.

### Largely Missing (High-Value Expansion Areas)

- Party command system (follow/protect/mark/gather/obey) with stable group membership.
- Civic systems: citizenship, law/tax/toll policy, treasury, elections/appointments.
- Corporate systems: shops, wholesale/retail spread, supply-chain contracts, credit.
- Education as institutions: schools/guild curricula, formal apprenticeships, service occupations.
- Diplomacy/warfare layer: alliances, patrol assignments, siege logistics.
- Environment and macro events: weather/disasters impacting economy and structures.

## Workspace Anchors (Use Existing Hooks First)

- `solo/js/models/entities/mobile/Pawn.js`
  - Skill, memory, reputation, observation, teaching, planning hooks.
  - Invention pacing and specialization hooks already integrated.
- `solo/js/models/entities/mobile/PawnGoals.js`
  - Long-term goals already include build/trade/map/teach/collaborative craft.
  - Good insertion point for contract and command goal families.
- `solo/js/models/skills/SkillUnlocks.js`
  - Data-driven unlock gate for introducing civic/trade/military capabilities.
- `solo/js/models/crafting/Recipes.js`
  - Existing recipe and placeable support for structure progression.
- `solo/js/models/entities/immobile/Structure.js` and `solo/js/models/entities/immobile/School.js`
  - Existing structure lifecycle and occupancy/buff systems.
- `docs/architecture/occupation-and-economy-framework.md`
  - Canonical triad framing (Tribe/Town/Traders) and pacing baseline.

## Concept-to-System Mapping

### Military / Tribal Organization

Current:
- Movement and goal coordination exists at individual pawn level.
- Basic reputation and social interaction exist.

Gap:
- No explicit group object, command queue, or obedience/trust mechanics.

Plan:
1. Add lightweight group model with leader, members, cohesion score.
2. Add command goal types (`follow_leader`, `protect_target`, `escort_target`, `mark_target`).
3. Route commands through trust/reputation checks before compliance.

### Civil / Settlement / Governance

Current:
- Structures, schools, and shelter crafting exist.
- Structure exposure can unlock planning/cartography behavior.

Gap:
- No settlement detection, communal storage, civic roles, laws, or tax loops.

Plan:
1. Detect settlements from structure clusters and occupancy density.
2. Add `Settlement` state object (treasury, policy flags, civic reputation).
3. Introduce civic posts and simple election/appointment events.

### Corporate / Trade / Logistics

Current:
- Trade-oriented long-term goals exist.
- Resource value preferences and specialization/value logic exist.

Gap:
- No shop entities, price index, stock constraints, contract execution, or route economics.

Plan:
1. Add market/shop entities with buy-sell spreads and inventory.
2. Add rolling local price memory (pawn + settlement).
3. Add delivery/escort/supply contracts tied to reputation.

### Educational / Guild / Service Economy

Current:
- `teach_skill`, `train_skill`, `apprentice_skill`, and school buffs exist.

Gap:
- No guild identity, curricula, service postings, or apprenticeship guarantees.

Plan:
1. Add guild entities as specialized organizations per domain.
2. Add curriculum tracks and lesson prerequisites in unlock tables.
3. Add service jobs (`teacher`, `scout_reporter`, `courier`, `healer`) via settlement boards.

## Phased Delivery Plan

## Phase 1: Command and Group Primitive (MVP)

Goal:
- Make military/tribal organization real using minimal new data structures.

Scope:
- Group model, leader/member roles, 4 command types, obedience gate by trust.
- Add tests for command acceptance/rejection and group cohesion decay.

Primary files:
- `solo/js/models/entities/mobile/Pawn.js`
- `solo/js/models/entities/mobile/PawnGoals.js`
- `solo/test/goal-system.test.js`

## Phase 2: Settlement Kernel and Civic Reputation

Goal:
- Turn structures into proto-towns with measurable civic behavior.

Scope:
- Settlement detection + communal storage + civic reputation updates.
- Basic policy toggles (`taxLow`, `taxHigh`, `openMarket`, `curfew`).

Primary files:
- `solo/js/core/World.js`
- `solo/js/models/entities/immobile/Structure.js`
- `solo/js/models/entities/mobile/Pawn.js`

## Phase 3: Shops, Prices, and Contracts

Goal:
- Implement practical trade loops and role drift (gatherer -> merchant).

Scope:
- Shop entity, stock-aware pricing, delivery/supply contracts.
- Route profitability heuristic using existing route planning skill.

Primary files:
- `solo/js/models/entities/immobile/Structure.js` (or dedicated Shop entity)
- `solo/js/models/entities/mobile/PawnGoals.js`
- `solo/js/models/entities/mobile/Pawn.js`

## Phase 4: Guild and Service Layer

Goal:
- Formalize education/service economy without replacing autonomous behavior.

Scope:
- Guild membership, apprenticeship contracts, service postings.
- Skill unlock extensions for institutional progression.

Primary files:
- `solo/js/models/skills/SkillUnlocks.js`
- `solo/js/models/entities/mobile/PawnGoals.js`
- `solo/js/models/entities/immobile/School.js`

## Phase 5: Diplomacy, Warfare, and Infrastructure Pressure

Goal:
- Add inter-group tension/cooperation and infrastructure outcomes.

Scope:
- Alliance/hostility states, raid events, route security contracts.
- Roads/walls provide mobility/safety modifiers.

Primary files:
- `solo/js/core/World.js`
- `solo/js/models/entities/mobile/Pawn.js`
- `solo/js/models/entities/mobile/PawnGoals.js`

## Validation Strategy

- Keep unit tests close to each phase (`solo/test/*.test.js`).
- Prefer deterministic tests for group command compliance and pricing updates.
- Add lightweight simulation assertions for profession drift and settlement stability.

## Immediate Next Slice (Recommended)

Implement Phase 1 first:
- Add group primitive + command goals.
- Reuse existing reputation memory and teaching/social hooks.
- Keep UI minimal initially (debug/console control is sufficient for first pass).

This gives the fastest path from current autonomous pawns to visible Tribe/Town/Traders behavior without destabilizing existing systems.
