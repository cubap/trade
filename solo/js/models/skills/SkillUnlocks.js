// Data-driven skill/goal/recipe unlock definitions and evaluation helpers

// Each unlock entry:
// {
//   id: string,
//   description?: string,
//   conditions: {
//     skills?: { [skillName]: minLevel },
//     itemExposure?: { [itemType]: minCount },
//     structureExposure?: { [structureTag]: minCount },
//     craftedCounts?: { [recipeId]: minCount }   // craft() counts by recipe id
//   },
//   unlocks: {
//     skills?: string[],
//     goals?: string[],
//     recipes?: string[]   // recipe ids; an id that names no recipe unlocks nothing
//   }
// }

export const SKILL_UNLOCKS = [
  {
    id: 'weaving_cordage',
    description: 'Handling grasses reveals cordage and weaving basics',
    conditions: {
      skills: { manipulation: 1 },
      itemExposure: { grass: 3, fiber: 2 }
    },
    unlocks: {
      skills: ['weaving'],
      goals: ['craft_cordage'],
      recipes: ['cordage']
    }
  },
  {
    id: 'knapping_basics',
    description: 'Rocks and sticks suggest sharp-stone tools',
    conditions: {
      itemExposure: { rock: 3, stick: 2 }
    },
    unlocks: {
      skills: ['knapping'],
      goals: ['craft_sharp_stone']
    }
  },
  {
    id: 'construction_basics',
    description: 'Observing structures suggests basic construction',
    conditions: {
      structureExposure: { structure: 1 }
    },
    unlocks: {
      skills: ['construction_basics'],
      goals: ['build_shelter']
    }
  },
  {
    id: 'study_inspires_cartography',
    description: 'Studying at a school inspires basic map-making',
    conditions: {
      skills: { planning: 2 },
      structureExposure: { school: 1 }
    },
    unlocks: {
      skills: ['cartography']
    }
  },
  {
    id: 'simple_poultice',
    description: 'Handling herbs enables simple poultices',
    conditions: {
      skills: { herbalism: 2 },
      itemExposure: { herb: 2 }
    },
    unlocks: {
      recipes: ['poultice'],
      goals: ['craft_poultice']
    }
  },
  {
    // #112: the producer the carrying system was missing. The gate is the one a
    // pawn can actually meet - it has had fibre in its hands and looked at it -
    // rather than the weaving level or a cordage tally, because weaving practice
    // only ever comes *from* crafting and nothing was craftable: an unlock that
    // asks for the thing it exists to cause is a door that opens onto itself.
    // Only the recipe is granted, since the planner reads recipes and not
    // unlocked.goals; listing a craft goal here would be decoration.
    id: 'woven_container',
    description: 'Carrying loose fibre suggests weaving something that holds',
    conditions: {
      itemExposure: { fiber: 4 }
    },
    unlocks: {
      recipes: ['basket']
    }
  }
]

// Normalize string-key matches with simple heuristics
const hasMinSkills = (pawn, req = {}) => {
  for (const [skill, level] of Object.entries(req)) {
    if ((pawn.skills?.[skill] ?? 0) < level) return false
  }
  return true
}

const countFromMap = (map, key) => (map?.[key] ?? 0)

const hasMinItemExposure = (pawn, req = {}) => {
  const exp = pawn.itemExposure ?? {}
  for (const [type, min] of Object.entries(req)) {
    // Allow loose matching: if exact key not present, try regex against keys
    const exact = countFromMap(exp, type)
    if (exact >= min) continue
    const rx = new RegExp(`(^|_|-)${type}($|_|-)`, 'i')
    const sum = Object.entries(exp)
      .filter(([k]) => rx.test(String(k)))
      .reduce((s, [, v]) => s + (v ?? 0), 0)
    if (sum < min) return false
  }
  return true
}

const hasMinStructureExposure = (pawn, req = {}) => {
  const exp = pawn.structureExposure ?? {}
  for (const [tag, min] of Object.entries(req)) {
    if ((exp[tag] ?? 0) < min) return false
  }
  return true
}

const hasMinCraftedCounts = (pawn, req = {}) => {
  const crafted = pawn.craftedCounts ?? {}
  for (const [type, min] of Object.entries(req)) {
    if ((crafted[type] ?? 0) < min) return false
  }
  return true
}

export const isUnlockSatisfied = (pawn, unlock) => {
  const c = unlock.conditions ?? {}
  return (
    hasMinSkills(pawn, c.skills) &&
    hasMinItemExposure(pawn, c.itemExposure) &&
    hasMinStructureExposure(pawn, c.structureExposure) &&
    hasMinCraftedCounts(pawn, c.craftedCounts)
  )
}

export default SKILL_UNLOCKS
