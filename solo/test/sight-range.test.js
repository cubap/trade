import test from 'node:test'
import assert from 'node:assert'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import {
    DEFAULT_SIGHT_RANGE,
    VISION_HIDDEN_CAP,
    VISION_STALE_TICKS,
    REMEMBER_RADIUS,
    PIN_STYLES,
    sightRangeFor,
    sightSummary,
    hiddenAt,
    isRememberedNear,
    resourceKindOf,
    classifyPin,
    ringPoints,
    describeHiddenEntry,
    describeSight
} from '../js/core/SightRange.js'
import { explainIfHidden } from '../js/ui/canvasInteractions.js'

/**
 * #90: the UI is allowed to say "hidden" instead of "absent", but only because
 * the simulation already worked out what it could not see. These tests pin the
 * read-only layer that answers "how far can this pawn actually see?" and
 * "why can't it see that?" - all of it derived from the vision report #80's
 * line-of-sight pass leaves behind, never re-marched per frame.
 */

// --- how far can it see? -----------------------------------------------------

test('sight range comes from the last pass, then the trait, then the default', () => {
    assert.strictEqual(sightRangeFor({ vision: { rangeUsed: 163 } }), 163)
    assert.strictEqual(sightRangeFor({ traits: { detection: 90 } }), 90)
    assert.strictEqual(sightRangeFor({}), DEFAULT_SIGHT_RANGE)
    assert.strictEqual(sightRangeFor(null), DEFAULT_SIGHT_RANGE)
    // A garbage range from a half-built entity must not reach the draw loop.
    assert.strictEqual(sightRangeFor({ vision: { rangeUsed: NaN }, traits: { detection: 80 } }), 80)
})

test('a report is dimmed against the range the pawn would have in the open', () => {
    const summary = sightSummary({ vision: { baseRange: 200, rangeUsed: 155, observed: 4, blocked: 2 } })
    assert.strictEqual(summary.range, 155)
    assert.strictEqual(summary.nominal, 200)
    assert.strictEqual(summary.dimmed, true)
    assert.strictEqual(summary.observed, 4)
    assert.strictEqual(summary.blocked, 2)
    assert.strictEqual(summary.fresh, true)

    const open = sightSummary({ vision: { baseRange: 200, rangeUsed: 200 } })
    assert.strictEqual(open.dimmed, false)
    // Half a metre of rounding is not "blocked by terrain".
    assert.strictEqual(sightSummary({ vision: { baseRange: 200, rangeUsed: 199.8 } }).dimmed, false)
})

test('a stale report stops advertising hidden things', () => {
    const pawn = { vision: { tick: 10, baseRange: 200, rangeUsed: 200, blocked: 3, hidden: [{ x: 1, y: 1 }] } }
    assert.strictEqual(sightSummary(pawn, { tick: 10 + VISION_STALE_TICKS }).hidden.length, 1)
    const old = sightSummary(pawn, { tick: 10 + VISION_STALE_TICKS + 1 })
    assert.strictEqual(old.fresh, false)
    assert.deepStrictEqual(old.hidden, [])
})

// --- what does a pin mean? ---------------------------------------------------

test('the hidden log answers for a spot, and only for a spot', () => {
    const pawn = { vision: { hidden: [{ x: 220, y: 100, reason: 'ridge' }, { x: 400, y: 400, reason: 'cover' }] } }
    assert.strictEqual(hiddenAt(pawn, 221, 101)?.reason, 'ridge')
    assert.strictEqual(hiddenAt(pawn, 400, 400)?.reason, 'cover')
    assert.strictEqual(hiddenAt(pawn, 220, 130), null)
    assert.strictEqual(hiddenAt({ vision: null }, 1, 1), null)
})

test('memory is matched by kind and radius', () => {
    const pawn = { resourceMemory: [{ type: 'rock', x: 100, y: 100 }] }
    assert.strictEqual(isRememberedNear(pawn, 105, 102, 'rock'), true)
    assert.strictEqual(isRememberedNear(pawn, 100 + REMEMBER_RADIUS + 1, 100, 'rock'), false)
    assert.strictEqual(isRememberedNear(pawn, 100, 100, 'stick'), false, 'a remembered rock is not a remembered stick')
    assert.strictEqual(resourceKindOf({ type: 'immobile', subtype: 'rock' }), 'rock')
    assert.strictEqual(resourceKindOf({ type: 'pawn' }), 'pawn')
})

test('every map pin resolves to one of four states, and only those', () => {
    assert.deepStrictEqual(Object.keys(PIN_STYLES).sort(), ['hidden', 'remembered', 'seen', 'unknown'])

    const pawn = {
        x: 100, y: 100,
        traits: { detection: 100 },
        vision: { baseRange: 200, rangeUsed: 200, hidden: [{ x: 220, y: 100, reason: 'ridge' }] },
        resourceMemory: [{ type: 'rock', x: 600, y: 600 }]
    }
    assert.strictEqual(classifyPin(pawn, pawn), 'seen', 'you always see yourself')
    assert.strictEqual(classifyPin(pawn, { x: 150, y: 100, subtype: 'rock' }), 'seen')
    assert.strictEqual(classifyPin(pawn, { x: 220, y: 100, subtype: 'rock' }), 'hidden')
    assert.strictEqual(classifyPin(pawn, { x: 602, y: 598, subtype: 'rock' }), 'remembered')
    assert.strictEqual(classifyPin(pawn, { x: 900, y: 900, subtype: 'rock' }), 'unknown')
    assert.strictEqual(classifyPin(null, { x: 1, y: 1 }), 'unknown')
})

test('hidden outranks seen, because the pass already ruled on it', () => {
    const pawn = {
        x: 0, y: 0, traits: { detection: 500 },
        vision: { baseRange: 500, rangeUsed: 500, hidden: [{ x: 10, y: 0, reason: 'cover' }] }
    }
    assert.strictEqual(classifyPin(pawn, { x: 10, y: 0, subtype: 'stick' }), 'hidden')
})

// --- drawing ----------------------------------------------------------------

test('the sight ring is a closed loop or nothing at all', () => {
    const points = ringPoints(0, 0, 50)
    assert.ok(points.length >= 4)
    assert.deepStrictEqual(points[0], points[points.length - 1], 'callers stroke without a final move')
    assert.ok(points.every(p => Math.abs(Math.hypot(p.x, p.y) - 50) < 1e-9))
    assert.deepStrictEqual(ringPoints(0, 0, 0), [])
    assert.deepStrictEqual(ringPoints(NaN, 0, 50), [])
    assert.strictEqual(ringPoints(0, 0, 50, 1).length, 4, 'the segment count is floored to a triangle')
    assert.strictEqual(ringPoints(10, -10, 5, 8).length, 9)
})

// --- wording ----------------------------------------------------------------

test('the HUD line says what sight reaches and what it hides', () => {
    assert.strictEqual(describeSight({}), '')
    const line = describeSight({
        vision: {
            baseRange: 200, rangeUsed: 160, observed: 5, blocked: 3,
            hidden: [{ x: 1, y: 1, reason: 'ridge', blockedAt: 37, why: 'a ridge is in the way about 37m out' }]
        }
    })
    assert.match(line, /^sight 160\/200m/)
    assert.match(line, /3 hidden \(a ridge is in the way about 37m out\)/)
    assert.match(line, /5 in view/)
    assert.ok(!describeSight({ vision: { baseRange: 200, rangeUsed: 200, observed: 2, blocked: 0 } }).includes('hidden'))
})

test('hidden entries explain themselves even without a cached sentence', () => {
    assert.strictEqual(describeHiddenEntry(null), '')
    assert.strictEqual(
        describeHiddenEntry({ reason: 'ridge', blockedAt: 41 }),
        'a ridge is in the way about 41m out'
    )
    assert.strictEqual(describeHiddenEntry({ reason: 'cover' }), 'the vegetation is too thick')
    assert.strictEqual(describeHiddenEntry({ reason: 'nonsense' }), 'something is in the way')
    assert.strictEqual(describeHiddenEntry({ why: 'verbatim' }), 'verbatim')
})

// --- wiring into the pawn ----------------------------------------------------

const hill = (peak, centre, sigma) => x => peak * Math.exp(-((x - centre) ** 2) / (2 * sigma * sigma))

function losWorld({ elevation = () => 0, chunkSize = 200 } = {}) {
    return {
        chunkSize,
        getElevationAt: (x, y) => elevation(x, y),
        getChunkAtPosition: () => ({ biome: 'plains', coverDensity: 0 }),
        getChunkCoordsAtPosition: (x, y) => ({
            chunkX: Math.floor(x / chunkSize),
            chunkY: Math.floor(y / chunkSize)
        })
    }
}

function pawnWatching(chunkManager, entities) {
    const pawn = new Pawn('p1', 'Watcher', 100, 100)
    pawn.chunkManager = chunkManager
    const size = chunkManager.chunkSize
    pawn.chunkManager.getChunk = (cx, cy) => ({
        entities: entities.filter(e => Math.floor(e.x / size) === cx && Math.floor(e.y / size) === cy)
    })
    return pawn
}

test('an observation pass records what it could not see, in the pawn\'s own words', () => {
    const outcrop = { x: 220, y: 100, type: 'immobile', subtype: 'rock', name: 'flint outcrop', gather: () => ({}) }
    const open = { x: 150, y: 100, type: 'immobile', subtype: 'stick', name: 'twig', gather: () => ({}) }
    const pawn = pawnWatching(losWorld({ elevation: x => hill(14, 160, 12)(x) }), [outcrop, open])

    pawn.observeNearbyResources(200)

    assert.strictEqual(pawn.resourceMemory.length, 1, 'only the twig is remembered')
    assert.strictEqual(pawn.vision.blocked, 1)
    assert.strictEqual(pawn.vision.hidden.length, 1)
    const entry = pawn.vision.hidden[0]
    assert.strictEqual(entry.x, 220)
    assert.strictEqual(entry.type, 'rock', 'the log uses the resource kind the UI files pins under')
    assert.strictEqual(entry.reason, 'ridge')
    assert.match(entry.why, /ridge/)
    assert.ok(Number.isFinite(entry.distance) && entry.distance > 0)

    assert.strictEqual(classifyPin(pawn, outcrop, { tick: pawn.vision.tick }), 'hidden')
    assert.strictEqual(pawn.describeHidden(220, 100), entry.why)
    assert.match(pawn.sightReport(), /^sight \d+/)
    assert.match(pawn.sightReport(), /1 hidden/)
})

test('a spot the pawn never evaluated is answered fresh', () => {
    const pawn = pawnWatching(losWorld(), [])
    pawn.observeNearbyResources(200)
    assert.strictEqual(pawn.vision.hidden.length, 0)
    // 900 units away: nothing was recorded, so the question is marched on demand.
    assert.match(pawn.describeHidden(1000, 100), /farther than I can see|something is in the way/)
})

test('the hidden log is capped, but the count is not', () => {
    const many = Array.from({ length: VISION_HIDDEN_CAP + 8 }, (_, i) => ({
        x: 210 + (i % 4), y: 90 + Math.floor(i / 4) * 3,
        type: 'immobile', subtype: 'rock', name: `rock${i}`, gather: () => ({})
    }))
    const pawn = pawnWatching(losWorld({ elevation: x => hill(14, 160, 12)(x) }), many)
    pawn.observeNearbyResources(200)

    assert.ok(pawn.vision.blocked > VISION_HIDDEN_CAP, `expected a full blind spot, got ${pawn.vision.blocked}`)
    assert.strictEqual(pawn.vision.hidden.length, VISION_HIDDEN_CAP)
})

// --- clicking on something the pawn cannot see -------------------------------

test('clicking a hidden thing says so instead of looking like an empty world', () => {
    const outcrop = { x: 220, y: 100, type: 'immobile', subtype: 'rock', name: 'flint outcrop', gather: () => ({}) }
    const notices = []
    const renderer = {
        followedEntity: pawnWatching(losWorld({ elevation: x => hill(14, 160, 12)(x) }), [outcrop]),
        showNotice: text => notices.push(text)
    }
    renderer.followedEntity.observeNearbyResources(200)

    assert.strictEqual(explainIfHidden(renderer, outcrop, 220, 100), true)
    assert.strictEqual(notices.length, 1)
    assert.match(notices[0], /Watcher cannot see that from here/)
    assert.match(notices[0], /ridge/)

    assert.strictEqual(explainIfHidden(renderer, renderer.followedEntity, 100, 100), false, 'you can see yourself')
    assert.strictEqual(explainIfHidden({ followedEntity: null }, outcrop, 1, 1), false)
    assert.strictEqual(explainIfHidden(renderer, { x: 150, y: 100 }, 150, 100), false, 'a visible thing stays quiet')
    assert.strictEqual(notices.length, 1)
})
