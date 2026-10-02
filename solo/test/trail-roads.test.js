import test from 'node:test'
import assert from 'node:assert/strict'

// #95: roads. The rule the whole ticket turns on is that a road is formalised
// where traffic already goes, and that the only thing which makes a road real
// is wear - because wear is what steering (`followBias`) and planning
// (`pathCost`) both read. A route table entry would be obeyed by nobody. So
// these tests check three things: that a corridor can be measured, that
// promotion refuses virgin ground, and that what promotion writes is actually
// walked and actually cheaper.

import TrailField, {
    TRAIL_CELL_SIZE,
    TRAIL_FOLLOW_THRESHOLD,
    TRAIL_ROAD_WEAR,
    TRAIL_ROAD_MIN_COVERAGE,
    TRAIL_ROAD_REACH_CELLS,
    TRAIL_MAX_INTENSITY,
    TRAIL_EPSILON
} from '../js/core/TrailField.js'

/**
 * A footpath: wear dropped every `every` units along y = `y` from x0 to x1.
 * Sub-threshold amounts are used nowhere; these are all real trodden ground.
 */
function footpath(x0, x1, { y = 0, every = TRAIL_CELL_SIZE, amount = 6, tick = 0 } = {}) {
    const field = new TrailField({ tick })
    for (let x = x0; x <= x1; x += every) field.deposit(x, y, amount, tick, 'pawn')
    return field
}

function wornSpan(field, y = 0, x0 = 0, x1 = 200) {
    let cells = 0
    for (let x = x0; x <= x1; x += TRAIL_CELL_SIZE) {
        if (field.intensityAt(x, y) > TRAIL_FOLLOW_THRESHOLD) cells++
    }
    return cells
}

// --- measuring a corridor --------------------------------------------------

test('corridorBetween: a trodden line reads as fully covered', () => {
    const field = footpath(0, 200)
    const corridor = field.corridorBetween(4, 0, 196, 0)

    assert.equal(corridor.length, 192)
    assert.ok(corridor.coverage > 0.95, `coverage was ${corridor.coverage}`)
    assert.equal(corridor.gaps, 0)
    assert.ok(corridor.points.length > 10)
})

test('corridorBetween: virgin ground has no corridor to formalise', () => {
    const field = new TrailField()
    const corridor = field.corridorBetween(0, 0, 200, 0)

    assert.equal(corridor.coverage, 0)
    assert.deepEqual(corridor.points, [])
    assert.equal(corridor.length, 200)
})

test('corridorBetween: points are cell centres, not coordinates between cells', () => {
    // Deposits at y = 3 fall in the same cell row as y = 0 (cells are 8 wide),
    // so the corridor is real but the straight line is not on any grid.
    const field = footpath(0, 200, { y: 3 })
    const { points, coverage } = field.corridorBetween(2, 3, 198, 3)

    assert.ok(points.length > 10, 'expected a corridor to inspect')
    assert.ok(coverage > 0.9)
    for (const p of points) {
        // A cell centre sits half a cell off the grid in both axes.
        assert.ok(Math.abs(((p.x / TRAIL_CELL_SIZE) % 1) - 0.5) < 1e-9, `x=${p.x} is not a centre`)
        assert.ok(Math.abs(((p.y / TRAIL_CELL_SIZE) % 1) - 0.5) < 1e-9, `y=${p.y} is not a centre`)
    }
})

test('corridorBetween: coverage is the share trodden, not all or nothing', () => {
    // Worn for the first 100 units only, so half of a 200 unit line.
    const field = footpath(0, 100)
    const corridor = field.corridorBetween(0, 0, 200, 0)

    assert.ok(corridor.coverage > 0.4 && corridor.coverage < 0.65,
        `half-worn corridor should read near 0.5, got ${corridor.coverage}`)
})

test('corridorBetween: it bends onto a footpath that drifts a little', () => {
    // The trodden ground is 10 units off the straight line - inside the reach
    // of 2 cells (16 units) - so the corridor should find it.
    const field = footpath(0, 200, { y: 10 })
    const corridor = field.corridorBetween(0, 0, 200, 0)

    assert.ok(corridor.coverage > 0.9, `drifting path should still be a road, got ${corridor.coverage}`)
    assert.ok(corridor.points.some(p => Math.abs(p.y - 10) < TRAIL_CELL_SIZE),
        'corridor should be pinned to the worn cells, not the straight line')
})

test('corridorBetween: a path far off to one side is not this road', () => {
    // 60 units of lateral offset is way beyond TRAIL_ROAD_REACH_CELLS cells.
    const field = footpath(0, 200, { y: 60 })
    const corridor = field.corridorBetween(0, 0, 200, 0)

    assert.equal(field.cellSize * TRAIL_ROAD_REACH_CELLS, 16)
    assert.equal(corridor.coverage, 0)
})

// --- formalising a road ----------------------------------------------------

test('promoteCorridor: it will not pave ground nobody walks', () => {
    const field = new TrailField()
    const before = field.cells.size

    const result = field.promoteCorridor(0, 0, 200, 0)

    assert.equal(result.ok, false)
    assert.equal(result.reason, 'unworn')
    assert.equal(field.cells.size, before, 'a refused promotion must write nothing')
    assert.equal(field.intensityAt(100, 0), 0)
})

test('promoteCorridor: a partially trodden line below the bar stays unbuilt', () => {
    // Worn for the first 40 of 200 units: coverage ~0.2, under TRAIL_ROAD_MIN_COVERAGE.
    const field = footpath(0, 40)
    assert.ok(TRAIL_ROAD_MIN_COVERAGE >= 0.5)

    const result = field.promoteCorridor(0, 0, 200, 0)

    assert.equal(result.ok, false)
    assert.ok(result.coverage < TRAIL_ROAD_MIN_COVERAGE)
})

test('promoteCorridor: the threshold is honest - clearing it is enough to build', () => {
    // Worn for just over half the line, then the promotion is allowed through
    // by lowering the bar, and the very same field refuses it raised.
    const field = footpath(0, 120)

    assert.equal(field.promoteCorridor(0, 0, 200, 0, { minCoverage: 0.95 }).ok, false)

    const built = field.promoteCorridor(0, 0, 200, 0, { minCoverage: 0.5 })
    assert.equal(built.ok, true)
    assert.equal(built.reason, 'worn')
})

test('promoteCorridor: it writes road wear all the way along the corridor', () => {
    const field = footpath(0, 200, { amount: 6 })
    const before = wornSpan(field, 0)

    const built = field.promoteCorridor(0, 0, 200, 0)

    assert.equal(built.ok, true)
    assert.ok(built.points.length > 10)
    // Every cell on the line is now at least road-strength, which is more than
    // the scattered footfall that was there.
    assert.ok(field.intensityAt(100, 0) >= TRAIL_ROAD_WEAR)
    assert.ok(field.intensityAt(60, 0) >= TRAIL_ROAD_WEAR)
    assert.ok(wornSpan(field, 0) >= before)
})

test('promoteCorridor: the wear it writes is attributed to the road', () => {
    const field = footpath(0, 200, { amount: 6 })
    field.promoteCorridor(0, 0, 200, 0)

    const kinds = field.kindsInUse()
    const road = kinds.find(k => k.kind === 'road')
    const pawn = kinds.find(k => k.kind === 'pawn')

    assert.ok(road, `expected a 'road' attribution in ${kinds.map(k => k.kind)}`)
    assert.ok(pawn, 'the footfall that earned the road should still be readable')
    assert.ok(road.intensity > pawn.intensity, 'a built road should out-weigh its own traffic')
})

// --- the payoff: a road is walked, and a road is cheaper -------------------

test('a promoted road is cheaper to plan across than the scrub beside it', () => {
    const field = footpath(0, 200, { amount: 6 })
    const scrub = field.pathCost(0, 60, 200, 60)
    const before = field.pathCost(0, 0, 200, 0)

    field.promoteCorridor(0, 0, 200, 0)
    const after = field.pathCost(0, 0, 200, 0)

    assert.ok(after < before, `road ${after} should beat the same line before building ${before}`)
    assert.ok(after < scrub, `road ${after} should beat ${scrub} units of bush`)
    // And it is still not free: the discount is capped, so distance matters.
    assert.ok(after > scrub * (1 - 0.9), 'a road must not erase distance')
})

test('a promoted road is obeyed by steering', () => {
    // A deer that only hopped: wear on every eighth cell, so most of the line
    // is still bush. A walker between the hops cannot see a path at all.
    const field = footpath(0, 200, { every: 64, amount: 2 })
    const stray = { x: 100, y: 20 }

    const before = field.followBias(stray.x, stray.y, 1, 0, { affinity: 1 })
    assert.equal(before.intensity, 0, 'nothing within looking distance is trodden yet')
    assert.equal(before.turn, 0)

    const built = field.promoteCorridor(0, 4, 200, 4)
    assert.equal(built.ok, true, 'the hops are close enough to read as one corridor')

    const after = field.followBias(stray.x, stray.y, 1, 0, { affinity: 1 })
    assert.ok(after.intensity > before.intensity, 'the road is now the strongest ground in view')
    assert.notEqual(after.turn, 0, 'and the walker turns for it')
    assert.ok(after.dirY < 0, 'turning for the road means leaving the bush')
})

test('an unmaintained road fades, so roads need traffic', () => {
    const field = footpath(0, 200, { amount: 6, tick: 0 })
    field.promoteCorridor(0, 0, 200, 0, { tick: 0 })

    const fresh = field.intensityAt(100, 0)
    // Two half-lives of decay without a walker on it: a quarter of the wear left.
    const aged = field.intensityAt(100, 0, 480 * 2)

    assert.ok(fresh > TRAIL_ROAD_WEAR, `the road should have been built, got ${fresh}`)
    assert.ok(Math.abs(aged * 4 - fresh) < 0.5, `two half-lives should leave a quarter (${fresh} -> ${aged})`)
    assert.ok(field.intensityAt(100, 0, 480 * 20) < 1 / 1024,
        'an abandoned road is unreadable, not merely dim')
})

// --- the cartography bypass ------------------------------------------------

test('a surveyed road goes where it was told, not where pawns wandered', () => {
    const field = new TrailField()
    const result = field.promoteCorridor(0, 0, 200, 0, { surveyed: true })

    assert.equal(result.ok, true)
    assert.equal(result.reason, 'surveyed')
    assert.equal(result.coverage, 0, 'the report should still say the ground was virgin')
    assert.ok(field.intensityAt(100, 0) >= TRAIL_ROAD_WEAR)
    // Straight, so the sample points land on the line itself.
    assert.ok(result.points.every(p => p.y === 0))
})

test('surveying is an override, not a default', () => {
    const field = new TrailField()

    assert.equal(field.promoteCorridor(0, 0, 200, 0).ok, false)
    assert.equal(field.promoteCorridor(0, 0, 200, 0, { surveyed: 1 }).ok, false,
        'surveyed must be the exact flag, not any truthy option')
})

test('a surveyed road over worn ground is still straight', () => {
    // The deer run is 40 units to one side - far outside the reach of a road -
    // so following the wear is not an option here at all.
    const field = footpath(0, 200, { y: 40 })
    assert.equal(field.promoteCorridor(0, 0, 200, 0).ok, false,
        'wear alone cannot build a road across virgin ground')

    const straight = field.promoteCorridor(0, 0, 200, 0, { surveyed: true })
    assert.equal(straight.ok, true)
    assert.ok(straight.points.every(p => Math.abs(p.y) < 1e-9), 'a surveyor lays a straight line')
    assert.ok(field.intensityAt(100, 0) >= TRAIL_ROAD_WEAR)
    assert.equal(field.intensityAt(100, 40), 6, 'the deer run beside it is untouched by the new road')
    assert.ok(field.intensityAt(100, 20) < TRAIL_EPSILON, 'and the ground between them stays bush')
})

test('promoteCorridor: nowhere to build is refused, not a zero-length road', () => {
    const field = footpath(0, 200)
    const result = field.promoteCorridor(100, 0, 100, 0)

    assert.equal(result.ok, false)
    assert.equal(result.length, 0)
})

test('promoteCorridor: junk coordinates do not build a road at the origin', () => {
    const field = footpath(0, 200)
    const before = field.cells.size

    const result = field.promoteCorridor(NaN, 0, undefined, 0)

    assert.equal(result.ok, false)
    assert.equal(field.cells.size, before)
})

test('promotion reuses the cost cap, so a very long road stays bounded', () => {
    const field = footpath(0, 4000, { every: 20 })
    const built = field.promoteCorridor(0, 0, 4000, 0)

    assert.equal(built.ok, true)
    assert.ok(built.points.length <= 65, `expected a bounded sample count, got ${built.points.length}`)
    assert.ok(field.intensityAt(2000, 0) >= TRAIL_FOLLOW_THRESHOLD,
        'a saturated road still has to be worn at its far end to be a road')
})

test('a saturated footpath promotes without changing the field much', () => {
    const field = footpath(0, 200, { amount: TRAIL_MAX_INTENSITY })
    const before = field.intensityAt(100, 0)

    const built = field.promoteCorridor(0, 0, 200, 0)

    assert.equal(built.ok, true)
    assert.ok(field.intensityAt(100, 0) <= TRAIL_MAX_INTENSITY + 1e-9, 'wear stays capped')
    assert.ok(field.intensityAt(100, 0) >= before)
})
