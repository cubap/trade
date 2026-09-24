import test from 'node:test'
import assert from 'node:assert'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import Rock from '../js/models/entities/resources/Rock.js'
import World from '../js/core/World.js'
import {
    analyzeLineOfSight,
    hasLineOfSight,
    createTerrainLosContext,
    createLineOfSightCache,
    describeBlocker,
    SAMPLE_STEP,
    EYE_HEIGHT
} from '../js/core/LineOfSight.js'

/**
 * Terrain stub: elevation() gives the ground height, cover() says where the
 * brush is thick enough to swallow a ray (coverDensity is reported on the
 * chunk's native 0-100 scale). Both default to "boring" so each test only has
 * to describe the one feature it cares about.
 */
function losWorld({ elevation = () => 0, cover = () => false, chunkSize = 200 } = {}) {
    return {
        chunkSize,
        getElevationAt: (x, y) => elevation(x, y),
        getChunkAtPosition: (x, y) => ({ biome: 'plains', coverDensity: cover(x, y) ? 90 : 0 }),
        getChunkCoordsAtPosition: (x, y) => ({
            chunkX: Math.floor(x / chunkSize),
            chunkY: Math.floor(y / chunkSize)
        })
    }
}

function contextFor(chunkManager) {
    const context = createTerrainLosContext(chunkManager)
    assert.ok(context, 'stub chunk manager should produce a LOS context')
    return context
}

/** Sight line from the origin straight down the x axis. */
function sight(chunkManager, targetX, options = {}) {
    return analyzeLineOfSight(contextFor(chunkManager), { x: 0, y: 0 }, { x: targetX, y: 0 }, { baseRange: 500, ...options })
}

const hill = (peak, centre, sigma) => x => peak * Math.exp(-((x - centre) ** 2) / (2 * sigma * sigma))

test('flat ground does not block sight', () => {
    const result = sight(losWorld(), 120)
    assert.strictEqual(result.visible, true)
    assert.strictEqual(result.reason, null)
    assert.strictEqual(result.blocker, null)
    assert.strictEqual(result.samples > 1, true)
    assert.strictEqual(hasLineOfSight(contextFor(losWorld()), { x: 0, y: 0 }, { x: 120, y: 0 }, { baseRange: 500 }), true)
})

test('a ridge between the two points blocks sight and reports where', () => {
    // Crest at x=60 towers over the ~2 unit eye line, so the far side is hidden.
    const result = sight(losWorld({ elevation: hill(14, 60, 12) }), 120)
    assert.strictEqual(result.visible, false)
    assert.strictEqual(result.reason, 'ridge')
    assert.strictEqual(result.blocker.kind, 'ridge')
    // The march reports the *first* ground that breaks the ray, which is the near
    // shoulder of the hill rather than its crest.
    assert.ok(result.blocker.x > 25 && result.blocker.x < 62, `first blocker reported at x=${result.blocker.x}`)
    assert.ok(result.blocker.clearance > 0.35, `crest should clear the ray, got ${result.blocker.clearance}`)
    assert.ok(result.blocker.distanceFromObserver > 0 && result.blocker.distanceFromObserver < 120)
})

test('a target standing on the slope is still visible', () => {
    // The ray climbs with the ground, so the same hill that hides what is behind
    // it cannot hide its own shoulder.
    const chunkManager = losWorld({ elevation: hill(14, 60, 12) })
    assert.strictEqual(hasLineOfSight(contextFor(chunkManager), { x: 0, y: 0 }, { x: 40, y: 0 }, { baseRange: 500 }), true)
})

test('a bump lower than the eye does not block sight', () => {
    assert.strictEqual(sight(losWorld({ elevation: hill(1.2, 60, 8) }), 120).visible, true)
})

test('gentle slopes do not block sight', () => {
    // A ramp the pawn is walking up: ground rises, but never above the ray.
    const result = sight(losWorld({ elevation: x => x * 0.05 }), 120)
    assert.strictEqual(result.visible, true, describeBlocker(result))
})

test('a short hop is never blocked', () => {
    // Even a cliff cannot hide what is a single step away, which is how a pawn
    // at the foot of a ridge still sees the ridge itself.
    const chunkManager = losWorld({ elevation: x => (x < 5 ? 0 : 400) })
    assert.strictEqual(sight(chunkManager, SAMPLE_STEP * 0.9).visible, true)
})

test('unbroken dense cover blocks, a short dense strip does not', () => {
    const thin = sight(losWorld({ cover: (x) => x >= 54 && x <= 66 }), 120)
    assert.strictEqual(thin.visible, true, describeBlocker(thin))

    const thick = sight(losWorld({ cover: (x) => x >= 15 && x <= 105 }), 120)
    assert.strictEqual(thick.visible, false)
    assert.strictEqual(thick.reason, 'cover')
    assert.ok(thick.blocker.cover > 0.5)
    assert.ok(thick.blocker.distanceFromObserver > 15, 'the pawn should see into the first edge of the brush')
})

test('broken-up thick ground shortens range instead of hiding one spot', () => {
    // Alternating 12-unit strips: no single run is long enough to hide the far
    // side, but most of the ray is brush, so the horizon pulls in.
    const result = sight(losWorld({ cover: (x) => (x % 20) < 12 }), 200, { baseRange: 200 })
    assert.strictEqual(result.visible, false)
    assert.strictEqual(result.reason, 'range')
    assert.strictEqual(result.blocker.kind, 'range')
    assert.ok(result.denseFraction > 0.4, `expected mostly dense ground, got ${result.denseFraction}`)
    assert.ok(result.rangeUsed < 200, `range should shrink, got ${result.rangeUsed}`)
    assert.ok(result.rangeUsed >= 200 * 0.45, `range must not collapse below the floor, got ${result.rangeUsed}`)
    assert.ok(result.distance > result.rangeUsed)
})

test('cover inside a single chunk hides more', () => {
    // Same 24 unit strip. A pawn reading brush it is standing in knows its way
    // through it, so it only blinds a pawn looking in from outside.
    const sameChunk = sight(losWorld({ chunkSize: 200, cover: (x) => x >= 40 && x <= 64 }), 120)
    assert.strictEqual(sameChunk.visible, true, describeBlocker(sameChunk))

    const acrossChunks = sight(losWorld({ chunkSize: 20, cover: (x) => x >= 40 && x <= 64 }), 120)
    assert.strictEqual(acrossChunks.visible, false)
    assert.strictEqual(acrossChunks.reason, 'cover')
})

test('missing terrain data fails open', () => {
    assert.strictEqual(createTerrainLosContext(null), null)
    assert.strictEqual(createTerrainLosContext({}), null)

    const result = analyzeLineOfSight(null, { x: 0, y: 0 }, { x: 500, y: 0 })
    assert.strictEqual(result.visible, true)
    assert.strictEqual(result.degraded, true)
    assert.strictEqual(result.samples, 0)

    // A sampler that cannot answer for part of the map must not blind anyone.
    const flaky = losWorld({ elevation: x => (x > 50 ? null : 0) })
    assert.strictEqual(sight(flaky, 120).visible, true)
})

test('the per-tick cache memoises a march and clears when the tick advances', () => {
    let samples = 0
    const context = contextFor(losWorld({ elevation: (x) => { samples++; return hill(14, 60, 12)(x) } }))
    const cache = createLineOfSightCache(context)
    const from = { x: 0, y: 0 }
    const to = { x: 120, y: 0 }

    const first = cache.check(from, to, { baseRange: 200 })
    const sampledAfterFirst = samples
    assert.ok(sampledAfterFirst > 0, 'the first probe must sample the terrain')
    assert.deepStrictEqual(cache.check(from, to, { baseRange: 200 }), first)
    assert.strictEqual(samples, sampledAfterFirst, 'a repeat probe in the same tick must not re-sample')

    // Keys are symmetric, so the reciprocal probe is free too.
    cache.check(to, from, { baseRange: 200 })
    assert.strictEqual(samples, sampledAfterFirst)

    // A different range is a different question.
    cache.check(from, to, { baseRange: 50 })
    assert.ok(samples > sampledAfterFirst, 'a different base range must not reuse the cached answer')

    cache.beginTick(1)
    const before = samples
    cache.check(from, to, { baseRange: 200 })
    assert.ok(samples > before, 'a new tick must re-sample')
    assert.ok(cache.size >= 1)
})

test('a cache without a context still answers', () => {
    const cache = createLineOfSightCache(null)
    assert.strictEqual(cache.check({ x: 0, y: 0 }, { x: 300, y: 0 }, { baseRange: 100 }).visible, true)
})

test('blockers are described the way a pawn would say it', () => {
    const ridge = sight(losWorld({ elevation: hill(14, 60, 12) }), 120)
    const text = describeBlocker(ridge)
    assert.match(text, /ridge/)
    assert.match(text, /about \d+m out/)

    assert.strictEqual(describeBlocker({ visible: true }), '')
    assert.match(describeBlocker({ visible: false, reason: 'cover', blocker: null }), /vegetation/)
    assert.match(describeBlocker({ visible: false, reason: 'nonsense' }), /something is in the way/)
})

test('the tunables the UI hint is calibrated against stay sane', () => {
    assert.ok(EYE_HEIGHT > 1 && EYE_HEIGHT < 4, `EYE_HEIGHT=${EYE_HEIGHT}`)
    assert.ok(SAMPLE_STEP > 0 && SAMPLE_STEP <= 4, `SAMPLE_STEP=${SAMPLE_STEP}`)
})

// --- Wiring into the pawn ----------------------------------------------------

function pawnWatching(chunkManager, entities) {
    const pawn = new Pawn('p1', 'Watcher', 100, 100)
    pawn.chunkManager = chunkManager
    const size = chunkManager.chunkSize
    // Hand out entities the way the real chunk manager does: only from the chunk
    // that actually contains them.
    pawn.chunkManager.getChunk = (cx, cy) => ({
        entities: entities.filter(e => Math.floor(e.x / size) === cx && Math.floor(e.y / size) === cy)
    })
    return pawn
}

test('a pawn does not remember what it cannot see', () => {
    const hidden = { x: 220, y: 100, type: 'flint', name: 'flint outcrop', gather: () => ({}) }
    const inTheOpen = { x: 160, y: 100, type: 'flint', name: 'near flint', gather: () => ({}) }

    const behindRidge = pawnWatching(losWorld({ elevation: (x) => hill(14, 160, 12)(x) }), [hidden])
    const onFlat = pawnWatching(losWorld(), [inTheOpen])

    behindRidge.observeNearbyResources(200)
    onFlat.observeNearbyResources(200)

    assert.strictEqual(behindRidge.resourceMemory.length, 0, 'the outcrop behind the ridge stays forgotten')
    assert.strictEqual(behindRidge.vision.blocked, 1)
    assert.ok(onFlat.resourceMemory.length >= 1, 'the outcrop in the open gets remembered')
    assert.strictEqual(onFlat.vision.blocked, 0)
    assert.strictEqual(onFlat.vision.observed, 1)
})

test('a pawn reports how far it could actually see', () => {
    const pawn = pawnWatching(losWorld({ elevation: (x) => hill(14, 160, 12)(x) }), [])
    pawn.observeNearbyResources(200)
    assert.strictEqual(pawn.vision.baseRange, 200)
    assert.ok(pawn.vision.rangeUsed > 0 && pawn.vision.rangeUsed <= 200, `rangeUsed=${pawn.vision.rangeUsed}`)
    assert.strictEqual(pawn.vision.observed, 0)
})

test('canSee agrees with the observation pass', () => {
    const pawn = pawnWatching(losWorld({ elevation: (x) => hill(14, 160, 12)(x) }), [])
    assert.strictEqual(pawn.canSee(220, 100, { baseRange: 500 }), false)
    assert.strictEqual(pawn.canSee(140, 100, { baseRange: 500 }), true)
})

test('a pawn with no terrain data still observes normally', () => {
    const bare = losWorld()
    delete bare.getElevationAt
    const resource = { x: 140, y: 100, type: 'flint', name: 'flint', gather: () => ({}) }
    const pawn = pawnWatching(bare, [resource])
    pawn.observeNearbyResources(200)
    assert.ok(pawn.resourceMemory.length >= 1, 'a bare World must not blind the pawn')
    assert.strictEqual(pawn.vision.blocked, 0)
    assert.strictEqual(pawn.canSee(500, 100), true)
})

test('a pawn with no chunk manager does not throw', () => {
    const pawn = new Pawn('p2', 'Blind', 10, 10)
    assert.doesNotThrow(() => pawn.observeNearbyResources(50))
    assert.strictEqual(pawn.canSee(900, 900), true)
    assert.strictEqual(pawn.lineOfSight(), null)
})

// --- Calibration against the map the generator actually produces -------------
//
// The stub above proves the geometry works. These prove it is tuned to the real
// terrain, where the ground wobbles a few units everywhere and coverDensity only
// ever reaches 60. Without this guard it is easy to ship a threshold that hides
// literally everything, which is a broken game rather than a subtle bug.

const LOS_MAP_SEED = 4242

function realWorld() {
    // Same seed as the dormant-simulation tests: ChunkManager defaults to
    // Math.random(), so an unpinned map would make these rates flaky.
    return new World(1200, 1200, { chunkSize: 200, activeChunkRadius: 2, mapSeed: LOS_MAP_SEED })
}

function blockRate(context, length) {
    let blocked = 0
    let total = 0
    for (let k = 0; k < 400; k++) {
        // Deterministic scatter across the map, eight headings.
        const x = 60 + ((k * 131) % 1000)
        const y = 60 + ((k * 71) % 1000)
        const angle = (k % 8) * Math.PI / 4
        const to = { x: x + length * Math.cos(angle), y: y + length * Math.sin(angle) }
        if (to.x > 1140 || to.y > 1140) continue
        total++
        if (!analyzeLineOfSight(context, { x, y }, to, { baseRange: 2000 }).visible) blocked++
    }
    return blocked / total
}

test('real ridges hide a growing share of long sight lines, not most sight lines', () => {
    const world = realWorld()
    const context = contextFor(world.chunkManager)

    const near = blockRate(context, 30)
    const mid = blockRate(context, 100)
    const far = blockRate(context, 300)

    assert.ok(near < 0.08, `a pawn's own doorstep should rarely be hidden, got ${(near * 100).toFixed(1)}%`)
    assert.ok(far > mid && mid > near, `occlusion should grow with distance: ${near} / ${mid} / ${far}`)
    assert.ok(far < 0.35, `long sight lines must mostly work, got ${(far * 100).toFixed(1)}%`)
})

test('forest shortens a pawn’s horizon without walling it off', () => {
    const world = realWorld()
    const context = contextFor(world.chunkManager)
    const baseRange = 200

    const meanRange = (wantDense) => {
        let sum = 0
        let count = 0
        for (let x = 60; x < 1000; x += 60) {
            for (let y = 60; y < 1000; y += 60) {
                const density = world.chunkManager.getChunkAtPosition(x, y)?.coverDensity ?? 0
                if ((density >= 55) !== wantDense) continue
                sum += analyzeLineOfSight(context, { x, y }, { x: x + baseRange / 2, y }, { baseRange }).rangeUsed
                count++
            }
        }
        assert.ok(count > 10, `expected enough ${wantDense ? 'forest' : 'open'} samples, got ${count}`)
        return sum / count
    }

    const forest = meanRange(true)
    const open = meanRange(false)
    assert.ok(forest < open * 0.95, `forest (${forest}) should see less far than open ground (${open})`)
    assert.ok(forest > baseRange * 0.5, `forest must not blind anyone, got range ${forest}`)
})

test('a rock behind real terrain stays off a pawn’s memory', () => {
    const world = realWorld()
    const context = contextFor(world.chunkManager)

    // Find a pawn-sized shadow deterministically: walk headings at the game's own
    // perception radius until the map hides something.
    let spot = null
    for (let k = 0; k < 24 && !spot; k++) {
        const x = 90 + ((k * 211) % 780)
        const y = 90 + ((k * 149) % 780)
        for (let h = 0; h < 96 && !spot; h++) {
            const angle = (h / 96) * Math.PI * 2
            const hidden = { x: Math.round(x + 50 * Math.cos(angle)), y: Math.round(y + 50 * Math.sin(angle)) }
            if (hidden.x < 30 || hidden.y < 30 || hidden.x > 1150 || hidden.y > 1150) continue
            if (!analyzeLineOfSight(context, { x, y }, hidden, { baseRange: 60 }).visible) {
                const clearAngle = ((h + 48) % 96) * Math.PI / 48
                const open = { x: Math.round(x + 50 * Math.cos(clearAngle)), y: Math.round(y + 50 * Math.sin(clearAngle)) }
                if (analyzeLineOfSight(context, { x, y }, open, { baseRange: 60 }).visible) spot = { x, y, hidden, open }
            }
        }
    }
    assert.ok(spot, 'the sample map must cast at least one shadow at perception range')

    const pawn = new Pawn('los-shadow', 'Shadowwatcher', spot.x, spot.y)
    world.addEntity(pawn)
    const hiddenRock = new Rock('los-shadow-rock', spot.hidden.x, spot.hidden.y)
    const openRock = new Rock('los-open-rock', spot.open.x, spot.open.y)
    world.addEntity(hiddenRock)
    world.addEntity(openRock)

    pawn.observeNearbyResources(60)

    const remembered = m => pawn.resourceMemory.some(r => Math.abs(r.x - m.x) < 1 && Math.abs(r.y - m.y) < 1)
    assert.strictEqual(remembered(spot.hidden), false, `a rock 50 units away behind a ridge should stay hidden: ${JSON.stringify(spot)}`)
    assert.strictEqual(remembered(spot.open), true, 'the rock in the open should be spotted')
    assert.ok(pawn.vision.blocked >= 1)
})

test('sight gating keeps nearly everything a pawn could already find', () => {
    const world = realWorld()
    let remembered = 0
    let inRange = 0
    let blocked = 0

    const log = console.log
    console.log = () => {} // the pawn's own memory chatter would bury the test output
    try {
        for (let k = 0; k < 25; k++) {
            const x = 80 + ((k * 137) % 900)
            const y = 80 + ((k * 89) % 900)
            const pawn = new Pawn(`los-p${k}`, `Watcher${k}`, x, y)
            world.addEntity(pawn)

            const rocks = []
            for (let r = 0; r < 6; r++) {
                const rock = new Rock(`los-rock-${k}-${r}`, x + 20 + r * 5, y + 3)
                world.addEntity(rock)
                rocks.push(rock)
            }

            pawn.observeNearbyResources(60)
            blocked += pawn.vision.blocked

            for (const rock of rocks) {
                inRange++
                const seen = pawn.resourceMemory.some(m => Math.abs(m.x - rock.x) < 1 && Math.abs(m.y - rock.y) < 1)
                if (seen) remembered++
                // Memory and a direct probe must agree — same tick, same range.
                assert.strictEqual(pawn.canSee(rock.x, rock.y, { baseRange: 60 }), seen)
            }

            for (const rock of rocks) world.removeEntity?.(rock.id)
            world.removeEntity?.(pawn.id)
        }
    } finally {
        console.log = log
    }

    assert.strictEqual(inRange, 150)
    assert.ok(remembered / inRange > 0.9, `sight gating dropped too much: ${(100 * remembered / inRange).toFixed(1)}% kept`)
    assert.ok(blocked <= inRange * 0.2, `sight gating blocked too many lookups: ${blocked}/${inRange}`)
})
