# Player Mode Design: Two Main Game Perspectives

## Overview

Trade can be experienced through two fundamentally different lenses:

1. **Individual Steering** — the player is tethered to a named pawn and sees the world through that pawn's awareness.
2. **Trade-Network God Mode** — the player zooms out to watch the whole world, watching supply chains, social bonds, and resource flows as a remote patron.

Rather than choosing one at launch, Trade implements a **progressive unlocking** model: every player starts in Individual Steering (pawn mode) and earns broader perspectives as their pawn gains skills and social standing.

---

## The Three Perspectives

### 1. Pawn Mode (default)

> *"You are born knowing almost nothing."*

- Camera locks to the followed pawn.
- HUD shows: hunger, thirst, health, current goal, nearby items within perception radius.
- Map awareness is limited to what the pawn has explored; resource memory is the only "map".
- Player influence: suggest goals, observe decisions, watch skill growth.
- **Engagement hook**: investment in a single named character. The OHOL-style emotional bond — gratitude, fear, curiosity — comes from watching a pawn navigate the world with only its own memory to guide it.

### 2. Overseer Mode (unlocks at 15 total skill)

> *"You have learned enough to look beyond your own horizon."*

- Camera still follows the pawn by default but the player can pan freely and return to the pawn.
- Player can place **map waypoints** (cache hints, gathering targets, building locations) that the pawn's goal planner can optionally consult.
- HUD gains a small mini-map overlay and a list of nearby entities.
- **Engagement hook**: light 4X city-management feel — the player starts shaping the pawn's environment without overriding its autonomy. Waypoints are suggestions, not commands.

### 3. God Mode (unlocks at 50 total skill + group membership)

> *"Your pawn has a place in a larger story now."*

- Camera detaches to show the full world.
- Trade-network overlay: arrows showing resource transfer volume, colour-coded scarcity/surplus indicators.
- Player can observe group policies, social bonds, and contract activity across all known entities.
- **Engagement hook**: Dwarf Fortress / Paradox grand-strategy dopamine — watching the systems the player helped build interact at scale, without being able to micromanage them.

---

## Comparing the Two Main Modes

| Dimension | Individual Steering | God Mode |
|-----------|---------------------|----------|
| Emotional hook | Named pawn attachment, personal drama | Supply chain tension, emergent social structures |
| Player agency | Suggest goals, watch decisions | Set policies, observe contracts, macro interventions |
| Learning curve | Low: single pawn, single inventory | High: requires understanding of trade mechanics |
| Failure state | Pawn survival pressure | No catastrophic failure; gradual economic pressure |
| IP risk (vs OHOL) | High — very similar if player *controls* pawn | Low — observation/influence is the key differentiator |
| IP risk (vs DF/RimWorld) | Moderate | Moderate — trade focus is genuine differentiator |
| Replayability | Moderate — different pawn histories | High — emergent trade networks vary significantly |

### Recommendation

Neither mode alone is compelling enough. **The tension between them — and the moment of transition — is the core gameplay loop.**

The progression from pawn-mode to god-mode is itself the game. A player who has only ever known their pawn's limited horizon and then unlocks the ability to see the whole world for the first time has a genuine *revelation* moment. That moment is worth designing toward explicitly.

Concretely:

- Keep pawn mode's restricted HUD tight and intentional; don't leak god-mode information into it.
- Make the overseer unlock *feel* earned: a brief transition animation, a short story-seed about the pawn "looking up from their work for the first time".
- Make god mode's trade overlay immediately readable: colour and arrow thickness should tell the story without tooltips.

---

## Progressive Unlock Model

```
Total skill < 15          → Pawn mode only
Total skill ≥ 15          → Overseer unlocked
Total skill ≥ 50
  + group membership      → God mode unlocked
```

`total skill` is the sum of all values in `pawn.skills`. Group membership is any non-empty `pawn.reputation.membership` object.

These thresholds are intentionally low for early gameplay iteration. Once the invention system and social bonds stabilise, adjust:
- Overseer: require a specific skill tier (e.g. `planning ≥ 5`) rather than raw total.
- God: require a formal group role (e.g. `chief`, `elder`, `merchant`) rather than bare membership.

---

## Could a Player Switch Freely Between Modes?

Yes — and they should. The design intent is:

- The player can drop into god-mode to watch the macro picture, then snap back to pawn-mode to see why a particular pawn has been idle for three days.
- Overseer waypoints persist across mode switches; god-mode does not clear them.
- Switching to pawn-mode always re-centres on the tracked pawn.

This is analogous to the city/county zoom in Crusader Kings or the world/tactical split in XCOM.

---

## Implementation Notes

The `PlayerMode` class (`solo/js/core/PlayerMode.js`) manages mode state:

```js
import PlayerMode, { MODES } from './core/PlayerMode.js'

const playerMode = new PlayerMode(world, renderer)
playerMode.setTrackedPawn(player)

// Switch modes manually
playerMode.switchMode(MODES.OVERSEER)   // returns false if locked
playerMode.switchMode(MODES.GOD)

// React to changes
playerMode.onModeChange((next, prev) => console.log(`${prev} → ${next}`))

// Place overseer waypoints (ignored outside OVERSEER mode)
playerMode.addWaypoint(400, 600, 'stone cache')
```

The `modeSwitcher` UI (`solo/js/ui/modeSwitcher.js`) renders the three buttons in the control panel, greys out locked modes, and shows a hint explaining what is needed to unlock the next tier.

---

## Future Work

| Feature | Priority | Notes |
|---------|----------|-------|
| Story-seed transition text when mode unlocks | High | See concept-review.md Prompt 5 |
| Trade-network overlay in god mode | High | Canvas overlay pass; see concept-review.md Prompt 4 |
| Overseer waypoints consumed by pawn goal planner | Medium | Extend PawnGoals to scan playerMode.mapWaypoints |
| Skill-gated overseer (planning skill) vs raw total | Medium | Replace threshold after invention system matures |
| Group role requirement for god mode | Medium | Requires Phase 1 of civilization-roadmap.md |
| Pawn-mode restricted HUD (hide god-mode data) | Medium | Overlay layer in UIRenderer |
| Mode transition animation / story seed | Low | Polish; depends on StoryGenerator (concept-review.md Prompt 5) |

### Mode Visibility Contract v1 (Design Canon)

This contract defines how player knowledge, camera freedom, and UI abstraction evolve.
The simulation can stay consistent underneath; progression comes from earned interpretive tools.

#### Phase 0: Embodied

- Core feel: tamagotchi-like stewardship in an unknown world.
- Camera: first-person, pawn-locked, no free pan.
- Orientation/UI: no compass, no minimap, no global labels.
- Information exposure: immediate local context only; resources mostly  class-level ambiguity. Visual queues for nearby entities, but no subtype differentiation. Condition hints as colored vignettes or audio cues when survival thresholds are approached.
- Steering style: very short-horizon nudges and priorities, not direct puppeteering. Toggle actions like "ponder", "gather", "explore"
- Unlock gate: spawn default.
- Success signal: players form local habits and can return to near landmarks without map tools.
  
#### Phase 1: Situated

1. **Core feel**: survival readability begins while autonomy stays central.
2. **Camera**: tight third-person follow unlocks.
3. **Orientation/UI**: subtle directional confidence cues, no full compass/minimap. I might consider a "radar" that shows nearby entities as blips without labels, giving a sense of local density and direction without revealing specifics, which might improve to icons for memorized locations or known resource types.
4. **Information exposure**: nearby entities are clearer; subtype differentiation starts with experience.
5. **Steering style**: RimWorld-like steering in follow mode (suggest and shape, do not directly control). Start picking specific needs to address (e.g. "gather food" vs "ponder") and enable simple context-sensitive actions (e.g. "gather berry bush" when near one). The "examine" skill is probably unlocked here, so a player could target an entity, resource, or inventory item and get more detailed information about it, which would help with subtype differentiation and informed decision-making.
6. **Unlock gate**: either first meaningful wearable/loadout milestone OR orientation skill threshold. After returning to a landmark a few times, the player has demonstrated basic spatial memory and survival competence. Alternatively, reaching a certain skill threshold (e.g. "orientation ≥ 5") would indicate that the player has engaged enough with the world to benefit from additional tools.
7. **Success signal**: reduced disorientation and more intentional local loops.

#### Phase 2: Orienting

1. **Core feel**: intentional travel and return becomes reliable.
2. **Camera**: third-person with modest look freedom and snap-back.
3. **Orientation/UI**: compass plus landmark confidence plus route confidence hints. The minimap shifts from radar to a simple local compass that always points north and shows the player's position. It may also show some "fog of war" effect where explored areas are clearer and unexplored areas are dimmed or hidden. 
4. **Information exposure**: discovered landmarks/resources stabilize; unknown specifics remain partially hidden. Inconography starts to differentiate resource types, but only for those the player has encountered before. Unexplored areas and undiscovered resources remain vague or hidden to preserve the sense of discovery and risk. Paths start to appear as the player travels them, but they are not yet fully reliable or detailed; they might show general direction and rough distance but not exact routes or resource locations until they've been traveled multiple times.
5. **Steering style**: medium-horizon expedition steering. Points of interest that are not visible can be targeted for travel or gathering, a sense of "claiming" an area may begin. This is where groups ought to be forming naturally as well, so social goals and sharing information will star to play in. The crafting and skill system will allow for bigger claims like "build a shelter here" or "establish a cache here", without requiring to first get all the ingredients for a full base. 
6. **Unlock gate**: orienteering >= 15 AND at least 2 pawn-created landmark return loops.
7. **Success signal**: fewer panic loops, more planned outbound/return routes. Starting to look for valuable locations for more permanent bases or caches, and successfully returning to them, would indicate that the player is developing a mental map of the world and can navigate it with intention rather than just reacting to immediate threats or opportunities.

#### Phase 3: Mapping

1. **Core feel**: mental map literacy emerges before overseer.
2. **Camera**: tactical follow with recenter and short contextual pan. Can be locked to a cardinal direction (e.g. north) to reinforce the sense of a stable mental map, with the option to briefly pan around for situational awareness before snapping back to the pawn.
3. **Orientation/UI**: recall-weighted partial map and local radar. A concept map overlay that fills in as the player explores. Rather than a geographic map, this is a network of known locations and their connections, similar to a subway map.
4. **Information exposure**: exploration-confidence map only; unknown regions stay blank. Much more complicated individual status and resource information becomes available, but only for known entities. The player can see detailed stats and conditions for their pawn and nearby entities, but the wider world remains a mystery until explored. The player can start naming and categorizing locations, which helps with memory and planning. For example, a player might name a cluster of berry bushes "Berry Patch" and a nearby rock formation "Stone Shelter", which then appear on the map as labeled nodes once discovered. These names can also be communicated with others. In a group, scouting parties can be sent out to unknown regions, gathering teams can fetch resources from known locations, and the player can start to see patterns in resource distribution and travel routes. Frequently traveled paths become more visible on the map, reinforcing the player's mental model of the world and encouraging them to establish more permanent routes and bases. The player can also start to see "heatmaps" of activity or resource density, which can guide their exploration and settlement decisions.
5. **Steering style**: pre-overseer scouting and corridor shaping. The player can start to influence the pawn's behavior more strategically, setting waypoints for exploration or resource gathering that the pawn can choose to follow. Minor weight shifts on need limits or goal priorities can nudge the pawn towards certain behaviors without direct control, allowing the player to shape their environment and habits over time. In addition to physical targets, intellectual targets can be prioritized for purposes of things like surveying the region, focusing on a particular resource, or seeking out social connections.
6. **Unlock gate**: route-recall consistency AND planning/cartography competency. Getting to name an area on the map and successfully returning to it multiple times demonstrates a solid mental map. Additionally, reaching a certain skill threshold in planning or cartography would indicate that the player has engaged enough with the world and its systems to benefit from more advanced tools.
7. **Success signal**: players use map/radar to plan, not just react.

#### Overseer

1. **Core feel**: local systems shaping without direct control.
2. **Camera**: pawn-anchored plus free pan plus return-to-pawn.
3. **Orientation/UI**: full local minimap plus stable orientation tools plus waypoint controls.
4. **Information exposure**: wider actionable local world, still not omniscient macro truth.
5. **Steering style**: policy-like local influence via waypoints and priorities.
6. **Unlock gate**: existing overseer gate plus demonstrated orientation literacy.
7. **Success signal**: waypoints change outcomes and feel earned.

#### God

1. **Core feel**: macro-system comprehension and trade dynamics.
2. **Camera**: detached macro camera with full-world framing.
3. **Orientation/UI**: strategic map, legend, and system overlays.
4. **Information exposure**: trade flows, scarcity/surplus, settlement dynamics.
5. **Steering style**: observe and intervene at system level.
6. **Unlock gate**: existing god gate plus social/system literacy.
7. **Success signal**: player can explain macro shifts from visible signals.

### Navigation UI Progression Rule

1. After resource differentiation unlocks, enable a local heading radar that is short-range, heading-biased, and non-omniscient.
2. Expand radar semantics by skill stage: resource class pings, then biome boundary hints, then terrain feature hints.
3. Promote to a recall-weighted partial map.
4. Promote to full minimap at or after Overseer readiness.

### Control Doctrine

1. Core identity is indirect control: the player steers priorities and opportunities while pawns remain autonomous.
2. Emphasize simulation-backed character stewardship, not direct-avatar mastery loops.
3. Mode transitions should communicate cognitive growth, not only UI unlocks.

### Guardrails

1. Do not use food-source loop count as a primary gate; map generation variance distorts timing.
2. Prefer created-landmark loop evidence (cache/build-site returns) for reliable pacing.
3. Keep hidden information explicit at each stage to preserve revelation tension.

### Gate Event Definitions v1 (Deterministic)

- `created_landmark`:
A landmark created by player-directed action (`cache_placed` or `build_site_started`) with a stable id and position.

- `landmark_return_attempt`:
Begins when pawn leaves a landmark radius (`> returnRadius`) and later re-enters that same landmark radius with an active return intent.

- `landmark_return_success`:
A return attempt that re-enters landmark radius within `maxReturnTicks` and without critical failure.
Recommended defaults:
`returnRadius = 24`
`maxReturnTicks = 1800`

- `critical_failure_during_loop`:
Any of:
`health <= criticalHealthThreshold`
`hunger <= criticalNeedThreshold`
`thirst <= criticalNeedThreshold`
Recommended defaults:
`criticalHealthThreshold = 15`
`criticalNeedThreshold = 10`

- `created_landmark_return_loop_success`:
A successful loop tied to a `created_landmark` id.
Phase 2 requires at least `2` successes on created landmarks.

- `route_recall_consistency`:
`successfulReturns / returnAttempts >= routeRecallThreshold`
Recommended default:
`routeRecallThreshold = 0.7` over rolling `last 10 attempts`.

- `orientation_skill_gate`:
`orienteering >= 15`

- `mapping_competency_gate`:
`planning >= planningThreshold OR cartography >= cartographyThreshold`
Recommended defaults:
`planningThreshold = 12`
`cartographyThreshold = 8`

### Visibility Matrix v0 (guess, tune later)

#### Phase 0: Embodied
- Compass: off
- Local radar: off
- Minimap: off
- Waypoint placement: off
- Waypoint display: off
- Resource subtype labels: off
- Resource class labels: partial (nearby only)
- Landmark names: off unless directly inspected
- Perception toggle: off (phase-locked behavior)

#### Phase 1: Situated
- Compass: off
- Local radar: partial (blips only, no labels)
- Minimap: off
- Waypoint placement: off
- Waypoint display: off
- Resource subtype labels: partial (experience-gated)
- Resource class labels: on (nearby)
- Landmark names: partial (repeat contact only)
- Perception toggle: limited (local-only)

#### Phase 2: Orienting
- Compass: on
- Local radar: on (heading-biased, short range)
- Minimap: off
- Waypoint placement: off
- Waypoint display: partial (read-only hints)
- Resource subtype labels: partial (confidence-gated)
- Resource class labels: on
- Landmark names: on (known landmarks)
- Perception toggle: on (still bounded to local cognition)

#### Phase 3: Mapping
- Compass: on
- Local radar: on (resource + biome + terrain layers by skill)
- Minimap: partial (recall-weighted, incomplete)
- Waypoint placement: partial (pre-overseer planning marks)
- Waypoint display: on (known markers only)
- Resource subtype labels: on for known types, partial for unknown
- Resource class labels: on
- Landmark names: on + player naming
- Perception toggle: on (phase-aware behavior)

#### Overseer
- Compass: on
- Local radar: on
- Minimap: on (full local)
- Waypoint placement: on
- Waypoint display: on
- Resource subtype labels: on
- Resource class labels: on
- Landmark names: on
- Perception toggle: mode-aware (not allowed to hide required overseer context)

#### God
- Compass: optional/de-emphasized
- Local radar: replaced by macro overlays
- Minimap: superseded by strategic map
- Waypoint placement: on (macro markers/policies)
- Waypoint display: on
- Resource subtype labels: abstracted to system overlays
- Resource class labels: abstracted
- Landmark names: on where relevant
- Perception toggle: off or no-op (god readability takes priority)

## Telemetry For Tuning

Define first-pass telemetry fields.

- phase_entered, phase_duration_ticks
- landmark_created_count
- landmark_return_success_count
- unlock_attempt_reason
- radar_usage_count, minimap_usage_count

## Acceptance Checks

- [ ] Phase 2 remains locked until `orienteering >= 15`.
- [ ] Phase 2 remains locked until `created_landmark_return_loop_success >= 2`.
- [ ] Food-source loop outcomes do not affect primary Phase 2 unlock.
- [ ] Phase 3 remains locked until route recall consistency threshold is met.
- [ ] Phase 3 remains locked until mapping competency gate is met.
- [ ] Visibility flags match phase contract (no future-phase leakage).
- [ ] Unlock reason is logged with gate values at transition time.

## Progression Ownership

Progression state is managed externally to `PlayerMode` (for example, a `ProgressionController` or equivalent system state module).

`PlayerMode` should:
- remain a mode-switching and camera-policy consumer
- receive a resolved capability snapshot (what is unlocked/visible)
- avoid owning gate logic directly

External progression should own:
- gate evaluation (skills, landmark loops, route consistency)
- phase transitions
- visibility capability flags
- telemetry counters and unlock reasons

### Capability Modules (v1)

`validCamera`
- `first_locked`
- `first_look`
- `third_lock`
- `third_look`
- `third_free`
- `pan_n_scan`

`compass`
- `none`
- `heading_hint`
- `cardinal`
- `cardinal_with_landmarks`
- `cardinal_with_route_confidence`

`minimap`
- `none`
- `radar_blips`
- `radar_icons`
- `partial_recall_map`
- `local_full_map`
- `strategic_map`

`map_overlay`
- `none`
- `resource_class`
- `resource_known_types`
- `biome_edges`
- `terrain_features`
- `route_traces`
- `waypoints_local`
- `trade_flows`
- `scarcity_surplus`
- `settlement_regions`
- `contracts_activity`

`labels`
- `none`
- `nearby_class_only`
- `nearby_known_types`
- `known_landmarks`
- `named_landmarks`
- `system_labels`

`steering`
- `need_nudges_only`
- `context_actions_basic`
- `goal_bias_local`
- `goal_bias_route`
- `waypoint_policy_local`
- `policy_macro`

`perceptionModePolicy`
- `disabled`
- `local_only`
- `phase_aware`
- `mode_aware`
- `god_noop`

### Phase -> Module Mapping (v1 guess)

`Phase 0: Embodied`
- validCamera: `first_locked`
- compass: `none`
- minimap: `none`
- map_overlay: `none`
- labels: `nearby_class_only`
- steering: `need_nudges_only`
- perceptionModePolicy: `disabled`

`Phase 1: Situated`
- validCamera: `third_lock`
- compass: `heading_hint`
- minimap: `radar_blips`
- map_overlay: `resource_class`
- labels: `nearby_known_types`
- steering: `context_actions_basic`
- perceptionModePolicy: `local_only`

`Phase 2: Orienting`
- validCamera: `third_look`
- compass: `cardinal_with_landmarks`
- minimap: `radar_icons`
- map_overlay: `resource_known_types`, `route_traces`
- labels: `known_landmarks`
- steering: `goal_bias_route`
- perceptionModePolicy: `phase_aware`

`Phase 3: Mapping`
- validCamera: `third_free`
- compass: `cardinal_with_route_confidence`
- minimap: `partial_recall_map`
- map_overlay: `biome_edges`, `terrain_features`, `route_traces`, `waypoints_local`
- labels: `named_landmarks`
- steering: `goal_bias_route`
- perceptionModePolicy: `phase_aware`

`Overseer`
- validCamera: `pan_n_scan`
- compass: `cardinal_with_route_confidence`
- minimap: `local_full_map`
- map_overlay: `waypoints_local`, `resource_known_types`, `biome_edges`, `terrain_features`, `route_traces`
- labels: `named_landmarks`
- steering: `waypoint_policy_local`
- perceptionModePolicy: `mode_aware`

`God`
- validCamera: `pan_n_scan`
- compass: `none`
- minimap: `strategic_map`
- map_overlay: `trade_flows`, `scarcity_surplus`, `settlement_regions`, `contracts_activity`
- labels: `system_labels`
- steering: `policy_macro`
- perceptionModePolicy: `god_noop`

`pawn_status`
- `none`
- `vitals_basic`
- `vitals_trend`
- `needs_stack`
- `condition_flags`
- `task_intent`
- `inventory_summary`
- `inventory_detail`
- `loadout_summary`
- `loadout_detail`
- `skills_summary`
- `skills_detail`
- `memory_confidence`
- `social_summary`
- `social_detail`

`Phase 0: Embodied`
- pawn_status: `vitals_basic`, `task_intent`

`Phase 1: Situated`
- pawn_status: `vitals_trend`, `needs_stack`, `inventory_summary`, `loadout_summary`, `condition_flags`

`Phase 2: Orienting`
- pawn_status: `task_intent`, `inventory_detail`, `loadout_detail`, `memory_confidence`, `skills_summary`

`Phase 3: Mapping`
- pawn_status: `skills_detail`, `social_summary`, `memory_confidence`, `condition_flags`

`Overseer`
- pawn_status: `skills_detail`, `social_detail`, `inventory_detail`, `task_intent`, `condition_flags`

`God`
- pawn_status: `social_summary` (aggregate context) with optional `social_detail` on inspect

`interaction_controls`
- `none`
- `nudge_basic`                // ponder, gather, explore
- `nudge_need_focus`           // bias hunger/thirst/rest/safety
- `target_interact_near`       // interact with nearby entity/resource
- `examine_basic`              // inspect known item/entity summary
- `examine_detailed`           // deeper stats and confidence breakdown
- `goal_pin_local`             // suggest local objective
- `goal_pin_route`             // suggest route destination
- `waypoint_place`
- `waypoint_edit`
- `waypoint_remove`
- `policy_local`               // local priorities/weights
- `policy_macro`               // settlement/network policy actions

`feedback_channels`
- `none`
- `thought_stream_basic`          // short pawn thoughts, reactive
- `thought_stream_weighted`       // thoughts include urgency/confidence cues
- `thought_injection_prompt`      // player can boost a thought ("I could eat")
- `thought_competition_visible`   // see competing thought candidates
- `intent_confirmation`           // "accepted / deferred / rejected" on player boosts
- `event_toast_survival`          // lightweight survival outcomes
- `event_toast_social`            // relationship/group outcomes
- `achievement_log`               // milestone feed
- `capability_reflection`         // milestone shown as new capability unlocked
- `narrative_recap`               // periodic pawn-perspective summary
- `system_dashboard_local`        // local structured panel
- `system_dashboard_macro`        // overseer/god structured panel

practical rules to add:

Every unlocked control must have visible feedback (accepted, deferred, ignored) so autonomy feels readable.
Controls never become direct command queues; they remain weighted suggestions.

Player "push goal" is implemented as `thought boost`, not command:
- Select thought candidate (existing or injected)
- Apply temporary weight boost
- Autonomy still resolves final action against competing needs/thoughts
- Show resolution feedback: accepted, deferred, or displaced (with reason)

Achievements should be primarily diegetic:
- Expanded skill expression
- More capable loadout
- Richer social circle / stronger ties
- Milestone log is secondary reflection, not primary reward surface

## Capability Payload Schema v1

This schema is emitted by external progression and consumed by `PlayerMode`, renderer, and UI.

### Payload shape

- `phase`: one of `phase0_embodied`, `phase1_situated`, `phase2_orienting`, `phase3_mapping`, `overseer`, `god`
- `modeUnlocked`:
  - `pawn`: boolean
  - `overseer`: boolean
  - `god`: boolean
- `modules`:
  - `validCamera`: `first_locked | first_look | third_lock | third_look | third_free | pan_n_scan`
  - `compass`: `none | heading_hint | cardinal | cardinal_with_landmarks | cardinal_with_route_confidence`
  - `minimap`: `none | radar_blips | radar_icons | partial_recall_map | local_full_map | strategic_map`
  - `mapOverlay`: array of
    - `resource_class`
    - `resource_known_types`
    - `biome_edges`
    - `terrain_features`
    - `route_traces`
    - `waypoints_local`
    - `trade_flows`
    - `scarcity_surplus`
    - `settlement_regions`
    - `contracts_activity`
  - `labels`: `none | nearby_class_only | nearby_known_types | known_landmarks | named_landmarks | system_labels`
  - `steering`: `need_nudges_only | context_actions_basic | goal_bias_local | goal_bias_route | waypoint_policy_local | policy_macro`
  - `perceptionModePolicy`: `disabled | local_only | phase_aware | mode_aware | god_noop`
  - `pawnStatus`: array of
    - `vitals_basic`
    - `vitals_trend`
    - `needs_stack`
    - `condition_flags`
    - `task_intent`
    - `inventory_summary`
    - `inventory_detail`
    - `loadout_summary`
    - `loadout_detail`
    - `skills_summary`
    - `skills_detail`
    - `memory_confidence`
    - `social_summary`
    - `social_detail`
  - `interactionControls`: array of
    - `nudge_basic`
    - `nudge_need_focus`
    - `target_interact_near`
    - `examine_basic`
    - `examine_detailed`
    - `goal_pin_local`
    - `goal_pin_route`
    - `waypoint_place`
    - `waypoint_edit`
    - `waypoint_remove`
    - `policy_local`
    - `policy_macro`
  - `feedbackChannels`: array of
    - `thought_stream_basic`
    - `thought_stream_weighted`
    - `thought_injection_prompt`
    - `thought_competition_visible`
    - `intent_confirmation`
    - `event_toast_survival`
    - `event_toast_social`
    - `achievement_log`
    - `capability_reflection`
    - `narrative_recap`
    - `system_dashboard_local`
    - `system_dashboard_macro`
- `gateState`:
  - `orienteering`: number
  - `planning`: number
  - `cartography`: number
  - `createdLandmarks`: number
  - `createdLandmarkReturnLoops`: number
  - `routeRecallConsistency`: number
- `telemetryContext`:
  - `unlockReason`: string
  - `unlockCandidates`: string[]
  - `lastTransitionTick`: number

### Minimal example

- `phase`: `phase2_orienting`
- `modeUnlocked`: pawn true, overseer false, god false
- `modules.validCamera`: `third_look`
- `modules.compass`: `cardinal_with_landmarks`
- `modules.minimap`: `radar_icons`
- `modules.mapOverlay`: `resource_known_types`, `route_traces`
- `modules.labels`: `known_landmarks`
- `modules.steering`: `goal_bias_route`
- `modules.perceptionModePolicy`: `phase_aware`
- `gateState.createdLandmarkReturnLoops`: 2
- `gateState.orienteering`: 15

## Progression Evaluator Contract v1

External progression evaluator computes phase, unlocks, and capability payload.

### Inputs

- Pawn state:
  - skills (`orienteering`, `planning`, `cartography`)
  - memory state (`memoryMap`, route history, confidence data)
  - inventory/loadout milestones
  - social membership/role state
- Event stream:
  - `cache_placed`
  - `build_site_started`
  - `landmark_return_attempt_started`
  - `landmark_return_success`
  - `critical_failure_during_loop`
  - `thought_injected`
- Runtime context:
  - current tick
  - map seed/session id (for tuning analysis)

### Outputs

- Capability payload v1
- Transition events:
  - `phase_entered`
  - `mode_unlocked`
  - `capability_unlocked`
- Telemetry records:
  - gate values at transition
  - unlock reason
  - blocked reason when attempted but denied

### Deterministic gate rules (default)

- Phase 1:
  - wearable/loadout milestone OR early orientation threshold
- Phase 2:
  - `orienteering >= 15` AND `createdLandmarkReturnLoops >= 2`
- Phase 3:
  - `routeRecallConsistency >= 0.7` over recent attempts
  - AND (`planning >= 12` OR `cartography >= 8`)
- Overseer:
  - existing overseer gate AND orientation literacy achieved
- God:
  - existing god gate AND social/system literacy gate

### Non-goals

- Evaluator does not render UI
- Evaluator does not move camera
- Evaluator does not directly command pawn actions

## Renderer and UI Consumption Contract v1

### Ownership boundaries

- External progression:
  - computes payload and transitions
- `PlayerMode`:
  - consumes `modeUnlocked` and selected camera policy
  - executes mode switch requests if allowed
- Renderer/UI:
  - consume `modules.*` flags only
  - never infer phase from ad-hoc heuristics

### Consumption rules

1. Camera controller reads `modules.validCamera`.
2. HUD reads:
   - `compass`, `minimap`, `labels`, `pawnStatus`.
3. Map layers read:
   - `mapOverlay`.
4. Input/action surfaces read:
   - `interactionControls`, `steering`.
5. Thought and toast systems read:
   - `feedbackChannels`.
6. Perception toggle reads:
   - `perceptionModePolicy`.

### Conflict resolution

- If a feature is not enabled in payload, UI must hide/disable it.
- If mode allows a feature but phase payload denies it, payload wins.
- `god_noop` means perception toggle is visible optional or hidden, but has no filtering effect.

### Transition behavior

- On phase/mode transition:
  - apply payload atomically (single frame boundary)
  - emit one transition notification
  - show capability reflection message if newly unlocked
- Avoid partial mid-frame state where old and new capabilities mix.

## Phase Defaults v1 (No-Table Appendix)

Use these as default capability presets before tuning.

### phase0_embodied
- validCamera: `first_locked`
- compass: `none`
- minimap: `none`
- mapOverlay: `[]`
- labels: `nearby_class_only`
- steering: `need_nudges_only`
- perceptionModePolicy: `disabled`
- pawnStatus:
  - `vitals_basic`
  - `task_intent`
- interactionControls:
  - `nudge_basic`
- feedbackChannels:
  - `thought_stream_basic`
  - `event_toast_survival`

### phase1_situated
- validCamera: `third_lock`
- compass: `heading_hint`
- minimap: `radar_blips`
- mapOverlay:
  - `resource_class`
- labels: `nearby_known_types`
- steering: `context_actions_basic`
- perceptionModePolicy: `local_only`
- pawnStatus:
  - `vitals_trend`
  - `needs_stack`
  - `inventory_summary`
  - `loadout_summary`
  - `condition_flags`
  - `task_intent`
- interactionControls:
  - `nudge_need_focus`
  - `target_interact_near`
  - `examine_basic`
- feedbackChannels:
  - `thought_stream_weighted`
  - `thought_injection_prompt`
  - `intent_confirmation`

### phase2_orienting
- validCamera: `third_look`
- compass: `cardinal_with_landmarks`
- minimap: `radar_icons`
- mapOverlay:
  - `resource_known_types`
  - `route_traces`
- labels: `known_landmarks`
- steering: `goal_bias_route`
- perceptionModePolicy: `phase_aware`
- pawnStatus:
  - `inventory_detail`
  - `loadout_detail`
  - `skills_summary`
  - `memory_confidence`
  - `task_intent`
- interactionControls:
  - `goal_pin_local`
  - `goal_pin_route`
  - `examine_detailed`
- feedbackChannels:
  - `thought_competition_visible`
  - `capability_reflection`
  - `event_toast_social`
  - `intent_confirmation`

### phase3_mapping
- validCamera: `third_free`
- compass: `cardinal_with_route_confidence`
- minimap: `partial_recall_map`
- mapOverlay:
  - `biome_edges`
  - `terrain_features`
  - `route_traces`
  - `waypoints_local`
- labels: `named_landmarks`
- steering: `goal_bias_route`
- perceptionModePolicy: `phase_aware`
- pawnStatus:
  - `skills_detail`
  - `social_summary`
  - `memory_confidence`
  - `condition_flags`
  - `task_intent`
- interactionControls:
  - `goal_pin_route`
  - `waypoint_place`
  - `examine_detailed`
- feedbackChannels:
  - `narrative_recap`
  - `achievement_log`
  - `system_dashboard_local`
  - `intent_confirmation`

### overseer
- validCamera: `pan_n_scan`
- compass: `cardinal_with_route_confidence`
- minimap: `local_full_map`
- mapOverlay:
  - `waypoints_local`
  - `resource_known_types`
  - `biome_edges`
  - `terrain_features`
  - `route_traces`
- labels: `named_landmarks`
- steering: `waypoint_policy_local`
- perceptionModePolicy: `mode_aware`
- pawnStatus:
  - `skills_detail`
  - `social_detail`
  - `inventory_detail`
  - `task_intent`
  - `condition_flags`
- interactionControls:
  - `waypoint_place`
  - `waypoint_edit`
  - `waypoint_remove`
  - `policy_local`
- feedbackChannels:
  - `system_dashboard_local`
  - `achievement_log`
  - `intent_confirmation`

### god
- validCamera: `pan_n_scan`
- compass: `none`
- minimap: `strategic_map`
- mapOverlay:
  - `trade_flows`
  - `scarcity_surplus`
  - `settlement_regions`
  - `contracts_activity`
- labels: `system_labels`
- steering: `policy_macro`
- perceptionModePolicy: `god_noop`
- pawnStatus:
  - `social_summary`
- interactionControls:
  - `policy_macro`
- feedbackChannels:
  - `system_dashboard_macro`
  - `achievement_log`
  - `narrative_recap`

## Override and Debug Controls v1

These controls exist for testing, tuning, and sandbox play.
They must not silently alter canonical progression data.

### Debug Capability Overrides

- `overrideCapabilitiesEnabled`: master switch for manual capability overrides.
- `overridePhase`: force one of
  - `phase0_embodied`
  - `phase1_situated`
  - `phase2_orienting`
  - `phase3_mapping`
  - `overseer`
  - `god`
- `overrideModules`: partial patch object for any module field.
- `overrideModeUnlocked`: optional forced mode unlock flags.

Rules:
1. Overrides are session-local by default.
2. UI must visibly indicate when overrides are active.
3. Telemetry should mark events with `isOverrideSession = true`.
4. Progression evaluator continues running but does not replace forced values while override is active.

### Time and Simulation Controls

- `simSpeed`: multiplier for simulation ticks.
  - Suggested presets: `0.25x`, `0.5x`, `1x`, `2x`, `4x`, `8x`, `16x`
- `pauseSimulation`: pause world update loop.
- `stepTicks`: advance exactly N ticks while paused.
- `skipTo`: jump by target duration or tick count.
  - Example forms: `+600 ticks`, `+1 day`, `to tick 20000`
- `backgroundFastForward`: high-speed simulation with reduced rendering frequency.

Rules:
1. Fast-forward must preserve deterministic simulation order.
2. Time controls must not bypass gate event generation.
3. Unlock transitions during skip/fast-forward must still emit transition events.
4. Any skipped period should be summarized (new unlocks, key events, failures).

### Recommended UI Surface

- `Dev panel` sections:
  1. `Phase + capability overrides`
  2. `Time controls`
  3. `Gate counters live view`
  4. `Reset tools`
- Minimal player-facing hotkeys:
  - Toggle dev panel
  - Pause/resume
  - Step 1 tick
  - Cycle speed preset

### Reset and Safety Tools

- `clearOverrides`: disable all manual overrides and return to evaluator output.
- `recomputeFromState`: recompute current phase/capabilities from current pawn/world state.
- `resetProgressionTelemetry`: clear tuning counters only (not simulation state).
- `hardResetProgression`: restart progression state for current pawn (explicit confirmation required).

### Precedence Rules (important)

1. Accessibility overrides
2. Debug overrides
3. Progression evaluator output
4. Static defaults

If two rules conflict, highest precedence wins.

### Production Guardrail

All override and time-skip features are disabled in release builds by default unless explicitly enabled by game mode/config.

