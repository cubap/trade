// Data-driven crafting recipes with skill requirements and material inputs

export const RECIPES = [
  {
    id: 'cordage',
    name: 'Simple Cordage',
    description: 'Twisted plant fiber rope',
    requiredSkills: { weaving: 1 },
    requiredItems: [
      { type: 'fiber', count: 3 }
    ],
    output: {
      type: 'cordage',
      name: 'Cordage',
      baseQuality: 1,
      tags: ['material', 'rope']
    },
    craftTime: 20, // ticks
    primarySkill: 'weaving',
    experience: 0.5 // skill gain on craft
  },
  {
    // #112. A pawn has two slots and the world holds far more than two things, yet
    // every other craft here makes something you spend. This one makes room. It is
    // deliberately as cheap as cordage and draws the extra fibre from the patch the
    // weaver is standing on, so a pawn with full hands can still weave its way out
    // of them - otherwise the cure for being overloaded would itself require
    // carrying the load.
    //
    // No requiredSkills, which is not an oversight: weaving is the skill this
    // recipe *pays* (primarySkill + experience), and nothing else in the game pays
    // practice into it. A weaving prerequisite here would be a locked door with the
    // key hanging on the inside of it - cordage asks for weaving 1 too, so with a
    // two-slot pack and no teacher there was no craft a fresh pawn could ever
    // finish. The basket is the root the textile branch was missing.
    id: 'basket',
    name: 'Basket',
    description: 'A woven vessel that gives a pair of hands somewhere else to put things',
    requiredItems: [
      {
        type: 'fiber',
        count: 3,
        allowSourceUse: true,
        sourceTag: 'fiber',
        sourceRange: 24
      }
    ],
    output: {
      type: 'basket',
      name: 'Basket',
      baseQuality: 1,
      tags: ['container', 'carrying'],
      slotType: 'container',
      increasesCapacity: { slots: 4, weight: 20, size: 15 },
      weight: 2,
      size: 2,
      stackable: false,
      maxStack: 1,
      durability: 30
    },
    craftTime: 30,
    primarySkill: 'weaving',
    experience: 0.8
  },
  {
    id: 'sharp_stone',
    name: 'Sharp Stone',
    description: 'Knapped flint cutting tool',
    requiredSkills: { knapping: 1 },
    requiredItems: [
      { type: 'rock', count: 2 },
      { type: 'stone', count: 1 }
    ],
    output: {
      type: 'sharp_stone',
      name: 'Sharp Stone',
      baseQuality: 1,
      tags: ['tool', 'cutting'],
      durability: 20,
      gatherBonus: 1.2 // 20% faster gathering
    },
    craftTime: 30,
    primarySkill: 'knapping',
    experience: 0.8
  },
  {
    id: 'stone_knife',
    name: 'Stone Knife',
    description: 'Sharp stone bound to wooden handle',
    requiredSkills: { knapping: 2, weaving: 1 },
    requiredItems: [
      { type: 'sharp_stone', count: 1 },
      { type: 'stick', count: 1 },
      { type: 'cordage', count: 1 }
    ],
    output: {
      type: 'stone_knife',
      name: 'Stone Knife',
      baseQuality: 2,
      tags: ['tool', 'weapon', 'cutting'],
      durability: 40,
      gatherBonus: 1.5,
      damageBonus: 2
    },
    craftTime: 40,
    primarySkill: 'knapping',
    experience: 1.2
  },
  {
    id: 'herb_mash',
    name: 'Herb Mash',
    description: 'Wet herbal mash prepared at a water source',
    requiredSkills: { herbalism: 1 },
    requiredItems: [
      { type: 'herb', count: 2 },
      {
        type: 'water',
        count: 1,
        allowSourceUse: true,
        sourceTag: 'water',
        sourceRange: 24,
        sourceConsumeAmount: 6
      }
    ],
    output: {
      type: 'herb_mash',
      name: 'Herb Mash',
      baseQuality: 1,
      tags: ['material', 'alchemy', 'cooking']
    },
    craftTime: 18,
    primarySkill: 'herbalism',
    experience: 0.4
  },
  {
    // The id is the recipe's name in every other vocabulary: the unlock table
    // grants recipes by id, the goal planner turns craft_<goal> into <goal> and
    // looks that up as an id, and this recipe's *output type* has always been
    // 'poultice'. While the id said 'simple_poultice' both of those lookups missed
    // silently, which is why no pawn could ever craft a poultice (#112).
    id: 'poultice',
    name: 'Simple Poultice',
    description: 'Prepared healing mash for wounds',
    requiredSkills: { herbalism: 2 },
    requiredItems: [
      { type: 'herb_mash', count: 1 },
      { type: 'herb', count: 1 }
    ],
    output: {
      type: 'poultice',
      name: 'Herbal Poultice',
      baseQuality: 1,
      tags: ['medical', 'consumable'],
      healing: 15,
      uses: 3
    },
    craftTime: 15,
    primarySkill: 'herbalism',
    experience: 0.6
  },
  {
    id: 'durable_cordage',
    name: 'Durable Cordage',
    description: 'Twisted cord from soaked fiber with improved durability',
    requiredSkills: { weaving: 2 },
    requiredItems: [
      { type: 'soaked_fiber', count: 3 }
    ],
    output: {
      type: 'durable_cordage',
      name: 'Durable Cordage',
      baseQuality: 1.2,
      tags: ['material', 'rope', 'durable'],
      durability: 30
    },
    craftTime: 28,
    primarySkill: 'weaving',
    experience: 0.8
  },
  {
    id: 'basic_shelter',
    name: 'Basic Shelter',
    description: 'Simple lean-to structure',
    requiredSkills: { construction_basics: 1 },
    // #120. This used to ask for 20 `grass`, and no item of type `grass` has ever
    // existed: grass patches are flora that browsers eat (`Grass.consume()` returns a
    // population count, not an item), and nothing in the tree makes thatch. The frame
    // now costs what the civic `build_structure` route has always cost - 8 sticks and
    // 4 fibre - plus two cords to lash it, so the two routes to a shelter are
    // comparable and neither is free.
    requiredItems: [
      { type: 'stick', count: 8 },
      { type: 'fiber', count: 4 },
      { type: 'cordage', count: 2 }
    ],
    // No `capacity`: a building you can put in your pack is a bug, not a storehouse.
    // `restBonus` is read by `createShelter` and lands on the entity (#120).
    output: {
      type: 'shelter',
      name: 'Lean-to Shelter',
      baseQuality: 1,
      tags: ['structure', 'cover', 'shelter'],
      restBonus: 1.3
    },
    craftTime: 100,
    primarySkill: 'construction_basics',
    experience: 2.0,
    // Honoured: `Pawn.craft` raises a Structure on the spot instead of handing back
    // an item. See solo/test/recipe-placement.test.js (#120).
    placeable: true
  }
]

// Helper to find recipe by id
export function getRecipe(id) {
  return RECIPES.find(r => r.id === id)
}

function countNearbySourceUnits(pawn, req) {
  const sourceTag = req.sourceTag ?? req.type
  const sourceRange = req.sourceRange ?? 24
  const consumePerUnit = req.sourceConsumeAmount ?? 1
  const entities = pawn?.world?.entitiesMap ? Array.from(pawn.world.entitiesMap.values()) : []

  return entities.reduce((total, entity) => {
    if (!entity || entity === pawn) return total
    const dx = (entity.x ?? 0) - (pawn.x ?? 0)
    const dy = (entity.y ?? 0) - (pawn.y ?? 0)
    if (Math.sqrt(dx * dx + dy * dy) > sourceRange) return total

    const tags = entity.tags
    const hasTag = Array.isArray(tags)
      ? tags.includes(sourceTag)
      : typeof tags?.has === 'function'
        ? tags.has(sourceTag)
        : false

    const matches = hasTag || entity.subtype === sourceTag || entity.type === sourceTag
    if (!matches) return total

    const quantity = Number.isFinite(entity.quantity) ? Math.max(0, entity.quantity) : 0
    if (quantity > 0) {
      return total + Math.floor(quantity / consumePerUnit)
    }

    if (entity.canConsume?.() || entity.canGather?.()) {
      return total + 1
    }

    return total
  }, 0)
}

// Get all recipes pawn can craft (has skills & materials)
export function getAvailableRecipes(pawn) {
  return RECIPES.filter(recipe => {
    // Check skills
    for (const [skill, level] of Object.entries(recipe.requiredSkills ?? {})) {
      if ((pawn.skills?.[skill] ?? 0) < level) return false
    }
    // Check unlocked recipes
    if (!pawn.unlocked?.recipes?.has(recipe.id)) return false
    return true
  })
}

// Check if pawn has materials for recipe
export function canCraftRecipe(pawn, recipe) {
  const inventory = pawn.inventory ?? []
  for (const req of recipe.requiredItems) {
    const inInventory = inventory.filter(item => item.type === req.type).length
    if (inInventory >= req.count) continue

    if (!req.allowSourceUse) return false
    const nearSource = countNearbySourceUnits(pawn, req)
    if ((inInventory + nearSource) < req.count) return false
  }
  return true
}

// Calculate quality based on skill level
export function calculateCraftQuality(pawn, recipe) {
  const primarySkill = pawn.skills?.[recipe.primarySkill] ?? 0
  const baseQuality = recipe.output.baseQuality ?? 1
  const skillBonus = primarySkill * 0.1
  const quality = baseQuality + skillBonus + (Math.random() * 0.3 - 0.15) // ±15% variance
  return Math.max(0.5, quality)
}

export default RECIPES
