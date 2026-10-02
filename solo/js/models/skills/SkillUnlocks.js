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
//     skills?: string[],   // qualifications: the pawn is paid the first level
//     goals?: string[],    // craft ideas: 'craft_<recipeId>', read by chooseCraft
//     recipes?: string[]   // recipe ids; an id that names no recipe unlocks nothing
//   }
// }
//
// Three rules keep this table from lying about what it does (issues #115/#116/#117):
//
// 1. Every recipe is either granted by an entry below or named in
//    UNREACHABLE_RECIPES with a reason. A recipe nobody grants is content
//    that cannot be reached, which is indistinguishable from dead code.
// 2. `skills` entries qualify rather than merely announce. evaluateSkillUnlocks
//    tops the skill up to level 1, because gate code (getAvailableRecipes and
//    the craft executors) reads pawn.skills, not unlocked.skills. An entry must
//    not *require* a skill it also grants - that is a door that opens onto itself.
// 3. `goals` entries are ideas, and the name is the convention the table already
//    used: craft_<recipeId>. chooseCraft prefers the most recently granted idea
//    over the order Recipes.js happens to file things in, so a goal listed here
//    changes what the pawn reaches for. A goal that names no recipe is decoration.

export const SKILL_UNLOCKS = [
  {
    id: 'weaving_cordage',
    description: 'Handling grasses reveals cordage and weaving basics',
    conditions: {
      skills: { manipulation: 1 },
      // #120: this asked for 3 `grass`, and no item of type `grass` has ever existed.
      // Grass is flora a browser eats (`Grass.consume()` returns a population count,
      // there is no `gather()`), and nothing in the tree makes thatch - so cordage,
      // the first rung of the whole crafting ladder, could never be learned and every
      // recipe behind it (durable_cordage, and now `basic_shelter`, which lashes its
      // frame with two cords) was unreachable through a phantom material. Fibre from a
      // fibre plant is the same discovery made with the hands the world actually has.
      // #129 is the ticket for giving grass something to be.
      itemExposure: { fiber: 3 }
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
      goals: ['craft_sharp_stone'],
      // #115: sharp_stone was the only knapping recipe in the book and nothing
      // granted it, so the entry above announced a tool idea the planner could
      // never act on. The recipe needs knapping 1, which is this entry's own
      // qualification, so the idea and the skill arrive together.
      recipes: ['sharp_stone']
    }
  },
  {
    // #120: this entry used to grant a `build_shelter` goal, then (in #115) nothing
    // at all - so `basic_shelter`, the only recipe in the book that is a building
    // rather than a burden, was unreachable twice over: no pawn could ever have it
    // unlocked, and its `placeable` flag was read by nobody while its 20 grass asked
    // for an item that does not exist. It now grants the recipe and the idea, and the
    // recipe costs sticks, fibre and cordage a pawn can actually gather.
    // The skill stays as the qualification, because the craft gate reads pawn.skills.
    id: 'construction_basics',
    description: 'Observing structures suggests basic construction',
    conditions: {
      structureExposure: { structure: 1 }
    },
    unlocks: {
      skills: ['construction_basics'],
      goals: ['craft_basic_shelter'],
      recipes: ['basic_shelter']
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
    // pawn can actually meet - it has had fibre in its hands - rather than the
    // weaving level or a cordage tally, because weaving practice only ever comes
    // *from* crafting and nothing was craftable: an unlock that asks for the
    // thing it exists to cause is a door that opens onto itself.
    // The craft goal is listed again now that #117 made goals real: chooseCraft
    // prefers the last idea the pawn had, so this entry says what the pawn
    // reaches for and not merely what it is permitted to reach for.
    id: 'woven_container',
    description: 'Carrying loose fibre suggests weaving something that holds',
    conditions: {
      itemExposure: { fiber: 4 }
    },
    unlocks: {
      recipes: ['basket'],
      goals: ['craft_basket']
    }
  },
  {
    // #115: herb_mash sat between "picked an herb" and "made a poultice" with
    // nothing granting it, so the poultice entry below - which asks for the
    // herbalism that only mashing builds up to - could not be reached. The gate
    // is handling two herbs; the qualification is the first level of herbalism,
    // which is what the recipe asks for.
    id: 'mashed_herbs',
    description: 'Crushed herbs suggest mashing them into something',
    conditions: {
      itemExposure: { herb: 2 }
    },
    unlocks: {
      skills: ['herbalism'],
      recipes: ['herb_mash'],
      goals: ['craft_herb_mash']
    }
  },
  {
    // #115: stone_knife needs knapping 2 and weaving 1, which a pawn earns by
    // actually knapping two edges and twisting a cord, so the gate is the tally
    // of that work rather than the levels it produces.
    id: 'bound_stone_tools',
    description: 'Binding a knapped edge suggests a proper knife',
    conditions: {
      craftedCounts: { sharp_stone: 2, cordage: 1 }
    },
    unlocks: {
      recipes: ['stone_knife'],
      goals: ['craft_stone_knife']
    }
  },
  {
    // #121: the recipe that needed an ingredient no pawn could obtain.
    // `durable_cordage` asks for three `soaked_fiber`, and soaked fibre comes
    // from one place - a ResourceCache holding a soaking job, which
    // `startFiberSoakAtCache()` used to create for nobody but a test. The
    // technique was finished; what was missing was a reason to use it. This gate
    // is the reason: two cords twisted is a pawn noticing which fibre holds and
    // which snaps, and the answer is "the one that rotted a day first". The
    // errand this sends the pawn off to (`soak_fiber` in PawnGoals) is not a
    // craft idea, so it cannot be listed in `goals` - the goals list is recipe
    // ideas only - and is driven off the unlocked recipe instead.
    id: 'soaking_pit',
    description: 'Twisting two cords suggests soaking the fibre that will hold',
    conditions: {
      craftedCounts: { cordage: 2 }
    },
    unlocks: {
      recipes: ['durable_cordage'],
      goals: ['craft_durable_cordage']
    }
  }
]

// #115: recipes the table deliberately does not grant. The guard test asserts
// this set exactly, so a recipe is unreachable on purpose or not at all - an
// empty list is a claim, not an absence.
//
// `basic_shelter` was the last exemption (#120). It was unreachable twice over: no
// entry granted it, and its inputs asked for 20 grass, an item no entity in the tree
// can yield (grass patches are flora a browser eats; nothing gathers thatch). The
// `construction_basics` entry now grants it, the frame is priced in sticks, fibre and
// cordage, and `placeable` is honoured - `Pawn.craft` raises a Structure on the spot
// through the same `createShelter` factory the civic `build_structure` goal uses, so
// a pawn never carries a building in its pack.
export const UNREACHABLE_RECIPES = {}

// Every recipe id the table grants, for the guard test and for anyone reading
// the table to see the whole reachable set at once.
export const GRANTED_RECIPES = SKILL_UNLOCKS.flatMap(entry => entry.unlocks?.recipes ?? [])


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
