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
