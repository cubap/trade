# Cartography and Wayfinding

Cartography is the progression from raw spatial memory to shared, durable knowledge of the world. It is the bridge between tribal scouts who know the land and civic/mercantile groups who can plan routes, defend territories, and trade across distances.

This system has three layers:
1. **Skill progression** — from remembering landmarks to drawing maps
2. **Crafted artifacts** — physical objects that encode spatial knowledge
3. **Desire paths** — emergent terrain features from repeated movement

---

## Skill Progression

### Cartography (expanded)
> Recording and sharing maps of the known world.

- **Prerequisites (any one path):**
  - `planning ≥ 2` AND structure exposure: `school ≥ 1`
  - OR `exploration` high AND pawn has visited ≥ 3 distinct resource clusters
- **Enables:**
  - Longer resource memory retention
  - Ability to share memory with other pawns
  - At `cartography ≥ 2`: unlocks [Waypost](#waypost) crafting
  - At `cartography ≥ 3`: unlocks [Trail Marker](#trail-marker) crafting
  - At `cartography ≥ 5`: unlocks [Map](#map) crafting
  - Facilitates [Mercantile › Trade Routes](mercantile-entrepreneurial.md#trade-routes)

### Wayfinding 🔮
> Reading and following markers, paths, and terrain features.

- **Prerequisites (any one path):**
  - `tracking ≥ 3` AND `cartography ≥ 1`
  - OR pawn has followed a [Waypost](#waypost) or [Trail Marker](#trail-marker) successfully
- **Enables:**
  - Movement bonus when following marked paths
  - Ability to interpret [Map](#map) artifacts
  - Unlocks [Pathfinder](#pathfinder) role in groups

---

## Crafted Artifacts

### Waypost 🔮
> A simple wooden post with carved directional marks.

- **Prerequisites:**
  - `cartography ≥ 2` AND `timber × 2, cordage × 1`
  - OR pawn observes another pawn placing a waypost
- **Enables:**
  - Placed in world as a landmark entity
  - Nearby pawns with `wayfinding ≥ 1` can follow it
  - Encodes a single waypoint (resource, shelter, or route node)
  - Degrades over time unless maintained
- **Group impact:**
  - Tribal groups use wayposts to mark hunting grounds
  - Civic groups use wayposts to mark territory boundaries
  - Mercantile groups use wayposts to mark trade routes

---

### Trail Marker 🔮
> A series of carved stones or painted posts marking a route.

- **Prerequisites:**
  - `cartography ≥ 3` AND `stone × 3` OR `timber × 3, cordage × 2`
  - OR pawn has placed ≥ 2 wayposts and ponders improving them
- **Enables:**
  - Placed in world as a series of connected landmarks
  - Nearby pawns with `wayfinding ≥ 1` can follow the full route
  - Encodes a multi-stop route (e.g., water → food → shelter)
  - More durable than wayposts
- **Group impact:**
  - Tribal groups use trail markers for patrol routes
  - Civic groups use trail markers for supply routes
  - Mercantile groups use trail markers for trade caravans

---

### Map 🔮
> A drawn or painted representation of the known world.

- **Prerequisites:**
  - `cartography ≥ 5` AND `fiber × 5, herb × 2` (for ink/dye)
  - OR pawn has placed ≥ 3 trail markers and ponders consolidating them
- **Enables:**
  - Carried as an inventory item
  - Shared with other pawns to transfer spatial knowledge
  - Encodes multiple routes, landmarks, and resource locations
  - Does not degrade (unlike physical markers)
- **Group impact:**
  - Tribal groups use maps for coordinated hunts
  - Civic groups use maps for settlement planning
  - Mercantile groups use maps for route optimization

---

## Desire Paths

Desire paths are emergent terrain features created by repeated movement. They are the bridge between tribal scouts who find paths and civic groups who build roads.

### Path Formation
- **Trigger:** When ≥ 3 pawns or animals traverse the same ground tile within a time window
- **Visibility:** Pawns with `tracking ≥ 2` can see desire paths as faint ground markings
- **Movement bonus:** +10% speed when following a desire path
- **Recovery:** Desire paths fade over time (e.g., 1000 ticks) if not reinforced

### Path Types
- **Animal trails:** Created by animal movement, visible to `tracking ≥ 2`
- **Desire paths:** Created by pawn movement, visible to `wayfinding ≥ 1`
- **Beaten paths:** Desire paths reinforced by ≥ 10 traversals, visible to all pawns
- **Roads:** Beaten paths maintained by civic groups, visible to all pawns

### Path Maintenance
- **Tribal groups:** Maintain desire paths through regular patrol routes
- **Civic groups:** Beat desire paths into roads through construction
- **Mercantile groups:** Maintain roads for trade caravans

### Path Artifacts
- **Ground tattoos:** Painted or carved markings on beaten paths, visible to all pawns
- **Road signs:** Placed at intersections or junctions, encode route information
- **Milestones:** Placed at regular intervals along roads, encode distance and direction

---

## Integration with Existing Systems

### Tactical Memory
- Wayposts and trail markers are recorded as tactical memories
- Maps consolidate tactical memories into shareable artifacts
- Desire paths influence tactical memory by reinforcing route knowledge

### Group Commands
- Leaders can issue `patrol` commands along trail markers
- Leaders can issue `defend` commands at waypost locations
- Security contracts can reference map artifacts for route definitions

### Territory Management
- Wayposts mark territory boundaries for tribal groups
- Trail markers define patrol routes for civic groups
- Maps encode trade routes for mercantile groups

### Skill Unlocks
- `cartography` unlocks waypost, trail marker, and map crafting
- `wayfinding` unlocks movement bonuses and map interpretation
- `tracking` unlocks desire path visibility
- `leadership` unlocks route-based group commands

---

## Future Phases

### Phase 2: Cartographic Crafts
- Implement waypost, trail marker, and map crafting recipes
- Implement path placement and maintenance mechanics
- Implement desire path formation and visibility

### Phase 3: Route Economics
- Implement trade route profitability heuristics
- Implement route security contracts between groups
- Implement map sharing and knowledge transfer

### Phase 4: Settlement Planning
- Implement settlement layout optimization using maps
- Implement road network planning for civic groups
- Implement territory boundary management for tribal groups
