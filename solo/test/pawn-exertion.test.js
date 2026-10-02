import test from 'node:test'
import assert from 'node:assert/strict'

// #104: walking is tiring.
//
// The solo sim grew needs by flat per-tick rates that nothing could modify
// except `behaviorState`, so a pawn that slept all day and a pawn that walked
// 4,000 units through a swamp ended the day identically. Exertion is modelled
// the way the rest of PawnNeeds works - a multiplier on urgency growth driven by
// recent strides, not a subtraction from a pool - and the stride is charged by
// the movement step itself, so #84's terrain and #98's roads are already in the
// number.
//
// The promise that matters most is the first one: a pawn that does not walk is
// bit-for-bit the pawn this file's ancestors described.

import PawnNeeds, { EXERTION } from '../js/models/entities/mobile/PawnNeeds.js'
import MobileEntity from '../js/models/entities/mobile/MobileEntity.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import { TRAIL_PLANNING_SKILL_MASTERY } from '../js/models/entities/mobile/MovementPlan.js'
import TrailField, {
    TRAIL_CELL_SIZE,
    TRAIL_MAX_INTENSITY
} from '../js/core/TrailField.js'

/** Flat world with no chunk manager: terrain factor is exactly 1. */
function flatWorld(field = null) {
    return { width: 2000, height: 2000, tick: 0, trailField: field }
}

/**
 * A pawn whose schedule is entirely the test's: nothing here calls update(),
 * so only the strides this file asks for are ever charged.
 */
function makePawn({ x = 0, y = 0, field = null, orienteering = 0 } = {}) {
    const pawn = new Pawn('p', 'p', x, y)
    pawn.world = flatWorld(field)
    pawn.useSkill('planning', 1)
    if (orienteering) pawn.useSkill('orienteering', orienteering)
    return pawn
}

/** A saturated road along y = 0 from x = 0 to x = length. */
function road(length = 600) {
    const field = new TrailField({ tick: 0 })
    for (let x = 0; x <= length; x += TRAIL_CELL_SIZE) {
        field.deposit(x, 0, TRAIL_MAX_INTENSITY, 0, 'pawn')
    }
    return field
}

function updateNeeds(pawn, from, to) {
    for (let t = from; t <= to; t++) pawn.needs.updateNeeds(t)
}

// --- the degeneracy everything else leans on -------------------------------

test('a pawn that never walks pays exactly the old rates', () => {
    const walked = makePawn()
    const reference = makePawn()
    // The pre-#104 formula, through the same loop.
    reference.needs.applyExertion = (_need, rate) => rate

    walked.needs.lastNeedsUpdate = 0
    reference.needs.lastNeedsUpdate = 0
    updateNeeds(walked, 1, 500)
    updateNeeds(reference, 1, 500)

    assert.equal(walked.needs.exertion, 0, 'standing still is not exertion')
    assert.equal(walked.needs.strideEffort, 0, 'nothing was banked')
    for (const need of Object.keys(walked.needs.needs)) {
        assert.equal(walked.needs.needs[need], reference.needs.needs[need], `${need} drifted`)
    }
})

test('applyExertion returns the rate by identity when fresh, and scales it when not', () => {
    const needs = new PawnNeeds({ behaviorState: 'idle' })
    assert.equal(needs.applyExertion('energy', 0.6), 0.6)

    needs.exertion = 1
    assert.equal(needs.applyExertion('energy', 0.6), 0.6 * (1 + EXERTION.RATES.energy))
    // A need exertion does not touch is not touched.
    assert.equal(needs.applyExertion('safety', 0.2), 0.2)
    assert.equal(needs.applyExertion('knowledge', 0.15), 0.15)
})

// --- the stride is what gets charged ---------------------------------------

test('one full stride on ordinary ground is one unit of effort', () => {
    const pawn = makePawn()
    pawn.setValidatedTarget(100, 0)
    pawn.move()
    assert.ok(Math.abs(pawn.needs.strideEffort - 1) < 1e-12, `got ${pawn.needs.strideEffort}`)
})

test('a shorter approach costs less than a stride, and an obstacle costs nothing', () => {
    // Long legs, a short errand: the last step into a destination is not a whole
    // stride and must not be charged as one.
    const pawn = makePawn()
    pawn.speed = 3
    pawn.setValidatedTarget(1.5, 0)
    pawn.move()
    const fraction = pawn.needs.strideEffort
    assert.ok(fraction > 0 && fraction < 1, `expected a fraction of a stride, got ${fraction}`)
    assert.ok(Math.abs(fraction - 0.5) < 1e-9, `half of a three-unit stride, got ${fraction}`)

    // Blocked ground: the pawn does not move, so it does not pay for moving.
    const stuck = makePawn()
    stuck.speed = 0 // nothing can be covered
    stuck.setValidatedTarget(50, 0)
    stuck.move()
    assert.equal(stuck.needs.strideEffort, 0)

    // Junk must not poison the bank.
    const clean = makePawn()
    clean.needs.noteStrideEffort(NaN)
    clean.needs.noteStrideEffort(-3)
    clean.needs.noteStrideEffort(Infinity)
    assert.equal(clean.needs.strideEffort, 0)
})

test('the same errand across a road costs fewer strides than across grass', () => {
    // This is what the ticket actually wished for: a road should make the need
    // arrive later. Terrain (#84) and wear (#98) are already in the stride, so
    // charging the body per stride means the body agrees with both.
    const onRoad = makePawn({ field: road(600), orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    // No field at all for the control: untrodden ground, and no path of its own
    // to wear in, which keeps the comparison about the road and nothing else.
    const onGrass = makePawn({ field: null, orienteering: TRAIL_PLANNING_SKILL_MASTERY })
    assert.ok(onRoad.trailStepCost() < 1, 'the road has to be readable for this to mean anything')
    assert.equal(onGrass.trailStepCost(), 1)

    // A pawn only ever aims 50 units at a time, so the errand is walked in legs.
    const march = (pawn) => {
        let tick = 0
        let banked = 0
        while (pawn.x < 300 && tick < 4000) {
            pawn.setValidatedTarget(pawn.x + 40, 0)
            const before = pawn.needs.strideEffort
            pawn.move()
            // strideEffort is the bank since the last needs update, so total it
            // up as it empties.
            banked += pawn.needs.strideEffort - before
            tick++
            pawn.needs.updateNeeds(tick)
        }
        return { tick, banked, exertion: pawn.needs.exertion, energy: pawn.needs.needs.energy, x: pawn.x }
    }

    const roadRun = march(onRoad)
    const grassRun = march(onGrass)
    assert.ok(roadRun.tick < grassRun.tick, `road should shorten the walk: ${roadRun.tick} vs ${grassRun.tick}`)
    assert.ok(roadRun.banked < grassRun.banked, `and therefore the body's bill: ${roadRun.banked} vs ${grassRun.banked}`)
    assert.ok(roadRun.exertion < grassRun.exertion, `and the pawn should feel it: ${roadRun.exertion} vs ${grassRun.exertion}`)
    assert.ok(roadRun.energy < grassRun.energy, `which is what the rest need is for: ${roadRun.energy} vs ${grassRun.energy}`)
    // Every tick on the road is one whole stride, so the bill is the stride
    // count: fewer strides is the only way the ground can be cheaper.
    assert.ok(Math.abs(roadRun.banked - roadRun.tick) < 1e-6, `${roadRun.banked} over ${roadRun.tick} ticks`)
    assert.ok(Math.abs(grassRun.banked - grassRun.tick) < 1e-6, `${grassRun.banked} over ${grassRun.tick} ticks`)
})

test('banked effort is settled into the level, not left to accumulate', () => {
    const pawn = makePawn()
    pawn.setValidatedTarget(100, 0)
    for (let t = 1; t <= 20; t++) {
        pawn.move()
        pawn.needs.updateNeeds(t)
    }
    assert.equal(pawn.needs.strideEffort, 0, 'the window is emptied each update')
    assert.ok(pawn.needs.exertion > 0, `walking should register, got ${pawn.needs.exertion}`)
    assert.ok(pawn.needs.exertion < 1, 'and it should take a while to wind anyone')
})

test('walking raises the rate a need grows at, and standing still does not', () => {
    const walker = makePawn()
    const sitter = makePawn()

    for (let t = 1; t <= 400; t++) {
        // Re-aimed every tick because a pawn only looks 50 units ahead: this is
        // a long march, not a stroll to the next clearing.
        walker.setValidatedTarget(walker.x + 40, 0)
        walker.move()
        walker.needs.updateNeeds(t)
        sitter.needs.updateNeeds(t)
    }

    assert.ok(walker.needs.exertion > 0.5, `a long march should wind anyone, got ${walker.needs.exertion}`)
    assert.equal(sitter.needs.exertion, 0)
    assert.ok(
        walker.needs.needs.energy > sitter.needs.needs.energy,
        `energy urgency ${walker.needs.needs.energy} vs idle ${sitter.needs.needs.energy}`
    )
    assert.ok(walker.needs.needs.thirst > sitter.needs.needs.thirst)
    assert.ok(walker.needs.needs.safety === sitter.needs.needs.safety, 'exertion is not everything')
    // Still inside the range needs live in.
    assert.ok(walker.needs.needs.energy <= 100)
})

// --- load ------------------------------------------------------------------

test('a full pack makes the same walking feel harder', () => {
    const needs = new PawnNeeds({ inventoryWeight: 25, maxWeight: 50, behaviorState: 'idle' })
    assert.equal(needs.loadRatio(), 0.5)
    assert.equal(new PawnNeeds({}).loadRatio(), 0, 'no pack, no capacity')
    assert.equal(new PawnNeeds({ inventoryWeight: 999, maxWeight: 10 }).loadRatio(), 1, 'capped')
    assert.equal(new PawnNeeds({ inventoryWeight: NaN, maxWeight: 10 }).loadRatio(), 0)
    assert.equal(new PawnNeeds({ inventoryWeight: -5, maxWeight: 10 }).loadRatio(), 0)

    const loaded = () => {
        const n = new PawnNeeds({ inventoryWeight: 50, maxWeight: 50, behaviorState: 'idle' })
        n.lastNeedsUpdate = 0
        for (let t = 1; t <= 60; t++) {
            n.noteStrideEffort(1)
            n.updateNeeds(t)
        }
        return n.exertion
    }
    const empty = () => {
        const n = new PawnNeeds({ inventoryWeight: 0, maxWeight: 50, behaviorState: 'idle' })
        n.lastNeedsUpdate = 0
        for (let t = 1; t <= 60; t++) {
            n.noteStrideEffort(1)
            n.updateNeeds(t)
        }
        return n.exertion
    }
    assert.ok(loaded() > empty(), `${loaded()} should beat ${empty()}`)
    assert.ok(loaded() <= EXERTION.MAX, 'and still respect the ceiling')
})

test('exertion settles at rest, and settles fastest asleep', () => {
    const cool = (behaviorState, updates) => {
        const n = new PawnNeeds({ behaviorState })
        n.exertion = 1
        n.lastNeedsUpdate = 0
        for (let t = 1; t <= updates * 5; t++) n.updateNeeds(t)
        return n.exertion
    }
    // Linear, so the arithmetic is checkable rather than merely smaller.
    assert.ok(Math.abs(cool('idle', 4) - (1 - 4 * EXERTION.DECAY)) < 1e-12, `idle: ${cool('idle', 4)}`)
    assert.ok(Math.abs(cool('resting', 4) - (1 - 4 * EXERTION.DECAY * EXERTION.REST_DECAY)) < 1e-12, `resting: ${cool('resting', 4)}`)
    assert.ok(cool('sleeping', 4) < cool('resting', 4), 'sleep is the best recovery')
    assert.equal(cool('sleeping', 20), 0, 'a night asleep should clear any afternoon')
    assert.ok(cool('idle', 20) > 0, 'but standing about does not')
})

// --- the decision it feeds -------------------------------------------------

test('a tired pawn weights distance, a fresh one does not', () => {
    const needs = new PawnNeeds({ behaviorState: 'idle' })
    assert.equal(needs.distanceWeight(), 1)
    needs.exertion = 0.5
    assert.equal(needs.distanceWeight(), 1 + EXERTION.GOAL_DISTANCE_GAIN * 0.5)
    needs.exertion = 99
    assert.equal(needs.distanceWeight(), 1 + EXERTION.GOAL_DISTANCE_GAIN, 'capped')
})

test('winded, the near shabby patch beats the well-remembered far one', () => {
    // A crossroads the pre-#104 pawn could only resolve one way: distance is
    // the only term in this ranking that is walked, so it is the term that has
    // to become dearer when the walker is spent.
    const pawn = makePawn()
    pawn.world.clock = { currentTick: 0 }
    pawn.resourceMemory = [
        { type: 'fiber_plant', x: 100, y: 0, lastSeen: 0, confidence: 0.4, clusterCount: 1 },
        { type: 'fiber_plant', x: 150, y: 0, lastSeen: 0, confidence: 0.95, clusterCount: 1 }
    ]

    const fresh = pawn.recallResourcesByType('fiber_plant')
    assert.equal(fresh[0].confidence, 0.95, 'a fresh pawn goes for the better memory')

    pawn.needs.exertion = 1
    const winded = pawn.recallResourcesByType('fiber_plant')
    assert.equal(winded[0].confidence, 0.4, 'a winded one walks to the nearest')
})

test('an entity with no needs system still walks', () => {
    const animal = new MobileEntity('a', 'a', 0, 0)
    animal.world = flatWorld()
    animal.setValidatedTarget(100, 0)
    assert.equal(animal.move(), true)
    assert.ok(animal.x > 0)
    assert.equal(animal.needs, undefined, 'animals were never given needs; #104 does not invent any')
})
