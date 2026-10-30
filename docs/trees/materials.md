# Materials Tree

Materials are the raw and processed substances that feed crafting recipes, building projects, and trade. Discovery of a new material type typically widens a pawn's awareness of what is possible, creating back-pressure toward related skills and tools.

---

## Foraged / Surface Materials

### Grass ✅
>
> A tile-owned bundle of grasses harvested from open ground. Its mixed properties vary with biome and the remaining grass on the tile.

- **Prerequisites:** *(available from world spawn — no unlock required)*
- **Found via:** Harvestable grass stocks on ground-cover tiles in open biomes
- **Material properties:** Durability, rot resistance, flexibility, edibility, medicine, length, and mass are aggregated from the gathered mix. A pawn's skill can bias a targeted harvest toward a useful profile.
- **Enables:**
  - Input for [Tools › Sleeping Mat](tools.md#sleeping-mat)
  - Foraging from the same tile-grass stocks

---

### Fiber ✅
>
> Stripped plant fibres, typically from fiber plants or processed grass.

- **Prerequisites (any one path):**
  - Harvesting a fiber plant (`FiberPlant` entity)
- **Found via:** Fiber plant patches
- **Enables:**
  - Primary input for [Tools › Cordage](tools.md#cordage)
  - Item exposure triggers [Skills › Weaving](skills.md#weaving)
  - Path toward [Cloth](#cloth) via [Skills › Textile Work](skills.md#textile-work)

> A harvested grass bundle remains `grass`; it is not raw `fiber`. Grass is woven directly into a sleeping mat, while the separate fiber material supports cordage and other fiber recipes.

---

### Stick ✅
>
> Straight woody lengths broken or cut from shrubs and small trees.

- **Prerequisites:** *(surface gather — no unlock required)*
- **Found via:** Woodland and scrub tiles; also dropped by animal carcasses occasionally
- **Enables:**
  - Item exposure triggers [Skills › Knapping](skills.md#knapping) (combined with rock)
  - Input for [Tools › Stone Knife](tools.md#stone-knife), [Structures › Basic Shelter](structures.md#basic-shelter)
  - Path toward [Timber](#timber) awareness once pawn uses a stone axe

---

### Rock ✅
>
> Loose surface stones of various sizes.

- **Prerequisites:** *(surface gather — no unlock required)*
- **Found via:** Rocky terrain tiles, riverbanks, hillsides
- **Enables:**
  - Item exposure triggers [Skills › Knapping](skills.md#knapping) (combined with stick)
  - Input for [Tools › Sharp Stone](tools.md#sharp-stone)
  - Larger quantities suggest masonry potential (back-pressure toward [Skills › Masonry](skills.md#masonry))

---

### Stone ✅
>
> Specific, denser rock selected for knapping quality.

- **Prerequisites (any one path):**
  - Pawn selects from a rock cluster with `knapping ≥ 1`
  - OR item exposure: `rock ≥ 5`
- **Enables:**
  - Required second input for [Tools › Sharp Stone](tools.md#sharp-stone)
  - Signals structural potential — exposure back-pressures [Skills › Masonry](skills.md#masonry)

---

### Herb ✅
>
> Medicinal and edible plant matter gathered from herb clusters.

- **Prerequisites:** *(surface gather from herb plants)*
- **Found via:** Herb clusters in meadow and forest edge biomes
- **Enables:**
  - Item exposure triggers [Skills › Herbalism](skills.md#herbalism)
  - Input for [Tools › Simple Poultice](tools.md#simple-poultice)
  - Path toward [Alchemy](skills.md#alchemy) and [Medicine](skills.md#medicine)

---

### Forage Food ✅
>
> Berries, roots, fungi — edible material gathered while exploring.

- **Prerequisites:** *(found during exploration near food-source entities)*
- **Found via:** FoodSource entities in woodland and meadow biomes
- **Enables:**
  - Satisfies hunger need directly
  - Repeated collection feeds [Skills › Foraging](skills.md#foraging)

---

### Water ✅
>
> Fresh water sourced from streams, pools, and water sources.

- **Prerequisites:** *(found near WaterSource entities)*
- **Found via:** WaterSource entities
- **Enables:**
  - Satisfies thirst need
  - Carrying water requires a container — triggers `need_water_container` ponder problem
  - Proximity back-pressures clay discovery (clay found near water sources)

---

## Processed Materials

### Cordage ✅
>
> Twisted plant-fibre rope; an intermediate crafted material.

- **Prerequisites:**
  - Craft recipe: `fiber × 3` AND `weaving ≥ 1`
- **Enables:**
  - Required input for [Tools › Stone Knife](tools.md#stone-knife), [Structures › Basic Shelter](structures.md#basic-shelter)
  - Wider use as a binding component in many later recipes
  - Exposure back-pressures [Skills › Knot-Work / Rope Craft](skills.md#knot-work--rope-craft)

---

### Clay 🔮
>
> Wet mineral-rich earth found near water bodies; workable when moist.

- **Prerequisites (any one path):**
  - Digging near a water source tile
  - OR pawn exposure to a river-bank resource node
- **Found via:** Riverbank and lakeside dig sites
- **Enables:**
  - [Tools › Clay Pot](tools.md#clay-pot)
  - [Structures › Mud Hut](structures.md#mud-hut)
  - Item exposure triggers [Skills › Pottery](skills.md#pottery)
  - Fired to produce [Fired Brick](#fired-brick) — alternative structural path to stone

---

### Fired Brick 🔮
>
> Clay shaped and kiln-fired into a durable construction block.

- **Prerequisites (any one path):**
  - `pottery ≥ 3` AND structure exposure: `kiln ≥ 1`
  - OR item exposure: `clay ≥ 10` AND `construction_basics ≥ 2`
- **Enables:**
  - [Structures › Brick House](structures.md#brick-house)
  - [Structures › Kiln](structures.md#kiln) (recursive: kiln enables better bricks)
  - Cross-path structural alternative to [Timber Frame](structures.md#timber-frame-house) and [Stone Wall](structures.md#stone-wall)
  - *Back-pressure note:* A pawn who has built a stick shelter and later encounters clay and fire may recognize the potential for higher durability — reduced pondering difficulty.

---

### Timber 🔮
>
> Felled and cut logs yielding dimensional lumber for construction.

- **Prerequisites (any one path):**
  - Stone axe AND tree entity in range
  - OR item exposure: `stick ≥ 20` AND `construction_basics ≥ 2` (pawn reasons from sticks to logs)
- **Found via:** Tree entities (requires stone axe or better to fell)
- **Enables:**
  - [Skills › Carpentry](skills.md#carpentry)
  - [Structures › Timber Frame House](structures.md#timber-frame-house)
  - Larger quantities enable trade as a bulk commodity

---

### Cloth 🔮
>
> Woven fabric; processed from fiber or linen via textile work.

- **Prerequisites (any one path):**
  - `textile_work ≥ 2` AND `fiber ≥ 10` (bulk processing)
  - OR item exposure: `linen ≥ 3` AND `weaving ≥ 4`
- **Enables:**
  - Clothing items (warmth and social status)
  - High-value trade good
  - Required for advanced bags, sails (future)

---

### Hide 🔮
>
> Animal skin removed and cured after a successful hunt or butchery.

- **Prerequisites (any one path):**
  - `hunting ≥ 2` AND successful kill of medium or large animal
  - OR pawn performs butchery on a dead animal carcass
- **Enables:**
  - Leather (processed hide)
  - Clothing and armour items
  - Drum, shield, and other military/social items

---

### Bone 🔮
>
> Skeletal material from butchered animals; hard and workable.

- **Prerequisites (any one path):**
  - `hunting ≥ 1` AND butchery of any animal
- **Enables:**
  - Bone needle (fine craft tool)
  - Bone knife (alternative to stone)
  - Fertiliser (crumbled) — feeds farming path

---

### Linen 🔮
>
> Fine fibres of the flax plant; finer than grass fiber.

- **Prerequisites (any one path):**
  - Pawn encounters a flax plant (rarer fiber plant variant)
  - OR pawn with `weaving ≥ 3` observes linen cloth on another pawn or in trade
- **Enables:**
  - [Skills › Textile Work](skills.md#textile-work) lateral discovery if pawn already knows weaving
  - Higher-quality cloth for premium trade goods

---

### Metal Ore 🔮
>
> Mineral-bearing rock seams yielding copper, tin, or iron.

- **Prerequisites (any one path):**
  - `masonry ≥ 3` AND pawn explores underground or cliff-face tiles
  - OR `invention ≥ 10` AND direct exposure to a distinctive ore-coloured rock
- **Found via:** Deep rock seams, cliff tiles (requires digging or mining tools)
- **Enables:**
  - [Skills › Metallurgy](skills.md#metallurgy)
  - [Tools › Metal Blade](tools.md#metal-blade)
  - Valuable rare trade commodity even unworked

---

## Material Groups (for Lateral Discovery)

The crafting system recognises material *groups*. When a pawn knows a recipe using one material and encounters another in the same group, they may spontaneously ponder substitution:

| Group | Members |
|-------|---------|
| `fibers` | grass, fiber, linen, plant_fiber |
| `stones` | rock, stone, flint, obsidian |
| `woods` | stick, timber, plank, bamboo |
| `hides` | hide, leather, cloth, bark |
| `metals` | copper, tin, iron, bronze |
| `herbs` | herb, root, bark_strip, mushroom |
| `clays` | clay, fired_brick, ceramic |
