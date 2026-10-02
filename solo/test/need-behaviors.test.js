import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// #131: need rates that asked for behaviour strings no pawn could ever have.
//
// `PawnNeeds.modifyRateForActivity()` compared one slot, `pawn.behaviorState`,
// against fourteen strings. Nine of them were unreachable: the goal system's map
// never produced them and no assignment anywhere else did either. So `sleeping`
// did not rest you, `in_shelter` did not make you safe, `threatened` did not
// frighten anyone, and `isolated` never made anybody lonely - the need model was
// arithmetic on a corpse, and the sim's behaviour was quietly nothing like the
// table in the file suggests.
//
// Two things are checked here. The first is the shape: the need model may only ask
// for names the rest of the code can actually say, which is a source-level fact
// and (as in #108) only a source-level check can catch it before someone writes the
// next dead string. The second is the substance: with the vocabulary fixed, the
// promises the branches make have to be true - a pawn asleep on a good bed wakes
// less tired, a wolf nearby makes the safety need climb, and being the only pawn
// in a world of one is not loneliness.

import PawnNeeds, { EXERTION, REST_ENERGY_RELIEF } from '../js/models/entities/mobile/PawnNeeds.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import { createShelter } from '../js/models/entities/immobile/Structure.js'
import {
    GOAL_BEHAVIOR_MAP,
    DIRECT_BEHAVIOR_STATES,
    PAWN_BEHAVIOR_STATES,
    SITUATION_STATES,
    SITUATION_RADIUS,
    REST_BONUS_RANGE,
    behaviorForGoal
} from '../js/models/entities/mobile/PawnBehaviors.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const NEEDS_SRC = 'solo/js/models/entities/mobile/PawnNeeds.js'

const DEAD = [
    'sleeping', 'building_shelter', 'in_shelter', 'threatened', 'isolated',
    'completing_goal', 'improving_living', 'in_comfortable_space', 'resting'
]

// --- the harness -----------------------------------------------------------

/** A world the needs system can look around in, and nothing else. */
function makeWorld(entities = []) {
    const entitiesMap = new Map()
    for (const e of entities) entitiesMap.set(e.id ?? `e${entitiesMap.size}`, e)
    return { width: 2000, height: 2000, tick: 0, clock: { currentTick: 0 }, entitiesMap }
}

function makePawn({ x = 0, y = 0, world = makeWorld(), behaviorState = 'idle' } = {}) {
    const pawn = new Pawn('p', 'p', x, y)
    pawn.world = world
    pawn.behaviorState = behaviorState
    return pawn
}

/** Lie down. `startTime` is what the rest goal sets when it arrives at the site. */
function asleep(pawn, target = null) {
    pawn.goals.currentGoal = { type: 'rest', target, startTime: 1 }
    return pawn
}

function fake(id, props) {
    return { id, x: 0, y: 0, size: 1, ...props }
}

/** Run `updates` needs updates; the loop is the sim's own 5-tick cadence. */
function run(needs, updates, from = 0) {
    for (let t = from + 5; t <= from + updates * 5; t++) needs.updateNeeds(t)
}

/** Growth of one need per update, with everything else held out of the way. */
function perUpdate(pawn, need, updates = 4) {
    const before = pawn.needs.needs[need]
    run(pawn.needs, updates)
    return (pawn.needs.needs[need] - before) / updates
}

// --- the vocabulary --------------------------------------------------------

test('the need model only asks for names something can say', () => {
    const src = fs.readFileSync(path.join(repoRoot, NEEDS_SRC), 'utf8')

    const said = [...src.matchAll(/behavior === '([a-z_]+)'/g)].map(m => m[1])
    const derived = [...src.matchAll(/at\.has\('([a-z_]+)'\)/g)].map(m => m[1])

    assert.ok(said.length >= 8, `expected the reader to compare behaviours, found ${said.length}`)
    assert.ok(derived.length >= 4, `expected the reader to consult situations, found ${derived.length}`)

    for (const name of said) {
        assert.ok(PAWN_BEHAVIOR_STATES.has(name), `nothing writes behaviorState = '${name}'`)
    }
    for (const name of derived) {
        assert.ok(SITUATION_STATES.includes(name), `'${name}' is not a situation anything derives`)
    }
    // A name cannot be both: one slot is what the pawn is doing, the other is
    // where it is standing, and the whole bug was pretending they were one list.
    for (const name of derived) {
        assert.ok(!PAWN_BEHAVIOR_STATES.has(name), `'${name}' would be ambiguous between the two lists`)
    }
})

test('the nine unreachable strings are gone from the needs model', () => {
    const src = fs.readFileSync(path.join(repoRoot, NEEDS_SRC), 'utf8')
    for (const name of DEAD) {
        // 'resting' and 'in_shelter' etc. survive as *situations*; what must not
        // survive is the file asking `behaviorState` for them.
        const re = new RegExp(`behavior(State)?\\s*===?\\s*'${name}'`)
        assert.ok(!re.test(src), `PawnNeeds still compares behaviorState to the unreachable '${name}'`)
    }
})

test('every situation the model can ask for is one the reader derives', () => {
    const src = fs.readFileSync(path.join(repoRoot, NEEDS_SRC), 'utf8')
    const added = [...src.matchAll(/situations\.add\('([a-z_]+)'\)/g)].map(m => m[1])
    for (const name of SITUATION_STATES) {
        assert.ok(added.includes(name), `readSituation() never derives '${name}'`)
    }
    for (const name of added) {
        assert.ok(SITUATION_STATES.includes(name), `readSituation() invents '${name}'`)
    }
})

test('a goal label is an activity, and rest is only the walk to bed', () => {
    // The confusion that started this: `rest` the goal produces `seeking_rest`,
    // while `resting` is the state of being asleep once the walk is over.
    assert.equal(behaviorForGoal({ type: 'rest' }), 'seeking_rest')
    assert.equal(behaviorForGoal({ type: 'apprentice_skill' }), 'learning')
    assert.equal(behaviorForGoal({ type: 'no_such_goal' }), 'idle')
    assert.equal(behaviorForGoal(null), 'idle')

    for (const [type, label] of Object.entries(GOAL_BEHAVIOR_MAP)) {
        assert.equal(behaviorForGoal({ type }), label, `${type} -> ${label}`)
        assert.ok(PAWN_BEHAVIOR_STATES.has(label))
    }
    for (const label of DIRECT_BEHAVIOR_STATES) {
        assert.ok(PAWN_BEHAVIOR_STATES.has(label))
    }
})

test('the goal system stamps labels from the same list', () => {
    const pawn = makePawn()
    for (const type of ['craft_item', 'gather_materials', 'build_structure', 'work', 'explore', 'rest']) {
        const label = pawn.goals.getBehaviorForGoal({ type })
        assert.ok(PAWN_BEHAVIOR_STATES.has(label), `${type} stamped '${label}'`)
    }
    assert.equal(pawn.goals.getBehaviorForGoal({ type: 'rest' }), 'seeking_rest')
})

// --- the arithmetic that was dead ------------------------------------------

test('a pawn lying down stops running out of energy', () => {
    const walking = makePawn({ behaviorState: 'exploring' })
    assert.ok(perUpdate(asleep(walking), 'energy') < 0, 'asleep: energy urgency falls')

    const awake = makePawn()
    awake.goals.currentGoal = { type: 'explore' }
    assert.ok(perUpdate(awake, 'energy') > 0, 'awake and on the move: it climbs')
})

test('a bed the pawn built is worth more than bare ground', () => {
    // #120 put `restBonus` on the crafted shelter and nothing read it. Now the
    // structure you sleep on decides how much the night is worth.
    const leanTo = createShelter({ id: 's1', name: 'Lean-to', x: 2, y: 0, restBonus: 1.3 })
    const frame = createShelter({ id: 's2', name: 'Frame', x: 2, y: 0 })
    assert.equal(frame.restBonus, undefined, 'a hand-built frame carries no bonus')

    const onGround = asleep(makePawn())
    const onFrame = asleep(makePawn({ world: makeWorld([frame]) }), frame)
    const onBed = asleep(makePawn({ world: makeWorld([leanTo]) }), leanTo)

    const open = perUpdate(onGround, 'energy')
    const same = perUpdate(onFrame, 'energy')
    const comfy = perUpdate(onBed, 'energy')

    assert.ok(Math.abs(open - same) < 1e-9, `a frame should rest you like the ground: ${open} vs ${same}`)
    assert.ok(comfy < open, `a lean-to should beat bare ground: ${comfy} vs ${open}`)
    assert.ok(Math.abs(comfy - -REST_ENERGY_RELIEF * 1.3) < 1e-9, `expected -1.0 x 1.3, got ${comfy}`)
    assert.ok(onBed.needs.situations.has('in_comfortable_space'))
    assert.ok(!onFrame.needs.situations.has('in_comfortable_space'))
})

test('an absurd rest bonus is clamped the way quality is', () => {
    const palace = createShelter({ id: 'p1', name: 'Palace', x: 1, y: 0, restBonus: 99 })
    const pawn = asleep(makePawn({ world: makeWorld([palace]) }), palace)
    pawn.needs.readSituation()
    assert.equal(pawn.needs.restBonus, REST_BONUS_RANGE.max)
})

test('a night in a good bed clears a hard afternoon', () => {
    // The #104 promise, which the pre-#131 file could only test by writing the
    // magic word itself: exertion settles while resting, fastest when comfortable.
    const cool = ({ rest = false, bed = null } = {}, updates = 4) => {
        const world = bed ? makeWorld([bed]) : makeWorld()
        const pawn = makePawn({ world })
        pawn.needs.exertion = 1
        pawn.needs.lastNeedsUpdate = 0
        if (rest) asleep(pawn, bed)
        run(pawn.needs, updates)
        return pawn.needs.exertion
    }
    const leanTo = createShelter({ id: 's3', name: 'Lean-to', x: 1, y: 0, restBonus: 1.3 })

    assert.ok(Math.abs(cool({}, 4) - (1 - 4 * EXERTION.DECAY)) < 1e-12, 'standing about cools at 1x')
    assert.ok(
        Math.abs(cool({ rest: true }, 4) - (1 - 4 * EXERTION.DECAY * EXERTION.REST_DECAY)) < 1e-12,
        'sleeping on the ground cools at 2x'
    )
    assert.ok(cool({ rest: true, bed: leanTo }, 4) < cool({ rest: true }, 4), 'and a bed cools fastest')
    assert.equal(cool({ rest: true, bed: leanTo }, 20), 0, 'a night in one clears any afternoon')
    assert.ok(cool({}, 20) > 0, 'but twenty ticks of standing about does not')
})

test('a predator nearby makes safety climb three times as fast', () => {
    const rate = (dist) => {
        const wolf = fake('wolf', { type: 'animal', subtype: 'predator', x: dist })
        return perUpdate(makePawn({ world: makeWorld([wolf]) }), 'safety')
    }
    const base = 0.2 // this.rates.safety, unmodified
    assert.ok(Math.abs(rate(SITUATION_RADIUS.threat + 10) - base) < 1e-9, 'out of reach: the plain rate')
    assert.ok(Math.abs(rate(SITUATION_RADIUS.threat - 4) - base * 3) < 1e-9, 'within reach: trebled')
})

test('cover is what the safety need was asking for', () => {
    const bush = fake('bush', { type: 'resource', subtype: 'bush', tags: ['cover'], x: SITUATION_RADIUS.shelter - 2 })
    const far = fake('bush2', { type: 'resource', subtype: 'bush', tags: ['cover'], x: SITUATION_RADIUS.shelter + 2 })

    assert.ok(perUpdate(makePawn({ world: makeWorld([bush]) }), 'safety') < 0, 'under cover: safety improves')
    assert.ok(Math.abs(perUpdate(makePawn({ world: makeWorld([far]) }), 'safety') - 0.2) < 1e-9, 'outside it: it does not')

    // The decision written down with the branch: a roof does not make a wolf less
    // dangerous, and there is no fleeing yet for the model to reward.
    const wolfAndCover = makeWorld([bush, fake('wolf', { type: 'animal', subtype: 'predator', x: 3 })])
    assert.ok(perUpdate(makePawn({ world: wolfAndCover }), 'safety') > 0, 'threatened beats shelter')
})

test('building something is itself reassuring', () => {
    const pawn = makePawn({ behaviorState: 'building' })
    assert.ok(perUpdate(pawn, 'safety') < 0, "the dead 'building_shelter' branch's job is done by 'building'")
})

test('loneliness needs somebody else to be lonely about', () => {
    const base = 0.3 // this.rates.social, unmodified
    const alone = makePawn()
    assert.ok(Math.abs(perUpdate(alone, 'social') - base) < 1e-9, 'the only pawn alive is not isolated')
    assert.ok(!alone.needs.situations.has('isolated'))

    const other = fake('q', { subtype: 'pawn', x: 400 })
    const deserted = makePawn({ world: makeWorld([other]) })
    assert.ok(Math.abs(perUpdate(deserted, 'social') - base * 2) < 1e-9, 'another pawn exists and is nowhere near')

    const crowd = fake('r', { subtype: 'pawn', x: SITUATION_RADIUS.company - 5 })
    const accompanied = makePawn({ world: makeWorld([crowd]) })
    assert.ok(Math.abs(perUpdate(accompanied, 'social') - base) < 1e-9, 'company is company at any distance under 30')
})

test('meaningful work relieves purpose whether or not it is called work', () => {
    // `completing_goal` was the dead name for "the pawn is achieving something".
    for (const behavior of ['working', 'crafting', 'gathering', 'building', 'hauling', 'collaborating']) {
        assert.ok(perUpdate(makePawn({ behaviorState: behavior }), 'purpose') < 0, behavior)
    }
    assert.ok(perUpdate(makePawn({ behaviorState: 'idle' }), 'purpose') > 0.1, 'doing nothing gnaws')
})

test('a comfortable space soothes comfort', () => {
    const leanTo = createShelter({ id: 's4', name: 'Lean-to', x: 1, y: 0, restBonus: 1.3 })
    const pawn = asleep(makePawn({ world: makeWorld([leanTo]) }), leanTo)
    assert.ok(perUpdate(pawn, 'comfort') < 0)
    assert.equal(perUpdate(makePawn({ world: makeWorld([leanTo]) }), 'comfort'), 0.05, 'sitting in a shelter awake does not')
})

// --- the other readers of the same phantom states --------------------------

test('a sleeping pawn has room to think', () => {
    const leanTo = createShelter({ id: 's5', name: 'Lean-to', x: 1, y: 0, restBonus: 1.3 })
    const world = makeWorld([leanTo])
    const awake = makePawn({ world, behaviorState: 'idle' })
    const resting = asleep(makePawn({ world, behaviorState: 'idle' }), leanTo)
    awake.needs.readSituation()
    resting.needs.readSituation()
    // #131's second dead reader: `getPonderWindowBonus` paid 0.08 for a word no
    // pawn could hold. It now pays it for the real thing.
    assert.ok(Math.abs(resting.getPonderWindowBonus() - awake.getPonderWindowBonus() - 0.08) < 1e-9)
})

test('the situation reader survives a world it cannot see into', () => {
    const pawn = makePawn({ world: { width: 10, height: 10 } })
    assert.equal(pawn.needs.readSituation().size, 0)
    assert.equal(pawn.needs.restBonus, 1)
    // Bare stand-ins (the shape pawn-exertion.test.js uses) must keep working.
    const needs = new PawnNeeds({ behaviorState: 'idle' })
    assert.equal(needs.readSituation().size, 0)
    assert.equal(needs.modifyRateForActivity('energy', 0.6), 0.6)
})

test('a threat is whatever the animals are already afraid of', () => {
    // `SmallPredator` says so with its subtype; the lab's animal factory says so
    // with a `predator` flag on a plain animal. Either spelling should frighten a
    // pawn, because both already coexist in the game.
    const at = (props) => ({ id: props.name, x: 104, y: 100, size: 2, ...props })
    for (const threat of [
        at({ name: 'fox', type: 'animal', subtype: 'predator' }),
        at({ name: 'wolf', type: 'animal', subtype: 'animal', predator: true })
    ]) {
        const pawn = makePawn({ x: 100, y: 100, world: makeWorld([threat]) })
        assert.ok(pawn.needs.readSituation().has('threatened'), threat.name)
    }

    const deer = makePawn({
        x: 100,
        y: 100,
        world: makeWorld([at({ name: 'deer', type: 'animal', subtype: 'forager' })])
    })
    assert.strictEqual(deer.needs.readSituation().has('threatened'), false)
})
