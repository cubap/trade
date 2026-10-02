import test from 'node:test'
import assert from 'node:assert'

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import { RECIPES, getRecipe, getAvailableRecipes, canCraftRecipe } from '../js/models/crafting/Recipes.js'
import { SKILL_UNLOCKS, UNREACHABLE_RECIPES, GRANTED_RECIPES } from '../js/models/skills/SkillUnlocks.js'
import { transferItems } from '../js/models/entities/mobile/PawnInventory.js'

// The unlock table is the game's story about how pawns learn what to make. Three
// issues (#115, #116, #117) were the same story told three ways: the table said
// things that no code honoured.
//
//   #116 - `unlocks.skills` added a name to `unlocked.skills`, which nothing
//   reads; every gate in the game reads `pawn.skills`. A pawn could be told it
//   had discovered weaving and still be refused the recipe that asked for it.
//   #115 - `itemExposure` was written by `examineItem`, so the counter that
//   gates "has handled fibre" measured *looking at* fibre, and five recipes
//   (sharp_stone, stone_knife, herb_mash, durable_cordage, basic_shelter) were
//   granted by nothing at all: present in the book, unreachable in play.
//   #117 - `unlocks.goals` was written into a Set that nothing read, so the
//   ideas a pawn had lost to whatever `Recipes.js` happens to file first.
//
// These tests pin the three rules the table now keeps: every recipe is granted
// or exempt on purpose; a granted skill qualifies the pawn once; a granted goal
// is an idea that changes what gets made.

function makeItem(type, id, extra = {}) {
  return { id, type, name: type, weight: 1, size: 1, ...extra }
}

// A pawn with room in its pack. These tests are about what a pawn can *think
// of*; how little room it had to think in is #112's subject and is tested in
// pawn-carry-capacity.test.js.
function learner(label = 'ada') {
  const world = new World(300, 300)
  const pawn = new Pawn(label, label === 'ada' ? 'Ada' : 'Bo', 100, 100)
  world.addEntity(pawn)
  pawn.inventorySlots = 12
  pawn.maxSize = 60
  pawn.maxWeight = 60
  return { world, pawn }
}

let serial = 0
function stow(pawn, type, count) {
  for (let i = 0; i < count; i++) {
    assert.ok(pawn.addItemToInventory(makeItem(type, `x${++serial}`)), `stowing ${type} ${i + 1}`)
  }
}

// ---------------------------------------------------------------- #115 rule 1

test('every recipe is granted by the table or exempt from it, never merely filed', () => {
  const granted = new Set(GRANTED_RECIPES)
  const exempt = new Set(Object.keys(UNREACHABLE_RECIPES))
  for (const recipe of RECIPES) {
    assert.ok(
      granted.has(recipe.id) || exempt.has(recipe.id),
      `${recipe.id} is in the recipe book but nothing can ever unlock it`
    )
  }
})

test('the exemptions are real recipes with a stated reason', () => {
  const ids = new Set(RECIPES.map(recipe => recipe.id))
  for (const [recipeId, reason] of Object.entries(UNREACHABLE_RECIPES)) {
    assert.ok(ids.has(recipeId), `${recipeId} is exempt but is not a recipe`)
    assert.ok(!grantsRecipe(recipeId), `${recipeId} is exempt and granted at the same time`)
    assert.ok(String(reason).trim().length > 20, `${recipeId} needs a reason worth reading`)
  }
  // Saying the set out loud, so adding a recipe cannot slip past unmentioned.
  assert.deepStrictEqual(Object.keys(UNREACHABLE_RECIPES).sort(), ['basic_shelter', 'durable_cordage'])
})

function grantsRecipe(recipeId) {
  return SKILL_UNLOCKS.some(entry => (entry.unlocks?.recipes ?? []).includes(recipeId))
}

// ------------------------------------------------------- #116 rules on the gate

test('no entry requires the skill it exists to grant', () => {
  // A door that opens onto itself: the cordage entry used to ask for the weaving
  // level that only crafting cordage could produce, and nothing was craftable.
  for (const entry of SKILL_UNLOCKS) {
    const required = Object.keys(entry.conditions?.skills ?? {})
    for (const skill of entry.unlocks?.skills ?? []) {
      assert.ok(
        !required.includes(skill),
        `${entry.id} requires ${skill} but also grants it, so nothing can ever satisfy it`
      )
    }
  }
})

test('every recipe the table grants can pay for the next rung', () => {
  // Craft practice is only awarded when a recipe names a primary skill and an
  // experience amount (see Pawn.craft). A granted recipe without both is a dead
  // end: it unlocks, but the levels the *next* recipe asks for never arrive.
  for (const recipeId of new Set(GRANTED_RECIPES)) {
    const recipe = getRecipe(recipeId)
    assert.ok(recipe, `${recipeId} is granted but does not exist`)
    assert.ok(recipe.primarySkill, `${recipeId} grants no practice`)
    assert.ok(recipe.experience > 0, `${recipeId} pays no experience`)
  }
})

// ---------------------------------------------------------------- #116 grant

test('a granted skill qualifies the pawn, once', () => {
  const { pawn } = learner()
  assert.strictEqual(pawn.getSkill('weaving'), 0, 'a stranger has no weaving at all')

  pawn.skills.manipulation = 1
  stow(pawn, 'grass', 3)
  stow(pawn, 'fiber', 2)
  pawn.evaluateSkillUnlocks()

  assert.ok(pawn.unlocked.skills.has('weaving'), 'the table says she worked it out')
  assert.strictEqual(pawn.getSkill('weaving'), 1, 'and she can now do the thing that asks for it')

  pawn.evaluateSkillUnlocks()
  pawn.evaluateSkillUnlocks()
  assert.strictEqual(pawn.getSkill('weaving'), 1, 're-evaluating must not hand out another level')
})

test('qualification tops up to the level rather than adding to it', () => {
  const { pawn } = learner()
  pawn.itemExposure = { rock: 3, stick: 2 }
  pawn.skills.knapping = 0.7
  pawn.evaluateSkillUnlocks()
  assert.strictEqual(pawn.getSkill('knapping'), 1, 'she needed a little, not a second level')

  const bo = learner('bo').pawn
  bo.itemExposure = { rock: 3, stick: 2 }
  bo.skills.knapping = 3
  bo.evaluateSkillUnlocks()
  assert.strictEqual(bo.getSkill('knapping'), 3, 'a grant never lowers an earned level')
})

test('the knapped edge is a recipe and not only an idea', () => {
  const { pawn } = learner()
  pawn.itemExposure = { rock: 3, stick: 2 }
  pawn.evaluateSkillUnlocks()

  assert.ok(pawn.unlocked.recipes.has('sharp_stone'), 'knapping basics grants the knife of the title')
  assert.ok(
    getAvailableRecipes(pawn).some(recipe => recipe.id === 'sharp_stone'),
    'and the planner offers it to her'
  )
})

// ---------------------------------------------------------------- #115 handling

test('handling material is what exposure counts, not looking at it', () => {
  const { pawn } = learner()
  stow(pawn, 'fiber', 4)
  assert.strictEqual(pawn.itemExposure.fiber, 4, 'four fibres through the hands')

  const bo = learner('bo').pawn
  const herb = makeItem('herb', 'h1')
  for (let i = 0; i < 10; i++) bo.examineItem(herb)
  assert.ok(
    !(bo.itemExposure?.herb > 0),
    'studying the same leaf ten times is ten glances and no handling'
  )
  assert.ok(bo.getSkill('herbalism') > 0, 'but attention still pays the practice it always did')

  const ada = learner().pawn
  stow(ada, 'fiber', 4)
  ada.evaluateSkillUnlocks()
  assert.ok(ada.unlocked.recipes.has('basket'), 'the basket needs four fibres and no studying at all')
})

test('crafting at a source handles the material it takes', () => {
  const { world, pawn } = learner()
  const patch = {
    id: 'patch1',
    type: 'resource',
    subtype: 'fiber',
    x: 101,
    y: 100,
    quantity: 6,
    tags: ['fiber'],
    consume(amount = 1) {
      const taken = Math.min(this.quantity, amount)
      this.quantity -= taken
      return taken
    }
  }
  world.addEntity(patch)

  pawn.skills.weaving = 1
  pawn.unlocked.recipes.add('basket')
  const crafted = pawn.craft(getRecipe('basket'))
  assert.ok(crafted, 'three fibres drawn off the patch and woven')
  assert.strictEqual(pawn.itemExposure.fiber, 3, 'three fibres passed through her hands doing it')
})

// ---------------------------------------------------------------- the herb chain

test('the herb chain runs from a handful of leaves to a poultice', () => {
  const { pawn } = learner()

  stow(pawn, 'herb', 2)
  pawn.evaluateSkillUnlocks()
  assert.ok(pawn.unlocked.recipes.has('herb_mash'), 'crushed herbs suggest mashing them')
  assert.strictEqual(pawn.getSkill('herbalism'), 1, 'and the suggestion arrives with the level it needs')

  const herbMash = getRecipe('herb_mash')
  for (let i = 0; i < 3; i++) {
    // Water goes into the pack directly: whether a pawn can carry it at all is
    // #112's water gate, tested in pawn-carry-capacity.test.js.
    stow(pawn, 'herb', 2)
    pawn.inventory.push(makeItem('water', `w${i}`))
    pawn.inventoryWeight += 1
    const made = pawn.craft(herbMash)
    assert.ok(made, `mash ${i + 1}`)
    assert.ok(pawn.addItemToInventory(made))
  }

  assert.ok(pawn.getSkill('herbalism') >= 2, 'mashing paid the herbalism the poultice asks for')
  stow(pawn, 'herb', 1)
  pawn.evaluateSkillUnlocks()
  assert.ok(pawn.unlocked.recipes.has('poultice'), 'so the poultice is reachable now')
  assert.ok(getAvailableRecipes(pawn).some(recipe => recipe.id === 'poultice'))
  assert.ok(canCraftRecipe(pawn, getRecipe('poultice')), 'and she is standing on the ingredients')
})

// ------------------------------------------------------------------- #117 ideas

test('every goal the table grants is an idea the planner can act on', () => {
  const granted = new Set(GRANTED_RECIPES)
  for (const entry of SKILL_UNLOCKS) {
    for (const goal of entry.unlocks?.goals ?? []) {
      const match = /^craft_(.+)$/.exec(goal)
      assert.ok(match, `${entry.id} grants "${goal}", which is not a craft_<recipeId> idea`)
      assert.ok(granted.has(match[1]), `${entry.id} has an idea about ${match[1]}, a recipe nothing grants`)
    }
  }
  // The other direction: an unlock that hands over a recipe with no idea behind
  // it is permission without intent, and the pawn never reaches for it on purpose.
  for (const entry of SKILL_UNLOCKS) {
    for (const recipeId of entry.unlocks?.recipes ?? []) {
      const goals = entry.unlocks?.goals ?? []
      assert.ok(goals.includes(`craft_${recipeId}`), `${entry.id} grants ${recipeId} but never thinks about it`)
    }
  }
})

test('the newest idea outranks the order the recipes were filed in', () => {
  const { pawn } = learner()
  const cordage = { id: 'cordage', output: {} }
  const sharpStone = { id: 'sharp_stone', output: {} }

  pawn.unlocked.goals = new Set(['craft_sharp_stone', 'craft_cordage'])
  assert.strictEqual(pawn.chooseCraft([sharpStone, cordage]), cordage)
  assert.strictEqual(pawn.chooseCraft([cordage, sharpStone]), cordage, 'the idea wins, not the array order')

  pawn.unlocked.goals = new Set(['craft_cordage', 'craft_sharp_stone'])
  assert.strictEqual(pawn.chooseCraft([cordage, sharpStone]), sharpStone)
})

test('an idea about something out of reach does not starve the pawn', () => {
  const { pawn } = learner()
  pawn.unlocked.goals = new Set(['craft_stone_knife'])
  const cordage = { id: 'cordage', output: {} }
  assert.strictEqual(pawn.chooseCraft([cordage]), cordage, 'she cannot bind a knife yet, so she twists cord')

  pawn.unlocked.goals = new Set(['build_shelter'])
  assert.strictEqual(pawn.chooseCraft([cordage]), cordage, 'a goal that is not a craft idea is skipped')

  assert.strictEqual(pawn.chooseCraft([]), null)
})

test('making room still comes before a new thought', () => {
  const { pawn } = learner()
  pawn.inventorySlots = 0
  pawn.unlocked.goals = new Set(['craft_cordage', 'craft_basket'])
  const basket = { id: 'basket', output: { increasesCapacity: { slots: 4 } } }
  const cordage = { id: 'cordage', output: {} }
  assert.strictEqual(pawn.chooseCraft([cordage, basket]), basket)

  // The basket is the newest idea *and* the widening craft here, so use the
  // reverse order to show that urgency, not novelty, is what picked it.
  pawn.unlocked.goals = new Set(['craft_basket', 'craft_cordage'])
  assert.strictEqual(pawn.chooseCraft([cordage, basket]), basket)
})

test('ideas come from the table in the order the pawn had them', () => {
  const { pawn } = learner()
  pawn.itemExposure = { fiber: 4, grass: 3 }
  pawn.skills.manipulation = 1
  pawn.evaluateSkillUnlocks()

  const ideas = pawn.craftIdeas()
  assert.ok(ideas.includes('cordage') && ideas.includes('basket'))
  assert.ok(
    ideas.indexOf('basket') < ideas.indexOf('cordage'),
    'the container came after the cord, so it is the newer thought'
  )
})

// Exposure counts encounters, not repetitions of one encounter. A barter that
// fails rolls itself back by re-adding the very same object (see the rollback
// note in pawn-carry-capacity.test.js), and a counter that credited that would
// let a pawn with nowhere to put a thing unlock by failing to hand it over.
test('a transfer that comes back teaches nothing; one that goes through teaches the receiver', () => {
  const ada = learner('ada').pawn
  const bo = learner('bo').pawn
  const stone = makeItem('rock', `r${++serial}`)

  assert.ok(ada.addItemToInventory(stone))
  assert.strictEqual(ada.itemExposure.rock, 1)

  bo.inventorySlots = 0
  assert.strictEqual(transferItems(ada, bo, 'rock', 1), 0)
  assert.strictEqual(ada.itemExposure.rock, 1, 'the rolled-back stone is still the one she knows')

  bo.inventorySlots = 12
  assert.strictEqual(transferItems(ada, bo, 'rock', 1), 1)
  assert.strictEqual(bo.itemExposure.rock, 1, 'his own hands, his own lesson')
  assert.strictEqual(ada.itemExposure.rock, 1)
})
