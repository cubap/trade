# Structures Tree

Structures are placeable entities that persist in the world, provide buffs to nearby pawns, and signal civilisational development. Most structures can be reached via multiple material paths — the same functional outcome (shelter, storage, production) may be achievable with woven fibres, timber, clay, or stone, though durability and maintenance costs differ.

Structures degrade over time unless maintained. A pawn familiar with a more durable construction technique may recognise the limitations of an existing structure and be back-pressured to upgrade it.

---

## Shelters

### Basic Shelter ✅
> A simple angled windbreak of sticks and grass (lean-to).

- **Prerequisites (any one path):**
  - `construction_basics ≥ 1` AND `stick × 10, grass × 20, cordage × 3`
  - OR pawn ponders `need_shelter` AND `crafting ≥ 5, invention ≥ 5`
  - OR pawn observes another pawn building or sleeping in a lean-to
- **Capacity:** 2 pawns
- **Rest bonus:** ×1.3
- **Deterioration:** standard rate
- **Enables:**
  - Structure exposure triggers `construction_basics` for nearby pawns
  - Back-pressures recognition of better materials (clay, stone, timber)
  - Required for [Civic › Proto-Settlement](civic-industrial.md#proto-settlement) formation threshold

---

### Woven Hut 🔮
> A larger, fully enclosed woven-fibre structure.

- **Prerequisites (any one path):**
  - `weaving ≥ 3` AND `construction_basics ≥ 2` AND `fiber × 30, stick × 15, cordage × 5`
  - OR pawn has built ≥ 2 lean-tos and ponders improving on them
  - OR pawn observes a woven hut in another settlement
- **Capacity:** 4 pawns
- **Rest bonus:** ×1.5
- **Enables:**
  - More durable than lean-to; same functions with reduced maintenance
  - Structure exposure back-pressures timber/clay alternatives
  - Cross-path: [Timber Frame House](#timber-frame-house) or [Mud Hut](#mud-hut) as alternatives

---

### Mud Hut 🔮
> Walls daubed with clay over a stick frame; hardened by sun or fire.

- **Prerequisites (any one path):**
  - `construction_basics ≥ 2` AND `pottery ≥ 1` AND `clay × 20, stick × 10, grass × 10`
  - OR pawn builds lean-to near clay deposits and ponders durability improvement
  - OR pawn observes a mud hut and has `construction_basics ≥ 1`
- **Capacity:** 4 pawns
- **Rest bonus:** ×1.6
- **Enables:**
  - More weather-resistant than woven hut
  - Back-pressures [Fired Brick House](#brick-house) and kiln knowledge
  - Cross-path alongside [Woven Hut](#woven-hut) and [Timber Frame House](#timber-frame-house)

---

### Timber Frame House 🔮
> Jointed timber posts and beams infilled with wattle and daub or planks.

- **Prerequisites (any one path):**
  - `carpentry ≥ 2` AND `construction_basics ≥ 2` AND `timber × 10, stick × 5, cordage × 5`
  - OR pawn uses stone axe on trees and ponders large-scale building
  - OR pawn observes a timber frame structure in a settlement
- **Capacity:** 6 pawns
- **Rest bonus:** ×1.7
- **Enables:**
  - Multi-room expansion possible (linked structures)
  - Foundation for [Workshop](#workshop)
  - Requires [Materials › Timber](materials.md#timber) supply → back-pressures forestry awareness

---

### Brick House 🔮
> Coursed fired-brick walls; slow to build but very durable.

- **Prerequisites (any one path):**
  - `masonry ≥ 2` AND `pottery ≥ 3` AND `fired_brick × 50, cordage × 5`
  - OR `construction_basics ≥ 3` AND pawn has built mud hut AND has kiln access
  - OR pawn observes fired brick in a settlement
- **Capacity:** 8 pawns
- **Rest bonus:** ×2.0
- **Deterioration:** reduced rate (×0.5)
- **Enables:**
  - Most durable housing; reduces maintenance burden
  - Path toward [Stone Wall](#stone-wall) and formal settlement buildings
  - *Note:* Back-pressure from stick/woven shelters — a pawn who has built in wood and experimented with clay may reason toward brick with lower pondering cost

---

## Storage

### Storage Pit 🔮
> A dug depression lined with sticks or clay for communal food storage.

- **Prerequisites (any one path):**
  - `gathering ≥ 5` AND `construction_basics ≥ 1` AND pawn ponders surplus-management
  - OR `digging_stick` in inventory AND pawn has surplus forage_food
- **Capacity:** 20 item-slots
- **Enables:**
  - Communal food storage (shared between bonded pawns)
  - Back-pressures group formation / proto-settlement
  - Required for [Civic › Hamlet](civic-industrial.md#hamlet) classification

---

### Granary 🔮
> Raised timber or stone structure protecting stored grain and seeds.

- **Prerequisites (any one path):**
  - `carpentry ≥ 2` AND `construction_basics ≥ 3` AND `timber × 15`
  - OR `masonry ≥ 2` AND `fired_brick × 30`
- **Capacity:** 100 item-slots
- **Enables:**
  - Seasonal food security
  - Required for [Civic › Village](civic-industrial.md#village) threshold
  - Trade surplus in food commodities

---

## Production Structures

### Kiln 🔮
> Clay and stone oven for firing ceramics and bricks.

- **Prerequisites (any one path):**
  - `pottery ≥ 2` AND `construction_basics ≥ 2` AND `clay × 30, rock × 10`
  - OR pawn ponders upgrading pottery with fire knowledge AND `invention ≥ 8`
- **Enables:**
  - [Materials › Fired Brick](materials.md#fired-brick) production
  - Better quality [Clay Pot](tools.md#clay-pot) output
  - Structure exposure back-pressures [Skills › Metallurgy](skills.md#metallurgy)
  - Cross-path: kiln enables [Forge](#forge) via metallurgy

---

### Workshop 🔮
> Dedicated structure providing quality and speed bonuses to crafting.

- **Prerequisites (any one path):**
  - `construction_basics ≥ 3` AND any house structure present
  - Timber path: `carpentry ≥ 2` AND `timber × 10, cordage × 5`
  - Stone path: `masonry ≥ 2` AND `stone × 20`
  - `planning ≥ 2` AND group size ≥ 3 (organised labour)
- **Craft bonus:** ×1.3 quality, ×1.2 speed
- **Enables:**
  - Structure exposure triggers `planning` for nearby pawns
  - Required for [Civic › Town](civic-industrial.md#town) threshold
  - Required for [Mercantile › Shop](mercantile-entrepreneurial.md#shop)

---

### Forge 🔮
> High-temperature furnace for smelting ore and shaping metal.

- **Prerequisites (any one path):**
  - `metallurgy ≥ 3` AND structure: `kiln ≥ 1` AND `stone × 30, clay × 20`
  - OR `invention ≥ 12` AND pawn has processed metal ore AND ponders heat application
- **Enables:**
  - [Tools › Metal Blade](tools.md#metal-blade) production
  - Metal construction components
  - Required for advanced industrial progression

---

## Civic Infrastructure

### Stone Wall 🔮
> Cut-stone defensive and boundary wall segment.

- **Prerequisites (any one path):**
  - `masonry ≥ 3` AND `stone × 20`
  - OR pawn in a clan with territorial intent ponders boundary marking AND `construction_basics ≥ 2`
- **Enables:**
  - Territory demarcation
  - Defence bonus for settlement
  - Required for [Civic › Town](civic-industrial.md#town) formal boundary

---

### Well 🔮
> Dug shaft lined with stone or brick reaching a water table.

- **Prerequisites (any one path):**
  - `masonry ≥ 2` AND `construction_basics ≥ 3` AND `stone × 15` AND `digging_stick` in inventory
  - OR `pottery ≥ 2` AND `fired_brick × 20` AND `construction_basics ≥ 2`
- **Enables:**
  - Permanent water supply independent of surface water sources
  - Required for [Civic › Village](civic-industrial.md#village)
  - Removes pawn thirst travel time

---

### Watchtower 🔮
> Elevated timber or stone platform for spotting threats and resources.

- **Prerequisites (any one path):**
  - `carpentry ≥ 3` AND `timber × 15, cordage × 5`
  - OR `masonry ≥ 3` AND `stone × 25`
  - Tribal path: `leadership ≥ 2` AND clan territory established
- **Enables:**
  - Extended perception radius for all pawns in area
  - Defensive bonus against raid events
  - [Tribal-Military › Territory Claim](tribal-military.md#territory-claim)

---

### School 🔮
> A dedicated structure for organised knowledge transfer.

- **Prerequisites (any one path):**
  - `planning ≥ 3` AND `workshop ≥ 1` structure nearby
  - OR `storytelling ≥ 5` AND group size ≥ 5
- **Enables:**
  - Structure exposure unlocks [Skills › Cartography](skills.md#cartography)
  - Accelerated teaching events for all skills
  - Knowledge diffusion lowers invention difficulty for known domains
  - Required for [Civic › Guild Formation](civic-industrial.md#educational-guild)

---

### Market 🔮
> Open trading space with stalls for regular commerce.

- **Prerequisites (any one path):**
  - `bartering ≥ 3` AND `workshop ≥ 1` structure nearby AND group size ≥ 4
  - OR multiple caravan visits to a location establish informal market
- **Enables:**
  - Regular price discovery events
  - Attracts merchant pawns and caravans
  - Required for [Mercantile › Price Discovery](mercantile-entrepreneurial.md#price-discovery)
  - Raises civic and mercantile scores of the settlement
