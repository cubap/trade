# Skills Tree

Skills are capability ratings (0–100) that unlock new goals, recipes, and social roles. They are gained through practice, observation, teaching, and pondering. Skill decay applies to unused skills over time (configurable via `InventionConfig.js`).

Each entry lists the conditions that cause the skill to **first become available** (unlock), not the conditions needed to level it up — levelling happens naturally through use.

---

## Foundational Skills

### Manipulation ✅
> Baseline fine-motor competence; every pawn starts with a small amount.

- **Prerequisites:** *(baseline — no unlock required)*
- **Enables:**
  - Unlocks [Weaving](#weaving) when combined with grass/fiber exposure
  - Required by most crafting interactions

---

### Gathering ✅
> Knowing where and how to collect raw materials efficiently.

- **Prerequisites:**
  - Pawn has picked up any resource at least once *(automatic)*
- **Enables:**
  - Faster resource acquisition
  - [Tools › Sharp Stone](tools.md#sharp-stone) gather bonus applies once skill grows
  - Back-pressure into [Materials › Fiber](materials.md#fiber), [Stick](materials.md#stick)

---

### Exploration ✅
> Reading terrain and remembering where resources were seen.

- **Prerequisites:**
  - Pawn has moved beyond starting area *(automatic)*
- **Enables:**
  - Resource memory system
  - Unlocks [Tracking](#tracking) after repeated use

---

## Craft-Domain Skills

### Weaving ✅
> Braiding and interlacing fibrous materials into useful objects.

- **Prerequisites (any one path):**
  - `manipulation ≥ 1` AND item exposure: `grass ≥ 3, fiber ≥ 2`
  - OR pawn observes another pawn crafting cordage or basket
- **Enables:**
  - Recipe: [Tools › Cordage](tools.md#cordage)
  - Recipe: [Tools › Basket](tools.md#basket)
  - Synergy into [Knot-Work / Rope Craft](#knot-work--rope-craft), [Textile Work](#textile-work)

---

### Knapping ✅
> Shaping stone by controlled fracture.

- **Prerequisites (any one path):**
  - Item exposure: `rock ≥ 3, stick ≥ 2`
  - OR pawn observes another pawn crafting a sharp stone
- **Enables:**
  - Recipe: [Tools › Sharp Stone](tools.md#sharp-stone)
  - At `knapping ≥ 2`: Recipe: [Tools › Stone Knife](tools.md#stone-knife)
  - Synergy into Stonework 🔮, Tool Making 🔮

---

### Herbalism ✅
> Recognising and using plants for medicine and food.

- **Prerequisites (any one path):**
  - Item exposure: `herb ≥ 2`
  - OR proximity to a pawn with `herbalism ≥ 3` for several ticks
- **Enables:**
  - At `herbalism ≥ 2`: Recipe: [Tools › Simple Poultice](tools.md#simple-poultice)
  - Synergy into [Alchemy](#alchemy), [Medicine](#medicine), [Foraging](#foraging)

---

### Construction Basics ✅
> Planning and assembling simple load-bearing structures.

- **Prerequisites (any one path):**
  - Structure exposure: `structure ≥ 1` (pawn has been near any structure)
  - OR `crafting ≥ 5` AND `stick` exposure ≥ 10
  - OR pawn observes another pawn completing a shelter build
- **Enables:**
  - Recipe: [Structures › Basic Shelter](structures.md#basic-shelter)
  - Synergy into [Masonry](#masonry), [Carpentry](#carpentry)
  - Back-pressure: knowing what a shelter can be makes a pawn more alert to better materials (clay, stone)

---

## Social & Cognitive Skills

### Invention ✅
> Creative problem-solving and discovery through pondering.

- **Prerequisites (any one path):**
  - Pawn has pondered any problem at least once *(automatic after inventory-full event)*
  - OR `manipulation ≥ 2` AND `crafting ≥ 3`
- **Enables:**
  - Drives the [Knowledge › Pondering System](knowledge.md#pondering)
  - Higher level → greater discovery chance per pondering cycle
  - Synergy: each 1% level adds 1% discovery chance

---

### Experimentation ✅
> Systematic trial-and-error with materials and tools.

- **Prerequisites (any one path):**
  - `invention ≥ 1`
  - OR item exposure variety ≥ 5 distinct types
- **Enables:**
  - Secondary bonus to pondering discovery chance (0.5% per level)
  - Unlocks lateral material-substitution discoveries
  - Synergy into invention

---

### Planning ✅
> Organising multi-step tasks and resources in advance.

- **Prerequisites (any one path):**
  - `crafting ≥ 3` AND `construction_basics ≥ 1`
  - OR pawn is designated coordinator of a group
- **Enables:**
  - Improves goal-decomposition efficiency
  - At `planning ≥ 2` AND structure exposure `school ≥ 1`: unlocks [Cartography](#cartography)

---

### Cartography 🔮
> Recording and sharing maps of the known world.

- **Prerequisites (any one path):**
  - `planning ≥ 2` AND structure exposure: `school ≥ 1`
  - OR `exploration` high AND pawn has visited ≥ 3 distinct resource clusters
- **Enables:**
  - Longer resource memory retention
  - Ability to share memory with other pawns
  - At `cartography ≥ 2`: unlocks [Waypost](cartography.md#waypost) crafting
  - At `cartography ≥ 3`: unlocks [Trail Marker](cartography.md#trail-marker) crafting
  - At `cartography ≥ 5`: unlocks [Map](cartography.md#map) crafting
  - Facilitates [Mercantile › Trade Routes](mercantile-entrepreneurial.md#trade-routes)
- **See also:** [Cartography and Wayfinding](cartography.md) — full skill progression, crafted artifacts, and desire path system

---

### Wayfinding 🔮
> Reading and following markers, paths, and terrain features.

- **Prerequisites (any one path):**
  - `tracking ≥ 3` AND `cartography ≥ 1`
  - OR pawn has followed a [Waypost](cartography.md#waypost) or [Trail Marker](cartography.md#trail-marker) successfully
- **Enables:**
  - Movement bonus when following marked paths
  - Ability to interpret [Map](cartography.md#map) artifacts
  - Unlocks [Pathfinder](cartography.md#pathfinder) role in groups
- **See also:** [Cartography and Wayfinding](cartography.md) — desire path system and route economics

---

### Storytelling ✅
> Transmitting knowledge and inspiration through narrative.

- **Prerequisites (any one path):**
  - `cooperation ≥ 3`
  - OR `social` need satisfied repeatedly in group context
- **Enables:**
  - `hearStory()` inspiration events for nearby pawns
  - Chance to unlock legendary/rare recipes through inspiration
  - Synergy into [Knowledge › Social Learning](knowledge.md#social-learning)

---

### Cooperation ✅
> Working alongside others toward shared objectives.

- **Prerequisites (any one path):**
  - Pawn completes any collaborative goal (`collaborative_craft`, `teach_skill`, etc.)
  - OR pawn in bonded pair with mutual bond score > 20
- **Enables:**
  - Collaborative craft quality bonus
  - Unlocks `teach_skill` and `collaborative_craft` goal types
  - Synergy into [Leadership](#leadership), [Storytelling](#storytelling)

---

### Leadership 🔮
> Coordinating group actions and inspiring higher performance.

- **Prerequisites (any one path):**
  - `cooperation ≥ 5` AND high reputation in group
  - OR pawn designated coordinator via group-formation threshold
- **Enables:**
  - Group tactical commands (follow, flank, protect)
  - Temporary skill bonuses to group members
  - Required for [Tribal-Military › Clan Formation](tribal-military.md#clan-formation)

---

## Advanced / Specialist Skills

### Hunting 🔮
> Tracking, cornering, and taking down animal prey.

- **Prerequisites (any one path):**
  - `tracking ≥ 2` AND pawn has observed an animal ≥ 5 times
  - OR `knapping ≥ 2` AND direct combat with animal
- **Enables:**
  - Access to [Materials › Hide](materials.md#hide), [Bone](materials.md#bone)
  - Synergy: `hunting → tracking, archery, spear_fighting, butchery`

---

### Tracking 🔮
> Reading signs left by people, animals, and weather.

- **Prerequisites (any one path):**
  - Pawn has followed the same entity for several consecutive ticks
  - OR `exploration` high AND pawn has visited ≥ 2 distinct animal territories
- **Enables:**
  - Increases range at which pawns notice resources and entities
  - Required for [Hunting](#hunting)

---

### Masonry 🔮
> Shaping and stacking stone for durable construction.

- **Prerequisites (any one path):**
  - `knapping ≥ 3` AND `construction_basics ≥ 2`
  - OR structure exposure: `stone_wall ≥ 1`
- **Enables:**
  - [Structures › Stone Wall](structures.md#stone-wall)
  - [Structures › Well](structures.md#well)
  - Synergy into [Metallurgy](#metallurgy)

---

### Pottery 🔮
> Forming and firing clay vessels.

- **Prerequisites (any one path):**
  - Item exposure: `clay ≥ 5` AND `construction_basics ≥ 1`
  - OR pawn observes a kiln or another pawn using clay
- **Enables:**
  - [Tools › Clay Pot](tools.md#clay-pot)
  - [Structures › Kiln](structures.md#kiln)
  - Cross-path: clay structures as alternative to woven/timber shelters

---

### Metallurgy 🔮
> Smelting ore into workable metal.

- **Prerequisites (any one path):**
  - `masonry ≥ 3` AND structure exposure: `kiln ≥ 1`
  - OR `invention ≥ 10` AND direct exposure to raw metal ore
- **Enables:**
  - [Tools › Metal Blade](tools.md#metal-blade)
  - [Structures › Forge](structures.md#forge)

---

### Carpentry 🔮
> Shaping and joining timber into structural components.

- **Prerequisites (any one path):**
  - `knapping ≥ 2` AND `construction_basics ≥ 2` AND item exposure: `timber ≥ 3`
  - OR pawn uses stone axe to fell a tree and observes the result
- **Enables:**
  - [Structures › Timber Frame House](structures.md#timber-frame-house)
  - [Tools › Wooden Mallet](tools.md#wooden-mallet)

---

### Bartering 🔮
> Negotiating exchanges of goods between parties.

- **Prerequisites (any one path):**
  - `cooperation ≥ 3` AND pawn has surplus items in inventory
  - OR proximity to a pawn with high `valuation` skill
- **Enables:**
  - Trade interactions between pawns
  - Required for [Mercantile › Price Discovery](mercantile-entrepreneurial.md#price-discovery)

---

### Valuation 🔮
> Estimating the worth of goods relative to each other and to needs.

- **Prerequisites (any one path):**
  - `bartering ≥ 2` AND `crafting ≥ 5`
  - OR pawn has completed multiple trades with different partners
- **Enables:**
  - Improved trade margins
  - Required for [Mercantile › Shop Entity](mercantile-entrepreneurial.md#shop)

---

### Textile Work 🔮
> Processing raw fibres into cloth and finished fabric.

- **Prerequisites (any one path):**
  - `weaving ≥ 4`
  - OR item exposure: `linen ≥ 3`
- **Enables:**
  - [Materials › Cloth](materials.md#cloth)
  - Higher quality clothing and trade goods

---

### Knot-Work / Rope Craft 🔮
> Specialised knotting and cordage for rigging, traps, and construction.

- **Prerequisites (any one path):**
  - `weaving ≥ 3` AND `construction_basics ≥ 1`
- **Enables:**
  - Improved shelter cordage efficiency
  - Trap construction for hunting
  - Ship or raft rigging (future)

---

### Foraging 🔮
> Identifying edible wild plants and fungi beyond basic gathering.

- **Prerequisites (any one path):**
  - `herbalism ≥ 2` AND `exploration` high
  - OR proximity to pawn with `foraging ≥ 3`
- **Enables:**
  - Additional food sources without farming
  - Synergy: `foraging → herbalism, gathering`

---

### Alchemy 🔮
> Combining materials to create potions, pigments, and compounds.

- **Prerequisites (any one path):**
  - `herbalism ≥ 5` AND `invention ≥ 5`
  - OR `pottery ≥ 2` AND exposure to diverse herb types ≥ 4
- **Enables:**
  - Advanced medicines and poisons
  - Pigment dyes for trade goods
  - Cross-path: alchemical knowledge feeds metallurgy

---

### Medicine 🔮
> Diagnosing and treating wounds and illness in self and others.

- **Prerequisites (any one path):**
  - `herbalism ≥ 3` AND `cooperation ≥ 2`
  - OR pawn has used a poultice on another pawn
- **Enables:**
  - Healing others (not just self)
  - Reduces recovery time in groups
  - Required for [Civic › Healer Role](civic-industrial.md#healer)
