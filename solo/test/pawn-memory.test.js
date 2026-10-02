import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'

// #111. Until recently this file opened with ~500 lines of `MockPawn`, a hand
// copy of seventeen of the real pawn's methods, and every assertion below ran
// against the copy. A forked test cannot fail when the thing it imitates
// changes, so the suite was green while the mock and `Pawn.js` disagreed about
// most of what memory is:
//
//   - the copy was built at memory phase 3 with a cap of 50, and evicted
//     unconditionally; a real pawn starts at phase 1 with room for 20 places and
//     climbs the ladder with its skills. From phase 3 it compresses rather than
//     evicts, which is #119; before the fix its list grew without limit
//   - the copy clustered at a fixed 20 units; the real radius is
//     `min(45, 18 + memoryClustering * 0.8)` and clustering is switched off
//     entirely until a pawn reaches phase 3 or learns enough clustering to
//     deserve it
//   - the copy never threw a memory away - there is no `splice` anywhere in it.
//     The real pawn forgets a patch it has failed on three times over, and
//     prunes anything below 0.1 confidence out of recall, which is the whole
//     point of keeping a failure count
//   - the copy's recall sort ignored tiredness (#104); the real one weights
//     distance by `needs.distanceWeight()`
//   - the copy's broadcast reached every pawn in the world; the real one stops
//     at 120 units, because gossip needs a witness
//   - the copy defined only `increaseSkill`, so even the practice of clustering
//     was booked as structure. That is the mistake #108 is about; the real path
//     pays `useSkill`, and #108's guard can only catch it in a file that reads
//     the real code.
//
// So the copy is gone. Everything below runs against `Pawn.js` itself, which
// means these tests can now be wrong in the useful way: when the sim changes,
// this file says so. Trail-aware route costing is deliberately not repeated
// here - `trail-route-cost.test.js` already covers it against real pawns.

const MAX_MEMORY_AGE = 2000 // recallResourcesByType's staleness window, in ticks

// The sim narrates about one sighting in twenty to the console, at random. That
// is fine in the browser and unreadable in a test run, and nothing here asserts
// on it, so logging is muted for this file and restored when it finishes.
const realLog = console.log
console.log = () => {}
after(() => { console.log = realLog })

function worldWith(...entities) {
    const world = new World(2000, 2000)
    for (const entity of entities) world.addEntity(entity)
    return world
}

/** A real pawn in a real world, because every memory method reads `this.world`. */
function lonePawn(id, { x = 500, y = 500 } = {}) {
    const pawn = new Pawn(id, id, x, y)
    worldWith(pawn)
    return pawn
}

/**
 * Trains a pawn and re-derives its memory phase from the skills, the way the
 * sim does, rather than assigning `memoryPhase` by hand.
 */
function train(pawn, skills = {}) {
    for (const [skill, amount] of Object.entries(skills)) pawn.increaseSkill(skill, amount)
    pawn.updateMemoryPhase()
    return pawn
}

/**
 * Remembers a resource through the production path, then tunes the fields the
 * production path has no verb for (confidence, cluster size, proven sightings).
 * The entry stays whatever `rememberResource` decided to make it.
 */
function rememberAt(pawn, type, x, y, tweaks = {}) {
    pawn.rememberResource({ type, x, y })
    const memory = pawn.resourceMemory.find(m => m.type === type && m.x === x && m.y === y)
    if (memory && Object.keys(tweaks).length) Object.assign(memory, tweaks)
    return memory
}

// --- validation -------------------------------------------------------------

test('a pawn only remembers resources it can actually describe', (t) => {
    t.mock.method(console, 'warn', () => {})
    const pawn = lonePawn('ada')

    const junk = [
        { type: 'rock', x: NaN, y: 100 },
        { type: 'rock', x: 100, y: undefined },
        { type: 'rock', x: '100', y: '100' },
        { type: 'rock', x: null, y: 100 }
    ]
    for (const bad of junk) {
        pawn.rememberResource(bad)
        assert.equal(pawn.resourceMemory.length, 0, `${JSON.stringify(bad)} is not a location`)
    }

    // No type, a numeric type, an empty type: the pawn has seen something but
    // cannot say what, and a memory of "something at (100,100)" is useless to
    // the planner that reads it back.
    pawn.rememberResource({ x: 100, y: 100 })
    pawn.rememberResource({ type: 7, x: 100, y: 100 })
    pawn.rememberResource({ type: '', x: 100, y: 100 })
    assert.equal(pawn.resourceMemory.length, 0)

    pawn.rememberResource({ type: 'rock', x: 100, y: 100, amount: 3, tags: ['quarry'] })
    assert.equal(pawn.resourceMemory.length, 1, 'a valid sighting is remembered')
    const memory = pawn.resourceMemory[0]
    assert.equal(memory.type, 'rock')
    assert.equal(memory.amount, 3)
    assert.deepEqual(memory.tags, ['quarry'], 'tags ride along - they drive recall-by-tag')
    assert.equal(memory.confidence, 0.7, 'a pawn starts optimistic about what it saw')
    assert.equal(memory.source, 'self', 'it knows it saw it itself')
    assert.equal(memory.clusterCount, 1)
    assert.equal(memory.lastSeen, pawn.world.clock.currentTick)
})

test('a resource on the edge of the map is still a resource', () => {
    // #95 fixed this for landmarks ("a place on the map's zero axes counts as a
    // place"); the resource path had the same truthiness test and was silently
    // dropping anything on x = 0 or y = 0, which is the whole shoreline.
    const pawn = lonePawn('quina')
    pawn.rememberResource({ type: 'reed', x: 0, y: 640 })
    pawn.rememberResource({ type: 'clay', x: 410, y: 0 })
    assert.deepEqual(pawn.resourceMemory.map(m => m.type).sort(), ['clay', 'reed'])

    // And the confidence update can find them again, which is the other half of
    // the same bug.
    pawn.updateResourceMemoryConfidence({ type: 'reed', x: 0, y: 640 }, true)
    const reed = pawn.resourceMemory.find(m => m.type === 'reed')
    assert.equal(reed.successCount, 1, 'a successful gather at x = 0 counts')
    assert.ok(reed.confidence > 0.7)
})

// --- phases, caps, clustering ----------------------------------------------

test('the memory phase is what the skills say it is', () => {
    const pawn = lonePawn('bo')
    assert.equal(pawn.memoryPhase, 1, 'a fresh pawn thinks egocentrically')
    assert.equal(pawn.maxResourceMemory, 20, 'and holds very little of it')

    train(pawn, { orienteering: 15 })
    assert.deepEqual([pawn.memoryPhase, pawn.maxResourceMemory], [2, 40])

    train(pawn, { cartography: 25 })
    assert.deepEqual([pawn.memoryPhase, pawn.maxResourceMemory], [3, 60], 'clusters unlock with cartography')

    train(pawn, { cartography: 25 })
    assert.deepEqual([pawn.memoryPhase, pawn.maxResourceMemory], [4, 100], 'conceptual maps at 50')
})

test('a young pawn evicts what it cannot hold, and every pawn keeps its cap', () => {
    const pawn = lonePawn('cid')
    // 21 rocks, 40 units apart: no clustering, no near-same-type nudge, so each
    // sighting is its own memory and the cap has to bite 21 times.
    for (let i = 0; i < 21; i++) pawn.rememberResource({ type: 'rock', x: 100 + i * 40, y: 100 })

    assert.equal(pawn.resourceMemory.length, pawn.maxResourceMemory, 'the cap holds')
    assert.ok(!pawn.resourceMemory.some(m => m.x === 100), 'the first sighting is what went')
    assert.equal(pawn.resourceMemory[0].x, 140, 'memories are evicted oldest-first when all else ties')
    assert.equal(pawn.resourceMemory.at(-1).x, 900, 'the newest sighting survives')

    // Phase 3 used to be where the promise broke. The eviction was gated on
    // `memoryPhase <= 2` because "cluster compression will handle this
    // differently", but compression only ever merged sightings that landed
    // inside the (18-45 unit) cluster radius, so thirty-unit spacing was never
    // compressed and nothing was ever evicted: the better a pawn's memory, the
    // less bounded it was (#119).
    const cartographer = train(lonePawn('atlas'), { cartography: 25 })
    assert.equal(cartographer.maxResourceMemory, 60)
    for (let i = 0; i < 61; i++) cartographer.rememberResource({ type: 'rock', x: 40 + i * 30, y: 300 })

    assert.equal(cartographer.resourceMemory.length, 60, 'the cap is a cap at phase 3 too')
    const merged = cartographer.resourceMemory.filter(m => (m.clusterCount ?? 1) > 1)
    assert.equal(merged.length, 1, 'one pair became rock country')
    assert.deepEqual([merged[0].x, merged[0].y], [55, 300], 'the patch sits between the two sightings')
    assert.equal(merged[0].clusterCount, 2)
    assert.equal(cartographer.resourceMemory.at(-1).x, 1840, 'the newest sighting is kept in full')
})

test('compression spends the oldest detail, never the sighting that paid for it', () => {
    const atlas = train(lonePawn('una'), { cartography: 25 })
    const cap = atlas.maxResourceMemory
    for (let i = 0; i < cap; i++) atlas.rememberResource({ type: 'rock', x: 40 + i * 30, y: 600 })
    assert.equal(atlas.resourceMemory.length, cap, 'exactly full, nothing merged yet')

    atlas.rememberResource({ type: 'rock', x: 40 + cap * 30, y: 600 })
    assert.equal(atlas.resourceMemory.length, cap)
    assert.equal(atlas.resourceMemory.at(-1).x, 40 + cap * 30, 'the new place is in the list as seen')
    assert.equal(atlas.resourceMemory[0].x, 55, 'the two oldest sightings are the ones that gave up their coordinates')
    assert.ok(!atlas.resourceMemory.some(m => m.x === 40), 'detail, not coverage, is what the cap costs')
})

test('a pawn with nothing to merge forgets instead of growing', () => {
    const atlas = train(lonePawn('zed'), { cartography: 25 })
    const cap = atlas.maxResourceMemory
    // Sixty different materials sixty units apart: no two entries share a type,
    // so compression has no pair to work with and the fallback must bite.
    for (let i = 0; i < cap; i++) atlas.rememberResource({ type: `ore_${i}`, x: 40 + i * 60, y: 900 })
    assert.equal(atlas.resourceMemory.length, cap)
    assert.equal(atlas.compressResourceMemory(), false, 'there is no same-type pair here')

    atlas.rememberResource({ type: 'quartz', x: 40 + cap * 60, y: 900 })
    assert.equal(atlas.resourceMemory.length, cap, 'the cap held without a merge')
    assert.ok(atlas.resourceMemory.some(m => m.type === 'quartz'), 'and the new material is what it kept')
})

test('a compressed patch carries both sightings: counts, tags and provenance', () => {
    const atlas = train(lonePawn('jo'), { cartography: 25 })
    atlas.resourceMemory.push(
        {
            type: 'fiber', tags: ['plant'], x: 100, y: 100, lastSeen: 5, amount: 3,
            id: 'near', successCount: 2, failCount: 0, confidence: 0.9, clusterCount: 4, memoryPhase: 3
        },
        {
            type: 'fiber', tags: ['wet'], x: 700, y: 100, lastSeen: 9, amount: 7,
            id: 'far', successCount: 1, failCount: 1, confidence: 0.6, clusterCount: 1, memoryPhase: 3
        }
    )

    assert.equal(atlas.compressResourceMemory(), true)
    assert.equal(atlas.resourceMemory.length, 1)
    const patch = atlas.resourceMemory[0]
    // Weighted by how many sightings each entry stands for: 4 near, 1 far.
    assert.equal(patch.x, 220, 'the patch leans toward the better-worked end')
    assert.equal(patch.y, 100)
    assert.equal(patch.clusterCount, 5)
    assert.equal(patch.successCount, 3, 'the work both places saw is not lost')
    assert.equal(patch.failCount, 1)
    assert.equal(patch.amount, 7)
    assert.equal(patch.lastSeen, 9, 'a memory is as fresh as its newest sighting')
    assert.deepEqual(patch.tags.sort(), ['plant', 'wet'])
    assert.equal(patch.id, 'near', 'the confident entry keeps its identity')
    assert.ok(patch.confidence > 0.9, 'knowing a thing is in two places raises it a little')
    assert.ok(patch.confidence <= 1, 'and never above one')

    assert.equal(atlas.compressResourceMemory(), false, 'one entry cannot merge with itself')
})

test('clustering is earned, and its radius is a skill reading, not a constant', () => {

    // Phase 1, no clustering skill: two sightings of the same patch twelve units
    // apart stay two memories. The pawn notices the proximity (it is paid a
    // little `memoryClustering` for it) but cannot yet compress it.
    const blunt = train(lonePawn('pat'), {})
    blunt.rememberResource({ type: 'rock', x: 100, y: 100 })
    blunt.rememberResource({ type: 'rock', x: 112, y: 108 })
    assert.equal(blunt.resourceMemory.length, 2, 'no clusters yet')
    assert.ok(blunt.getSkill('memoryClustering') > 0, 'noticing the pair is itself practice')
    assert.equal(blunt.skillLastUsed.memoryClustering, blunt.world.clock.currentTick, 'paid through the practice verb (#108)')

    // A cartographer merges them instead: the centroid moves to the middle of
    // the two sightings and the cluster counts both.
    const sharp = train(lonePawn('ivy'), { cartography: 25 })
    assert.equal(sharp.memoryPhase, 3)
    sharp.rememberResource({ type: 'rock', x: 100, y: 100 })
    sharp.rememberResource({ type: 'rock', x: 112, y: 108 })
    assert.equal(sharp.resourceMemory.length, 1, 'one patch, not two')
    const cluster = sharp.resourceMemory[0]
    assert.equal(cluster.clusterCount, 2)
    assert.deepEqual([cluster.x, cluster.y], [106, 104], 'the memory drifts toward the middle of the patch')
    assert.ok(cluster.confidence > 0.7, 'seeing it twice makes it better remembered, not merely bigger')

    // The radius is where the mock lied: it was a constant 20. Production is
    // 18 + 0.8 per point of memoryClustering, ceiling 45 - so a thirty-unit
    // pair merges only for a pawn that has practised it enough.
    const novice = train(lonePawn('newt'), { cartography: 25 })
    novice.rememberResource({ type: 'rock', x: 100, y: 100 })
    novice.rememberResource({ type: 'rock', x: 130, y: 100 })
    assert.equal(novice.resourceMemory.length, 2, 'at radius 18, thirty units is two places')

    const expert = train(lonePawn('sol'), { cartography: 25, memoryClustering: 20 })
    expert.rememberResource({ type: 'rock', x: 100, y: 100 })
    expert.rememberResource({ type: 'rock', x: 130, y: 100 })
    assert.equal(expert.resourceMemory.length, 1, 'at radius 34, thirty units is one place')
    assert.equal(expert.resourceMemory[0].clusterCount, 2)

    // Clustering also opens at 10 points of the skill on its own, with no
    // cartography at all - the gate is `phase >= 3 || skill >= 10`.
    const selfTaught = train(lonePawn('kit'), { memoryClustering: 10 })
    assert.equal(selfTaught.memoryPhase, 1)
    selfTaught.rememberResource({ type: 'rock', x: 100, y: 100 })
    selfTaught.rememberResource({ type: 'rock', x: 112, y: 108 })
    assert.equal(selfTaught.resourceMemory.length, 1, 'practice at grouping beats a phase gate')
})

test('a pawn at the same rock twice refreshes the memory instead of duplicating it', () => {
    const pawn = train(lonePawn('dee'), {})
    pawn.rememberResource({ type: 'rock', x: 100, y: 100, amount: 5 })
    pawn.world.clock.currentTick = 11
    pawn.rememberResource({ type: 'rock', x: 102, y: 102, amount: 10 })

    assert.equal(pawn.resourceMemory.length, 1, 'two sightings within five units are one memory')
    const memory = pawn.resourceMemory[0]
    assert.equal(memory.amount, 10, 'the later sighting says how much is there')
    assert.deepEqual([memory.x, memory.y], [102, 102], 'and where it is')
    assert.equal(memory.lastSeen, 11, 'and when it was seen')
})

// --- decay and recall ------------------------------------------------------

test('recall throws away what has gone stale or untrustworthy', () => {
    const pawn = lonePawn('eve')

    rememberAt(pawn, 'rock', 100, 100)
    pawn.world.clock.currentTick = MAX_MEMORY_AGE + 500
    assert.deepEqual(pawn.recallResourcesByType('rock'), [], 'a memory two thousand ticks old is not a plan')
    assert.equal(pawn.resourceMemory.length, 0, 'and it is gone from the ledger, not merely filtered out')

    // Low confidence is removed the same way; the sub-0.1 floor is the hard one.
    const doubting = rememberAt(pawn, 'stick', 200, 200, { confidence: 0.05 })
    assert.ok(doubting)
    assert.deepEqual(pawn.recallResourcesByType('stick'), [])
    assert.equal(pawn.resourceMemory.length, 0, 'a memory no one believes is not kept')

    // Between the hard floor and the recall threshold a memory is kept but
    // unserviceable: it survives the sweep and still fails to be recalled.
    rememberAt(pawn, 'fiber', 300, 300, { confidence: 0.15 })
    assert.deepEqual(pawn.recallResourcesByType('fiber'), [], 'below 0.2 it is not offered up')
    assert.equal(pawn.resourceMemory.length, 1, 'above 0.1 it is not destroyed')

    pawn.world.clock.currentTick = MAX_MEMORY_AGE + 501
    rememberAt(pawn, 'rock', 120, 100)
    const fresh = pawn.recallResourcesByType('rock')
    assert.equal(fresh.length, 1, 'a memory seen this tick is usable however old the ledger is')
    assert.equal(fresh[0].x, 120)
})

test('recall ranks by confidence, distance and what the pawn has heard, blended', () => {
    const pawn = lonePawn('jo')
    pawn.increaseSkill('routePlanning', 6)
    // Three patches, all seen this tick: a well-remembered one underfoot, a
    // half-remembered one nearby, a decently-remembered one across the map.
    rememberAt(pawn, 'rock', 500, 500, { confidence: 0.9 })
    rememberAt(pawn, 'rock', 510, 510, { confidence: 0.3 })
    rememberAt(pawn, 'rock', 600, 600, { confidence: 0.5 })

    const ranked = pawn.recallResourcesByType('rock')
    assert.deepEqual(ranked.map(m => m.confidence), [0.9, 0.3, 0.5])
    assert.equal(ranked[0].x, 500, 'confidence dominates')
    assert.equal(ranked[1].x, 510, 'but ten units of walking outweighs twice the memory of the far patch')

    // What other pawns report is a ranking term of its own (#105's evidence):
    // proven ground outranks better-remembered ground.
    const witness = lonePawn('kim')
    const dubious = rememberAt(witness, 'rock', 505, 500, { confidence: 0.6 })
    const proven = rememberAt(witness, 'rock', 545, 500, { confidence: 0.55, observedSuccessCount: 8 })
    assert.ok(witness.recallResourcesByType('rock')[0] === proven, 'a patch everyone got rock from comes first')
    assert.ok(dubious.clusterCount === proven.clusterCount, 'and it is not the cluster size doing the work')
})

test('a gathering plan is built from memory, and says so when it has none', () => {
    const pawn = train(lonePawn('lin'), { cartography: 25 })
    pawn.increaseSkill('routePlanning', 6)
    rememberAt(pawn, 'rock', 490, 500, { confidence: 0.9, clusterCount: 2 })
    rememberAt(pawn, 'fiber', 520, 500, { confidence: 0.8, clusterCount: 3 })

    assert.deepEqual(pawn.planGatheringRoute([]), [], 'nothing asked, nothing planned')

    const unknown = pawn.planGatheringRoute([{ type: 'diamond', count: 1 }])
    assert.equal(unknown.length, 1)
    assert.equal(unknown[0].location, null, 'a type with no memory is an expedition, not a route')
    assert.equal(unknown[0].fromMemory, false)

    const route = pawn.planGatheringRoute([{ type: 'rock', count: 2 }, { type: 'fiber', count: 1 }])
    assert.equal(route.length, 2)
    assert.deepEqual(route.map(s => s.type), ['rock', 'fiber'])
    for (const stop of route) {
        assert.ok(stop.location, `a remembered ${stop.type} has a destination`)
        assert.equal(stop.fromMemory, true)
        assert.ok(stop.confidence > 0)
        assert.ok(stop.clusterCount >= 1)
    }
    assert.equal(route[0].count, 2, 'the request rides along with the stop')
    assert.deepEqual(route[0].location, { x: 490, y: 500 })
    assert.ok(pawn.getSkill('routePlanning') > 6, 'planning a multi-stop run is practice at planning (#108)')

    // A single-stop plan is not worth the same praise as a route.
    const before = pawn.getSkill('routePlanning')
    pawn.planGatheringRoute([{ type: 'rock', count: 1 }])
    assert.equal(pawn.getSkill('routePlanning'), before, 'one stop is an errand, not a route')
})

test('a trained planner chooses a different patch than an untrained one', () => {
    // Below route planning 5 the pawn takes the top of its recall list, which
    // confidence dominates. At 5 and above it re-scores the candidates against
    // the cost of the walk, the size of the patch and what was seen there - so
    // the same memory can send two pawns to two different rocks.
    const seed = (pawn) => {
        rememberAt(pawn, 'rock', 505, 500, { confidence: 0.9, clusterCount: 1 })
        rememberAt(pawn, 'rock', 515, 500, { confidence: 0.6, clusterCount: 4 })
        return pawn
    }
    // Phase 1 pawns, so the two sightings ten units apart stay two memories:
    // clustering, which would merge them, is not earned until phase 3.
    const novice = seed(lonePawn('naif'))
    novice.increaseSkill('routePlanning', 3)
    assert.deepEqual(novice.planGatheringRoute([{ type: 'rock', count: 1 }])[0].location, { x: 505, y: 500 },
        'the unsure planner goes to the rock it is likeliest to remember')

    const adept = seed(lonePawn('ada'))
    adept.increaseSkill('routePlanning', 6)
    assert.deepEqual(adept.planGatheringRoute([{ type: 'rock', count: 1 }])[0].location, { x: 515, y: 500 },
        'the trained one walks ten units further for a patch it believes to be four rocks wide')

    // The optimisation is also worth more practice, because it is the harder act.
    const a = lonePawn('p1')
    a.increaseSkill('routePlanning', 3)
    const b = lonePawn('p2')
    b.increaseSkill('routePlanning', 6)
    seed(a)
    seed(b)
    const req = [{ type: 'rock', count: 1 }, { type: 'rock', count: 1 }]
    const paidA = a.getSkill('routePlanning')
    const paidB = b.getSkill('routePlanning')
    a.planGatheringRoute(req)
    b.planGatheringRoute(req)
    assert.ok((b.getSkill('routePlanning') - paidB) > (a.getSkill('routePlanning') - paidA),
        'optimising a route is better practice than listing one')
})

test('recall hands out a reading of the memory, not the memory itself', () => {
    const pawn = lonePawn('rox')
    rememberAt(pawn, 'rock', 100, 100)
    rememberAt(pawn, 'rock', 200, 100)
    const recalled = pawn.recallResourcesByType('rock')
    assert.equal(recalled.length, 2)
    recalled.length = 0
    recalled.push({ type: 'rock', x: 999, y: 999 })
    assert.equal(pawn.resourceMemory.length, 2, 'dropping a plan does not drop the memory')
    assert.ok(!pawn.resourceMemory.some(m => m.x === 999), 'and inventing a stop does not invent a memory')
})

test('belief saturates at certainty; a patch never runs to positive confidence on hope alone', () => {
    const pawn = lonePawn('pat')
    const memory = rememberAt(pawn, 'rock', 300, 300)
    for (let i = 0; i < 20; i++) pawn.updateResourceMemoryConfidence({ type: 'rock', x: 300, y: 300 }, true)
    assert.equal(memory.confidence, 1, 'a patch never seen empty is finally certain')
    pawn.updateResourceMemoryConfidence({ type: 'rock', x: 300, y: 300 }, true)
    assert.equal(memory.confidence, 1, 'and certainty is a ceiling, not a number that keeps climbing')
})

test('an outcome a pawn hears about is booked against the memory of that place', () => {
    // #105's evidence path, which is separate from the pawn's own gathering
    // result: reports are matched to a memory by position, weighted by who said
    // it, and can create a memory when the pawn had none.
    const pawn = lonePawn('ob')
    const near = rememberAt(pawn, 'rock', 300, 300, { confidence: 0.5 })
    const far = rememberAt(pawn, 'rock', 900, 300, { confidence: 0.5 })

    pawn.observeGatheringOutcome({ type: 'rock', x: 305, y: 300, success: true }, 2)
    assert.equal(near.confidence, 0.5 + 0.05 * 1.5, 'a shouty report counts, but only up to 1.5x')
    assert.equal(near.observedSuccessCount, 1, 'and it is booked as something somebody saw')
    assert.equal(far.confidence, 0.5, 'the patch on the far side of the map is not the place they visited')

    pawn.observeGatheringOutcome({ type: 'rock', x: 300, y: 300, success: false }, 0)
    assert.equal(near.confidence, 0.575 - 0.04 * 0.5, 'a mumbled report still counts for half')

    pawn.observeGatheringOutcome({ type: 'rock', x: 895, y: 300, success: false })
    assert.equal(far.confidence, 0.46)
    assert.equal(far.observedFailCount, 1)

    // Nothing was remembered here, so a rumour of flint becomes one.
    pawn.observeGatheringOutcome({ type: 'flint', x: 60, y: 60, success: true })
    const learnt = pawn.resourceMemory.find(m => m.type === 'flint')
    assert.ok(learnt, 'a second-hand sighting is still worth a place in the head')
    assert.equal(learnt.confidence, 0.4, 'but it starts as a rumour, not a certainty')
})

// --- belief, gossip, and forgetting ----------------------------------------

test('a gather that goes wrong is believed, and going wrong twice is nearly not believed at all', () => {
    const pawn = lonePawn('may')
    const memory = rememberAt(pawn, 'rock', 200, 200)
    assert.equal(memory.confidence, 0.7)

    pawn.updateResourceMemoryConfidence({ type: 'rock', x: 200, y: 200 }, false)
    const once = pawn.resourceMemory[0].confidence
    pawn.updateResourceMemoryConfidence({ type: 'rock', x: 200, y: 200 }, false)
    const twice = pawn.resourceMemory[0].confidence

    assert.ok(once < 0.7 && twice < once, `failures should bite harder each time, got ${once} then ${twice}`)
    assert.equal(pawn.resourceMemory[0].failCount, 2)
    assert.equal(pawn.resourceMemory[0].revisitFailStreak, 2, 'the streak is what makes the penalty grow')
    assert.equal(pawn.resourceMemory[0].lastVisited, pawn.world.clock.currentTick)
    assert.ok(twice > 0.2, 'but two failures still leave the memory standing')

    // Success is not merely the absence of failure: it repays part of what the
    // failures took, in proportion to how many there were.
    Object.assign(pawn.resourceMemory[0], { confidence: 0.5, failCount: 3, revisitFailStreak: 2 })
    pawn.updateResourceMemoryConfidence({ type: 'rock', x: 200, y: 200 }, true)
    const healed = pawn.resourceMemory[0]
    assert.equal(healed.successCount, 1)
    assert.equal(healed.revisitFailStreak, 0, 'a win wipes the streak')
    assert.ok(healed.confidence > 0.6, `a win should recover more than its base share, got ${healed.confidence}`)
})

test('a location that keeps failing is forgotten outright', () => {
    // The mock never did this, so the whole cost of a bad memory was invisible
    // to it: in the sim a thrice-failed patch leaves the pawn's head entirely.
    const pawn = lonePawn('ned')
    rememberAt(pawn, 'rock', 200, 200)
    for (let attempt = 0; attempt < 3; attempt++) {
        pawn.updateResourceMemoryConfidence({ type: 'rock', x: 200, y: 200 }, false)
    }
    assert.deepEqual(pawn.resourceMemory, [], 'three failures and the pawn stops believing the place had rock')
})

test('pawns learn from watching each other, but only from what they were close enough to see', () => {
    const gatherer = new Pawn('gath', 'Gath', 300, 300)
    const near = new Pawn('near', 'Near', 330, 300)
    const far = new Pawn('far', 'Far', 700, 700)
    worldWith(gatherer, near, far)

    const nearMemory = rememberAt(near, 'stick', 260, 260, { confidence: 0.4 })
    const farMemory = rememberAt(far, 'stick', 260, 260, { confidence: 0.4 })
    assert.ok(nearMemory && farMemory)

    gatherer.updateResourceMemoryConfidence({ type: 'stick', x: 265, y: 260 }, true)

    assert.equal(near.resourceMemory[0].observedSuccessCount, 1, 'the witness files what it saw')
    assert.ok(near.resourceMemory[0].confidence > 0.4, 'and believes the patch a little more')
    assert.equal(near.resourceMemory[0].lastObservedAt, near.world.clock.currentTick)
    assert.ok(near.getSkill('routePlanning') > 0, 'watching someone else gather is practice')

    assert.equal(far.resourceMemory[0].observedSuccessCount ?? 0, 0, 'fifty units past the earshot and nothing lands')
    assert.equal(far.resourceMemory[0].confidence, 0.4)

    // A witness with no memory of its own learns the spot from the success.
    const apprentice = new Pawn('app', 'App', 310, 310)
    worldWith(gatherer, near, far, apprentice)
    gatherer.updateResourceMemoryConfidence({ type: 'flint', x: 320, y: 320 }, true)
    assert.equal(apprentice.resourceMemory.length, 1, 'seeing someone succeed is itself a location')
    const learned = apprentice.resourceMemory[0]
    assert.equal(learned.type, 'flint')
    assert.equal(learned.source, 'shared')
    assert.equal(learned.sharedBy, 'gath', 'and it knows whose success it was')
    assert.ok(learned.confidence > 0 && learned.confidence < 0.4, 'hearsay is worth less than eyes-on: 0.4 scaled by proximity')
})

test('a cartographer teaches what it is sure of, and keeps the rest', () => {
    const teacher = new Pawn('tch', 'Teacher', 100, 100)
    const learner = new Pawn('lrn', 'Learner', 200, 200)
    worldWith(teacher, learner)
    train(teacher, { cartography: 25, storytelling: 8 })

    rememberAt(teacher, 'rock', 300, 300, { confidence: 0.4, clusterCount: 1 })
    rememberAt(teacher, 'rock', 340, 300, { confidence: 0.8, clusterCount: 2 })
    rememberAt(teacher, 'rock', 380, 300, { confidence: 0.9, clusterCount: 3 })

    assert.equal(teacher.shareResourceMemory(teacher), 0, 'one does not brief oneself')
    assert.equal(teacher.shareResourceMemory(null), 0)

    const shared = teacher.shareResourceMemory(learner, { maxShare: 2, minConfidence: 0.6 })
    assert.equal(shared, 2, 'two of the three were worth saying')
    assert.equal(learner.resourceMemory.length, 2)
    assert.deepEqual(learner.resourceMemory.map(m => m.confidence).sort((a, b) => b - a), [0.9 * 0.85, 0.8 * 0.85], 'hearsay arrives discounted')
    for (const memory of learner.resourceMemory) {
        assert.equal(memory.source, 'shared')
        assert.equal(memory.sharedBy, 'tch')
        assert.ok(memory.clusterCount >= 2, 'the size of the patch travels with the news')
    }
    assert.ok(!learner.resourceMemory.some(m => m.x === 300), 'the doubtful memory stayed home')
    assert.ok(teacher.getSkill('storytelling') > 8, 'telling is practice at telling (#108)')
    assert.ok(teacher.getSkill('routePlanning') > 0, 'and at saying where things are')
    assert.ok(learner.getSkill('memoryClustering') > 0, 'being told is practice at filing')
    assert.equal(learner.skillLastUsed.memoryClustering, learner.world.clock.currentTick)

    // Two pawns told about the same patch converge on it rather than doubling up.
    const again = new Pawn('lrn2', 'Learner2', 210, 210)
    worldWith(teacher, learner, again)
    again.learnResourceLocation({ type: 'rock', x: 375, y: 302, confidence: 0.5, clusterCount: 4, sourcePawnId: 'tch' })
    const before = again.resourceMemory.length
    teacher.shareResourceMemory(again, { maxShare: 1, minConfidence: 0.6 })
    assert.equal(again.resourceMemory.length, before, 'a patch the pawn has already heard of is not a new place')
    const merged = again.resourceMemory.find(m => m.x === 375)
    assert.ok(merged.confidence > 0.5, 'the second source raises confidence instead')
    assert.equal(merged.clusterCount, 4, 'and the bolder claim about how big the patch is survives the merge')
    assert.equal(merged.source, 'shared')
})

test('a pupil only holds so much of what it is told', () => {
    const teacher = new Pawn('tch2', 'Teacher', 100, 100)
    const pupil = new Pawn('ptl', 'Pupil', 100, 120)
    worldWith(teacher, pupil)
    train(pupil, { cartography: 25 })
    assert.equal(pupil.maxResourceMemory, 60)

    // Fill the pupil to its cap with weak but survivable memories, then teach it
    // something strong: the weakest memory goes rather than the cap breaking.
    for (let i = 0; i < pupil.maxResourceMemory; i++) {
        pupil.rememberResource({ type: 'rock', x: 40 + i * 30, y: 100 })
    }
    assert.equal(pupil.resourceMemory.length, 60)
    for (const [i, memory] of pupil.resourceMemory.entries()) memory.confidence = 0.3 + i * 0.001

    const accepted = pupil.learnResourceLocation({ type: 'flint', x: 1200, y: 1200, confidence: 0.95, sourcePawnId: 'tch2' })
    assert.equal(accepted, true)
    assert.equal(pupil.resourceMemory.length, 60, 'the cap is a cap even for news')
    assert.ok(pupil.resourceMemory.some(m => m.type === 'flint'), 'the strong memory was admitted')
    assert.ok(!pupil.resourceMemory.some(m => m.confidence <= 0.3001), 'the weakest one was what went')
})

// --- what a pawn is good at -------------------------------------------------

test('a farmer values the ground and the seed it knows', () => {
    const pawn = lonePawn('grub')
    pawn.world.clock.currentTick = 77

    pawn.trackMaterialEncounter({ type: 'wheat_seed', soilType: 'loam', seedType: 'wheat' })
    pawn.trackMaterialEncounter({ type: 'barley_grain', soilType: 'silt' })
    assert.ok(pawn.knownMaterials.has('wheat_seed'), 'encounters are recorded, not merely scored')
    assert.ok(pawn.getSkill('agronomy') > 0, 'husbandry is practice, paid through the verb (#108)')
    assert.equal(pawn.skillLastUsed.agronomy, 77)
    assert.ok(pawn.getSkill('materialAppraisal') > 0)

    const base = pawn.getResourceValue('corn_seed')
    const onKnownSoil = pawn.getResourceValue('corn_seed', { soilType: 'loam' })
    const withKnownSeed = pawn.getResourceValue('corn_seed', { soilType: 'loam', seedType: 'wheat' })
    assert.ok(base > 0.5, 'working the agriculture domain lifts its value at all')
    assert.ok(onKnownSoil > base, 'knowing the soil is worth something')
    assert.ok(withKnownSeed > onKnownSoil, 'knowing the seed is worth something on top of that')
    assert.equal(pawn.getResourceValue('corn_seed', { soilType: 'peat' }), base, 'a soil it has never turned is not a known soil')
    assert.ok(pawn.resourceSpecialization.knownSoilTypes.has('silt'))
})

test('a carpenter values wood by what it is for', () => {
    const pawn = lonePawn('wright')
    pawn.trackMaterialEncounter({ type: 'log' })
    pawn.trackMaterialEncounter({ type: 'branch' })
    pawn.trackMaterialEncounter({ type: 'stick' })

    const profile = pawn.resourceSpecialization.woodUse
    assert.ok(profile.construction > profile.tool, 'a log, a branch and a stick read as building timber with a bit of tool shaft')
    assert.ok(profile.weapon > profile.tool, 'and a branch reads as a spear shaft before it reads as a handle')

    for (const intent of ['construction', 'tool', 'weapon', 'general']) {
        assert.ok(pawn.getResourceValue('stick', { intent }) > 0.5, `${intent} intent should value wood above neutral`)
    }
    const building = pawn.getResourceValue('stick', { intent: 'construction' })
    const carving = pawn.getResourceValue('stick', { intent: 'tool' })
    assert.ok(building > carving, 'the pawn wants the stick for the wall it has built with sticks before')
    assert.equal(pawn.getResourceValue('stick'), building, 'no stated intent means "whatever I am best at", not "nothing"')

    // A preference set by the player still frames the number.
    pawn.setResourceValuePreferences({ fiber: 0.9, rock: 0.5 })
    assert.equal(pawn.getResourceValue('fiber'), 0.9, 'a favoured material starts from its preference')
    assert.ok(pawn.getResourceValue('rock') <= 0.5)
    assert.ok(pawn.getResourceValue('nothing_invented'), 'unknown material still gets a sane value')
})
