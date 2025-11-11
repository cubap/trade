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
    id: 'simple_poultice',
    name: 'Simple Poultice',
    description: 'Crushed herbs for healing',
    requiredSkills: { herbalism: 2 },
    requiredItems: [
      { type: 'herb', count: 3 }
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
    id: 'basic_shelter',
    name: 'Basic Shelter',
    description: 'Simple lean-to structure',
    requiredSkills: { construction_basics: 1 },
    requiredItems: [
      { type: 'stick', count: 10 },
      { type: 'grass', count: 20 },
      { type: 'cordage', count: 3 }
    ],
    output: {
      type: 'shelter',
      name: 'Lean-to Shelter',
      baseQuality: 1,
      tags: ['structure', 'cover', 'shelter'],
      capacity: 2,
      restBonus: 1.3
    },
    craftTime: 100,
    primarySkill: 'construction_basics',
    experience: 2.0,
    placeable: true // Creates structure entity in world
  }
]

// Helper to find recipe by id
export function getRecipe(id) {
  return RECIPES.find(r => r.id === id)
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
    const count = inventory.filter(item => item.type === req.type).length
    if (count < req.count) return false
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
