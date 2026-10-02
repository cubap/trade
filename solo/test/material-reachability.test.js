import test from 'node:test'
import assert from 'node:assert'

import { RECIPES, PROCESS_TRANSFORMS, getRecipe } from '../js/models/crafting/Recipes.js'
import { SKILL_UNLOCKS } from '../js/models/skills/SkillUnlocks.js'
import World from '../js/core/World.js'
import FloraGenerator from '../js/core/FloraGenerator.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import {
    Resource,
    FoodSource,
    WaterSource,
    Cover,
    Rock,
    Stick,
    FiberPlant,
    Herb
} from '../js/models/entities/resources/index.js'

/**
 * #129: the recipe book and the unlock table are both allowed to name materials,
 * and for a long time nothing checked that the world could make them. `grass`
 * took one issue (#120) to notice and `herb` took another: `herb_mash` and
 * `poultice` could never pass `canCraftRecipe()`, and the two unlocks gated on
 * handling an herb that no entity had ever dropped.
 *
 * So this file asks the question in the only way that stays true: it gathers from
 * every gatherable class in the game, reads the outputs the bench can make, and
 * reads the transforms the world itself performs. A material that appears in a
 * requirement or an exposure gate and in none of those three columns is a dead
 * end, and the pawn that finds itself wanting one will spend its afternoon there.
 */

const GATHERABLE_CLASSES = [Rock, Stick, FiberPlant, Herb, FoodSource, WaterSource, Cover, Resource]

/** Item types that come out of the ground, plus the type each yields. */
function gatheredItemTypes() {
    const types = new Set()
    for (const ClassOf of GATHERABLE_CLASSES) {
        // Resources take (id, name?, x, y); the concrete subclasses disagree about
        // whether the second argument is a name or a coordinate, so hand them all
        // four and let the constructors ignore what they do not use.
        const entity = new ClassOf(`probe_${ClassOf.name}`, 'probe', 10, 10)
        const item = typeof entity.gather === 'function' ? entity.gather(1) : null
        const type = item?.type ?? entity.subtype
        if (type) types.add(type)
    }
    return types
}

/** Item types that come out of a crafting bench. */
function craftedItemTypes() {
    const types = new Set()
    for (const recipe of RECIPES) {
        if (recipe.output?.type) types.add(recipe.output.type)
    }
    return types
}

/**
 * Item types the world makes without a pawn's hands. A soak pit is not a recipe and
 * not a gathering node, so without this list the guard below would report
 * `soaked_fiber` as unreachable, which would be a false alarm about the one
 * material in the book that genuinely takes a day instead of a tick.
 */
function processedItemTypes() {
    return new Set(PROCESS_TRANSFORMS.map(t => t.outputType))
}

function obtainableItemTypes() {
    return new Set([...gatheredItemTypes(), ...craftedItemTypes(), ...processedItemTypes()])
}

function requirementTypes() {
    const map = new Map()
    for (const recipe of RECIPES) {
        for (const req of recipe.requiredItems ?? []) {
            if (!map.has(req.type)) map.set(req.type, [])
            map.get(req.type).push(recipe.id)
        }
    }
    return map
}

function exposureTypes() {
    const map = new Map()
    for (const unlock of SKILL_UNLOCKS) {
        for (const type of Object.keys(unlock.conditions?.itemExposure ?? {})) {
            if (!map.has(type)) map.set(type, [])
            map.get(type).push(unlock.id)
        }
    }
    return map
}

test('every material a recipe asks for exists in some form', () => {
    const yieldable = obtainableItemTypes()
    const missing = []
    for (const [type, recipes] of requirementTypes()) {
        if (!yieldable.has(type)) missing.push(`${type} (required by ${recipes.join(', ')})`)
    }
    assert.deepStrictEqual(missing, [], `Recipe inputs no entity or bench can produce: ${missing.join('; ')}`)
})

test('every material an unlock gate counts is an item that can be held', () => {
    const yieldable = new Set([...gatheredItemTypes(), ...craftedItemTypes()])
    const missing = []
    for (const [type, unlocks] of exposureTypes()) {
        if (!yieldable.has(type)) missing.push(`${type} (gates ${unlocks.join(', ')})`)
    }
    assert.deepStrictEqual(missing, [], `itemExposure gates on an unobtainable item: ${missing.join('; ')}`)
})

test('no recipe is built out of its own output', () => {
    // Self-referential requirements are reachable on paper (the type exists) and
    // unreachable in practice, so the guard above would wave them through.
    for (const recipe of RECIPES) {
        const self = (recipe.requiredItems ?? []).find(req => req.type === recipe.output?.type)
        assert.strictEqual(self, undefined, `${recipe.id} requires its own output`)
    }
})

test('herb exists, is gatherable, and yields the item the herbalism branch asks for', () => {
    const herb = new Herb('herb_probe', 5, 5)

    assert.strictEqual(herb.type, 'resource', 'it has to be a Resource for the gatherer to accept it')
    assert.strictEqual(herb.subtype, 'herb', 'gather targets are matched on subtype, so subtype is the contract')
    assert.strictEqual(herb.canGather(), true)

    const item = herb.gather(1)
    assert.strictEqual(item.type, 'herb')
    assert.ok(item.tags.includes('herb'), 'examineItem() pays herbalism for the herb tag')

    herb.gather(1)
    assert.strictEqual(herb.canGather(), false, 'a patch holds two picks and no more')
    assert.strictEqual(herb.gather(1), null)
})

test('the herbalism branch is satisfiable end to end with what the world yields', () => {
    // Two herbs and a drink of water make the mash; the mash and a third herb make
    // the poultice. Nothing here is mocked except the pawn's own hands.
    const yieldable = gatheredItemTypes()
    assert.ok(yieldable.has('herb'))
    assert.ok(yieldable.has('water'))

    const mash = RECIPES.find(r => r.id === 'herb_mash')
    const poultice = RECIPES.find(r => r.id === 'poultice')
    const crafted = craftedItemTypes()

    const mashNeeds = mash.requiredItems.map(r => r.type)
    assert.ok(mashNeeds.every(t => yieldable.has(t)), `herb_mash needs ${mashNeeds.join(', ')}`)

    const poulticeNeeds = poultice.requiredItems.map(r => r.type)
    assert.ok(poulticeNeeds.every(t => yieldable.has(t) || crafted.has(t)), `poultice needs ${poulticeNeeds.join(', ')}`)

    // And the gates that hand out the recipes count a material the pawn can pick up.
    for (const unlock of SKILL_UNLOCKS) {
        const exposure = Object.keys(unlock.conditions?.itemExposure ?? {})
        for (const type of exposure) {
            assert.ok(yieldable.has(type) || crafted.has(type), `${unlock.id} counts ${type}`)
        }
    }
})

test('every world process that makes a material is still run by somebody', () => {
    // The guard reads PROCESS_TRANSFORMS rather than exempting `soaked_fiber`, so a
    // transform listed here but never performed would be the same lie told the other
    // way round. This is the half that keeps the exemption honest.
    const obtainable = obtainableItemTypes()
    assert.strictEqual(typeof Pawn.prototype.startFiberSoakAtCache, 'function',
        'the soak pit is the only way to make soaked fibre and it has gone quiet')
    for (const transform of PROCESS_TRANSFORMS) {
        assert.ok(obtainable.has(transform.inputType), `${transform.id} starts from missing ${transform.inputType}`)
    }
})

test('chunk generation plants herbs, so a pawn away from spawn can still find them', () => {
    // #129: gatherables used to live only in the starter clearing. Flora is the half
    // that now streams with the world.
    const world = new World(4000, 4000, { mapSeed: 7 })
    const generator = new FloraGenerator(world)
    const chunk = world.chunkManager.getChunk(2, 2)
    const biome = chunk.biome
    generator.generateForChunk(chunk)

    const planted = world.getNearbyEntities(chunk.worldX + chunk.size / 2, chunk.worldY + chunk.size / 2, chunk.size)
        .filter(entity => entity.subtype === 'herb')
    const expected = biome === 'wetland' ? 7 : biome === 'hills' ? 6 : biome === 'forest' ? 5 : biome === 'plains' ? 3 : 2
    assert.ok(planted.length >= expected, `${biome} grew ${planted.length} patches, expected ${expected}`)
    for (const herb of planted) {
        assert.ok(herb.x >= chunk.worldX && herb.x < chunk.worldX + chunk.size, 'the patch is inside the chunk it was paid for')
        assert.ok(herb.canGather(), 'a planted patch starts full')
    }
})

test('a pawn who picks an herb is holding herb and remembers handling it', () => {
    // The whole point of #129: the gather has to produce the item the book asks for,
    // pay the skill the unlock asks for, and stamp the exposure the gate counts.
    const world = new World(2000, 2000, { mapSeed: 7 })
    const pawn = new Pawn('p_herb', 'Odla', 20, 20)
    world.addEntity(pawn)
    const herb = new Herb('herb_here', 24, 20)
    world.addEntity(herb)

    pawn.gatherFromResource(herb, { completionReward: {} })

    assert.strictEqual(pawn.inventory.filter(item => item.type === 'herb').length, 1)
    assert.ok(pawn.itemExposure.herb >= 1, 'the unlock gate counts handling, not carrying')
    assert.ok(pawn.getSkill('herbalism') > 0, 'handling an herb teaches a little about herbs')
    assert.strictEqual(herb.amount, 1, 'a patch gives two picks and keeps one')
})

test('the poultice chain runs from bare ground to bandage', () => {
    // The ladder the issue says nothing could climb: pick herbs beside a spring,
    // mash two of them with the water, bind the mash with a third. Only the second
    // level of herbalism is handed over by hand, because this test is about whether
    // the materials exist and not about how long the grind takes.
    const world = new World(2000, 2000, { mapSeed: 7 })
    const pawn = new Pawn('p_chain', 'Veb', 20, 20)
    world.addEntity(pawn)
    // `herb_mash` asks for water at its source, so the spring has to be in earshot.
    world.addEntity(new WaterSource('water_here', 'Spring', 22, 22))
    const [first, second, third] = [0, 1, 2].map(i => new Herb(`herb_${i}`, 26 + i, 20))
    for (const patch of [first, second, third]) world.addEntity(patch)
    const goal = { completionReward: {} }

    pawn.gatherFromResource(first, goal)
    pawn.gatherFromResource(second, goal)
    assert.strictEqual(pawn.inventory.filter(item => item.type === 'herb').length, 2)

    pawn.evaluateSkillUnlocks()
    assert.ok(pawn.unlocked.recipes.has('herb_mash'), 'handling two herbs suggests mashing them')
    assert.ok(pawn.getSkill('herbalism') >= 1, 'and the suggestion arrives with the level the recipe asks for')

    const mash = pawn.craft(getRecipe('herb_mash'))
    assert.strictEqual(mash?.type, 'herb_mash', 'the mash crafts with the herb and the water the world has')
    // `craft()` hands the thing over; packing it is the caller's job (the craft goal
    // does exactly this in PawnGoals).
    assert.ok(pawn.addItemToInventory(mash), 'and there is room for it now the herbs have been used up')

    // A fresh pack holds two things, so the third herb is picked on the second trip
    // rather than the first - which is the design working, not the test limping.
    pawn.gatherFromResource(third, goal)
    assert.deepStrictEqual(pawn.inventory.map(item => item.type), ['herb_mash', 'herb'])

    pawn.skills.herbalism = 2
    pawn.evaluateSkillUnlocks()
    assert.ok(pawn.unlocked.recipes.has('poultice'), 'the second level of herbs suggests the salve')

    const salve = pawn.craft(getRecipe('poultice'))
    assert.strictEqual(salve?.type, 'poultice', 'and the salve closes the chain')
    assert.strictEqual(pawn.itemExposure.herb, 3, 'every leaf that went into it passed through her hands')
})
