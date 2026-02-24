# Tools Tree

Tools are carried items that augment a pawn's ability to gather, fight, craft, or carry. Most tools have a durability value and degrade with use. Higher-quality crafts (driven by skill level) start at higher durability and provide stronger bonuses.

Tools may be discovered through multiple material paths — for example, a cutting tool can come from knapped stone, a filed bone, or eventually a cast metal blade.

---

## Containers & Carrying

### Basket ✅
> Woven container expanding carry capacity beyond bare hands.

- **Prerequisites (any one path):**
  - Pawn ponders `inventory_full` problem AND `gathering ≥ 5`
  - OR `weaving ≥ 2` AND item exposure: `grass ≥ 5` OR `fiber ≥ 3`
  - OR pawn observes another pawn using a basket
- **Enables:**
  - Expanded inventory slots
  - Input for [Water Basket](#water-basket)
  - Demonstrates container concept → back-pressure toward [Clay Pot](#clay-pot)

---

### Water Basket ✅
> Woven and sealed basket for transporting water.

- **Prerequisites (any one path):**
  - Pawn ponders `need_water_container` AND `gathering ≥ 5, invention ≥ 3`
  - OR `weaving ≥ 3` AND pawn has carried water before and lost it
- **Enables:**
  - Water carrying over distance
  - Satisfies thirst need away from water sources
  - Leads toward [Clay Pot](#clay-pot) via lateral material substitution

---

### Clay Pot 🔮
> Fired ceramic vessel; more durable than woven containers.

- **Prerequisites (any one path):**
  - `pottery ≥ 1` AND item exposure: `clay ≥ 3`
  - OR pawn with water basket ponders durability problem AND `invention ≥ 5`
  - OR pawn observes clay pot in another pawn's inventory
- **Enables:**
  - Durable water/food storage
  - Cooking vessel (food quality improvements)
  - Trade good with consistent value

---

## Binding Materials

### Cordage ✅
> Twisted plant-fibre rope; used as a binding component.

- **Prerequisites:**
  - `weaving ≥ 1` AND `fiber × 3`
- **Enables:**
  - Component for [Stone Knife](#stone-knife), [Basic Shelter](structures.md#basic-shelter), [Bow](#bow)
  - Item triggers [Skills › Knot-Work / Rope Craft](skills.md#knot-work--rope-craft)
  - *See also:* [Materials › Cordage](materials.md#cordage)

---

## Cutting & Shaping Tools

### Sharp Stone ✅
> Knapped flint; a basic cutting edge.

- **Prerequisites (any one path):**
  - `knapping ≥ 1` AND `rock × 2, stone × 1`
  - OR pawn observes another pawn knapping
- **Gather bonus:** +20% gathering speed on fiber and sticks
- **Durability:** 20
- **Enables:**
  - Component for [Stone Knife](#stone-knife)
  - Awareness that sharper edges are achievable back-pressures toward better stones

---

### Sharp Bone 🔮
> Split and sharpened animal bone; cutting tool alternative to stone.

- **Prerequisites (any one path):**
  - `hunting ≥ 1` AND `bone × 2`
  - OR pawn with `knapping ≥ 1` handles bone and ponders shaping it
- **Gather bonus:** +15% gathering speed
- **Durability:** 15
- **Enables:**
  - Component alternative to sharp_stone in some recipes (lateral substitution)
  - Back-pressure toward full bone toolkit

---

### Stone Knife ✅
> Sharp stone bound to a handle with cordage.

- **Prerequisites:**
  - `knapping ≥ 2` AND `weaving ≥ 1`
  - AND `sharp_stone × 1, stick × 1, cordage × 1`
- **Gather bonus:** +50% gathering speed
- **Damage bonus:** +2
- **Durability:** 40
- **Enables:**
  - Butchering animals (unlocks [Materials › Hide](materials.md#hide), [Bone](materials.md#bone))
  - Required for [Stone Axe](#stone-axe) and [Spear](#spear)
  - Quality threshold ≥ 1.2 qualifies as trade good

---

### Stone Axe ✅
> Heavy stone tool for chopping wood.

- **Prerequisites (any one path):**
  - `knapping ≥ 3` AND `stone_knife × 1, stick × 2, cordage × 2`
  - OR pawn ponders `need_better_tools` AND `crafting ≥ 10`
- **Gather bonus:** Enables timber felling
- **Durability:** 60
- **Enables:**
  - [Materials › Timber](materials.md#timber) discovery
  - Path toward [Skills › Carpentry](skills.md#carpentry)
  - [Structures › Timber Frame House](structures.md#timber-frame-house)

---

### Metal Blade 🔮
> Cast or hammered metal cutting tool; far superior to stone.

- **Prerequisites (any one path):**
  - `metallurgy ≥ 3` AND structure exposure: `forge ≥ 1` AND `metal_ore × 5`
  - OR pawn observes a metal blade in use or in trade
- **Gather bonus:** +100% gathering speed
- **Damage bonus:** +5
- **Durability:** 120
- **Enables:**
  - All stone knife recipes at higher efficiency
  - Weapon crafting for military path
  - Premium trade good

---

### Wooden Mallet 🔮
> Heavy wooden head for driving stakes and joinery.

- **Prerequisites (any one path):**
  - `carpentry ≥ 1` AND `timber × 2`
  - OR `construction_basics ≥ 2` AND pawn ponders how to join timber
- **Durability:** 50
- **Enables:**
  - Joinery in timber-frame construction
  - Stake driving for fencing and palisade

---

## Healing Tools

### Simple Poultice ✅
> Crushed herbs applied to wounds for basic healing.

- **Prerequisites:**
  - `herbalism ≥ 2` AND `herb × 3`
- **Healing:** 15 HP over 3 uses
- **Durability:** 3 uses
- **Enables:**
  - Healing self or others
  - Back-pressure toward [Medicine](skills.md#medicine) when applied to another pawn

---

## Ranged & Combat Tools

### Spear 🔮
> Sharpened point hafted on a long shaft.

- **Prerequisites (any one path):**
  - `knapping ≥ 2` AND `sharp_stone × 1, stick × 3, cordage × 2`
  - OR `hunting ≥ 1` AND pawn ponders need for reach while hunting
- **Damage bonus:** +4 (thrown: +6)
- **Durability:** 30
- **Enables:**
  - Safer hunting of larger animals
  - Military path gear
  - [Skills › Hunting](skills.md#hunting) progression

---

### Bow 🔮
> Flexible stave and cordage string for propelling arrows.

- **Prerequisites (any one path):**
  - `knapping ≥ 3` AND `hunting ≥ 2` AND `stick × 3, cordage × 2`
  - OR `knot_work ≥ 2` AND pawn observes a bow in use
- **Durability:** 40
- **Enables:**
  - [Arrow](#arrow) crafting
  - Ranged hunting without risk
  - Archery skill progression (sub-skill of [Hunting](skills.md#hunting))

---

### Arrow 🔮
> Fletched shaft with knapped or metal tip.

- **Prerequisites:**
  - `knapping ≥ 2` AND `sharp_stone × 1, stick × 1, grass/feather × 1`
  - OR `metallurgy ≥ 1` AND `metal_blade` known (metal tip variant)
- **Durability:** 5 (consumed on use)
- **Enables:**
  - Ranged attack (requires bow)
  - Hunting at distance

---

## Agricultural & Crafting Tools

### Digging Stick 🔮
> Hardened wooden rod for loosening soil and digging.

- **Prerequisites (any one path):**
  - `gathering ≥ 3` AND `stick × 2` AND pawn ponders reaching buried resources
  - OR `construction_basics ≥ 1` AND pawn digs near a water source
- **Durability:** 25
- **Enables:**
  - [Materials › Clay](materials.md#clay) discovery
  - Early farming / planting
  - Well digging (with construction_basics ≥ 2)

---

### Bone Needle 🔮
> Fine bone implement for sewing and detailed craft.

- **Prerequisites (any one path):**
  - `hunting ≥ 1` AND `bone × 1` AND `knapping ≥ 1`
  - OR pawn with `textile_work ≥ 1` ponders finer stitching
- **Durability:** 20
- **Enables:**
  - Clothing construction
  - Hide-working quality bonus
  - Leads to [Skills › Tailoring](skills.md#textile-work) (lateral)
