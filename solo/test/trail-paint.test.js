/**
 * Tests for #93 - drawing the footpaths and animal trails the sim already wears
 * into TrailField. The field itself is covered by trail-field.test.js; what is
 * under test here is the translation from "worn cells" to "something a renderer
 * can draw": the region query, the paint feed, and the two render hooks.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import TrailField, {
    trailFieldFor,
    resetTrailField,
    TRAIL_CELL_SIZE,
    TRAIL_MAX_INTENSITY,
    TRAIL_DECAY_HALF_LIFE,
    TRAIL_FOLLOW_THRESHOLD,
    TRAIL_EPSILON
} from '../js/core/TrailField.js'
import {
    TRAIL_PAINT_THRESHOLD,
    TRAIL_PAINT_MIN_ALPHA,
    TRAIL_PAINT_MAX_ALPHA,
    TRAIL_PAINT_MAX_CELLS,
    TRAIL_PAINT_REFRESH_TICKS,
    TRAIL_PAINT_JITTER,
    TRAIL_DIRT_COLOR,
    TRAIL_KIND_COLORS,
    hash2,
    trailColorFor,
    hexRgb,
    writeTrailQuads,
    trailNorm,
    trailAlpha,
    paintSignature,
    trailPaintFor,
    trailReadout,
    trailDebugFromParams
} from '../js/core/TrailPaint.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import CanvasRenderer from '../js/rendering/CanvasRenderer.js'

const RECT = { x0: -1000, y0: -1000, x1: 1000, y1: 1000 }

function field(options = {}) {
    return new TrailField(options)
}

// ------------------------------------------------------------- region queries

test('cellsInRect: only cells whose centre is inside the rect come back', () => {
    const f = field()
    // cell (0,0) spans 0..8 and centres at 4; cell (1,1) centres at 12
    f.deposit(4, 4, 10, 0, 'pawn')
    f.deposit(12, 12, 10, 0, 'pawn')

    const inside = f.cellsInRect(0, 0, 8, 8, { tick: 0 })
    assert.equal(inside.length, 1)
    assert.deepEqual({ cx: inside[0].cx, cy: inside[0].cy }, { cx: 0, cy: 0 })
    assert.equal(inside[0].x, 4)
    assert.equal(inside[0].y, 4)
})

test('cellsInRect: negative coordinates work, because the sim walks everywhere', () => {
    const f = field()
    f.deposit(-20, -20, 6, 0, 'forager')
    const found = f.cellsInRect(-64, -64, -8, -8, { tick: 0 })
    assert.equal(found.length, 1)
    assert.equal(found[0].cx, Math.floor(-20 / TRAIL_CELL_SIZE))
    assert.equal(found[0].kind, 'forager')
})

test('cellsInRect: corners may be supplied in either order', () => {
    const f = field()
    f.deposit(20, 30, 5, 0)
    const forward = f.cellsInRect(16, 24, 32, 40, { tick: 0 })
    const swapped = f.cellsInRect(32, 40, 16, 24, { tick: 0 })
    assert.equal(forward.length, 1)
    assert.deepEqual(swapped, forward)
})

test('cellsInRect: wear is decayed at the requested tick, and faded ground drops out', () => {
    const f = field()
    f.deposit(4, 4, 4, 0, 'pawn')
    assert.equal(f.cellsInRect(-1, -1, 9, 9, { tick: 0 })[0].intensity, 4)

    // One half-life later the same cell reads half as worn but is still there.
    const aged = f.cellsInRect(-1, -1, 9, 9, { tick: TRAIL_DECAY_HALF_LIFE })
    assert.ok(Math.abs(aged[0].intensity - 2) < 1e-9)

    // Thirteen half-lives is dust: below the epsilon a renderer is given for free.
    assert.equal(f.cellsInRect(-1, -1, 9, 9, { tick: TRAIL_DECAY_HALF_LIFE * 13 }).length, 0)
})

test('cellsInRect: a threshold keeps the drawable set honest about wear', () => {
    const f = field()
    f.deposit(4, 4, 0.4, 0)
    f.deposit(12, 4, 20, 0)
    assert.equal(f.cellsInRect(-1, -1, 24, 9, { tick: 0 }).length, 2)
    const paintable = f.cellsInRect(-1, -1, 24, 9, { threshold: TRAIL_PAINT_THRESHOLD, tick: 0 })
    assert.equal(paintable.length, 1)
    assert.equal(paintable[0].intensity, 20)
})

test('cellsInRect: results are strongest first, so a cap spends itself on paths', () => {
    const f = field()
    f.deposit(4, 4, 3, 0)
    f.deposit(12, 4, 30, 0)
    f.deposit(20, 4, 12, 0)
    const found = f.cellsInRect(-1, -1, 40, 9, { tick: 0 })
    assert.deepEqual(found.map(c => c.intensity), [30, 12, 3])
})

test('cellsInRect: the dominant walker owns the cell, and it fades with the cell', () => {
    const f = field()
    f.deposit(4, 4, 4, 0, 'forager')
    f.deposit(4, 4, 9, 0, 'pawn')
    assert.equal(f.cellsInRect(-1, -1, 9, 9, { tick: 0 })[0].kind, 'pawn')

    // Unattributed ground has no kind rather than a made-up one.
    f.deposit(12, 4, 5, 0)
    const mixed = f.cellsInRect(-1, -1, 24, 9, { tick: 0 })
    assert.equal(mixed.find(c => c.cx === 1).kind, null)
})

test('cellsInRect: junk input reads the whole map instead of throwing', () => {
    const f = field()
    f.deposit(4, 4, 5, 0)
    assert.equal(f.cellsInRect(NaN, undefined, 1e9, 1e9, { tick: 0 }).length, 1)
})

test('kindsInUse: totals are per walker and decay with the ground', () => {
    const f = field()
    for (let i = 0; i < 5; i++) f.deposit(4 + i * TRAIL_CELL_SIZE, 4, 6, 0, 'forager')
    f.deposit(4, 12, 2, 0, 'predator')
    const now = f.kindsInUse(0)
    assert.deepEqual(now.map(e => e.kind), ['forager', 'predator'])
    assert.equal(now[0].intensity, 30)
    assert.equal(now[0].cells, 5)
    assert.equal(now[1].cells, 1)

    // Walkers vanish when their ground does.
    assert.deepEqual(f.kindsInUse(TRAIL_DECAY_HALF_LIFE * 20), [])
})

test('a bare field allocates nothing when queried', () => {
    const f = field()
    assert.deepEqual(f.cellsInRect(0, 0, 1000, 1000), [])
    assert.deepEqual(f.kindsInUse(0), [])
    assert.equal(f.cells.size, 0)
})

// ------------------------------------------------------------------ paint maths

test('trailNorm: wear is a fraction of saturation, clamped at both ends', () => {
    assert.equal(trailNorm(0, TRAIL_MAX_INTENSITY), 0)
    assert.equal(trailNorm(-3, TRAIL_MAX_INTENSITY), 0)
    assert.equal(trailNorm(TRAIL_MAX_INTENSITY / 2, TRAIL_MAX_INTENSITY), 0.5)
    assert.equal(trailNorm(TRAIL_MAX_INTENSITY, TRAIL_MAX_INTENSITY), 1)
    assert.equal(trailNorm(TRAIL_MAX_INTENSITY * 100, TRAIL_MAX_INTENSITY), 1)
    // A field with no cap cannot divide by zero; everything just reads saturated.
    assert.equal(trailNorm(10, 0), 1)
    assert.equal(trailNorm(1, NaN), 1)
})

test('trailAlpha: more wear is always more opaque, and never solid', () => {
    let previous = -1
    for (let i = 0; i <= 20; i++) {
        const alpha = trailAlpha(i / 20)
        assert.ok(alpha >= previous, `alpha must be monotonic at norm ${i / 20}`)
        assert.ok(alpha <= TRAIL_PAINT_MAX_ALPHA + 1e-12)
        previous = alpha
    }
    assert.equal(trailAlpha(0), 0)
    assert.ok(trailAlpha(1e-6) >= TRAIL_PAINT_MIN_ALPHA)
    assert.ok(Math.abs(trailAlpha(1) - TRAIL_PAINT_MAX_ALPHA) < 1e-12)
    assert.ok(TRAIL_PAINT_MAX_ALPHA < 1, 'worn dirt should never read as a painted stripe')
})

test('hash2: deterministic in both directions and inside 0..1', () => {
    assert.equal(hash2(3, -7), hash2(3, -7))
    assert.notEqual(hash2(3, -7), hash2(-7, 3))
    for (let i = -20; i < 20; i++) {
        const h = hash2(i, i * 3 + 1)
        assert.ok(h >= 0 && h < 1)
    }
})

test('trailColorFor: known walkers tint, unknown ones are plain dirt', () => {
    assert.equal(trailColorFor('pawn'), TRAIL_DIRT_COLOR)
    assert.equal(trailColorFor('forager'), TRAIL_KIND_COLORS.forager)
    assert.equal(trailColorFor('predator'), TRAIL_KIND_COLORS.predator)
    assert.equal(trailColorFor('wolf'), TRAIL_DIRT_COLOR, 'a new species must not invent a colour')
    assert.equal(trailColorFor(null), TRAIL_DIRT_COLOR)
    assert.equal(trailColorFor(''), TRAIL_DIRT_COLOR)
})

// -------------------------------------------------------------------- the feed

test('trailPaintFor: nothing worn, nothing to draw, nothing allocated', () => {
    const f = field()
    const paint = trailPaintFor({ field: f, rect: RECT, tick: 0 })
    assert.deepEqual(paint.cells, [])
    assert.equal(paint.worn, 0)
    assert.equal(paint.truncated, 0)
    assert.equal(paint.peak, 0)

    const missing = trailPaintFor({ field: null, rect: RECT })
    assert.deepEqual(missing.cells, [])
    assert.deepEqual(trailPaintFor({}).cells, [])

    // Sub-epsilon wear is what the field gives away for free; it never reaches the ground.
    const dusty = field()
    dusty.deposit(4, 4, TRAIL_EPSILON / 2, 0, 'pawn')
    assert.equal(trailPaintFor({ field: dusty, rect: RECT, tick: 0 }).worn, 0)
})

test('the paint threshold is the threshold at which a pawn commits to a trail', () => {
    // #77 and #93 read the same number, so "worth painting" and "worth following" agree.
    assert.equal(TRAIL_PAINT_THRESHOLD, TRAIL_FOLLOW_THRESHOLD)
})

test('trailPaintFor: only ground worth painting is offered, and it is quaded over its cell', () => {
    const f = field()
    f.deposit(4, 4, TRAIL_PAINT_THRESHOLD * 0.5, 0, 'pawn')
    f.deposit(12, 4, 20, 0, 'pawn')
    const paint = trailPaintFor({ field: f, rect: RECT, tick: 0 })
    assert.equal(paint.worn, 1)
    assert.equal(paint.peak, 20)
    const cell = paint.cells[0]
    assert.equal(cell.cx, 1)
    assert.equal(cell.key, '1:0')
    assert.equal(cell.kind, 'pawn')
    assert.equal(cell.color, TRAIL_DIRT_COLOR)
    assert.ok(cell.size > TRAIL_CELL_SIZE, 'cells overlap so a line of them reads as a path')
    assert.ok(cell.alpha > 0 && cell.alpha <= TRAIL_PAINT_MAX_ALPHA)
})

test('trailPaintFor: the wobble is per cell, so the ground cannot shimmer between frames', () => {
    const f = field()
    for (let i = 0; i < 6; i++) f.deposit(4 + i * TRAIL_CELL_SIZE, 4, 20, 0, 'pawn')
    const a = trailPaintFor({ field: f, rect: RECT, tick: 0 }).cells
    const b = trailPaintFor({ field: f, rect: RECT, tick: TRAIL_PAINT_REFRESH_TICKS }).cells
    assert.deepEqual(a.map(c => [c.x, c.y, c.size]), b.map(c => [c.x, c.y, c.size]))

    // Not one shared offset: cells must not line up into a visible grid.
    const offsets = new Set(a.map(c => `${(c.x - c.cx * TRAIL_CELL_SIZE).toFixed(3)}`))
    assert.ok(offsets.size > 1)
    for (const cell of a) {
        const drift = Math.abs(cell.x - (cell.cx + 0.5) * TRAIL_CELL_SIZE)
        assert.ok(drift <= TRAIL_PAINT_JITTER * TRAIL_CELL_SIZE + 1e-9)
    }
})

test('trailPaintFor: the cap keeps a zoomed-out view bounded and says what it dropped', () => {
    const f = field()
    // Half a unit apart in wear so nothing saturates and the ranking is exact.
    for (let i = 0; i < 50; i++) f.deposit(4 + i * TRAIL_CELL_SIZE, 4, 1 + i * 0.5, 0, 'pawn')
    const paint = trailPaintFor({ field: f, rect: RECT, tick: 0, maxCells: 10 })
    assert.equal(paint.cells.length, 10)
    assert.equal(paint.worn, 50)
    assert.equal(paint.truncated, 40)
    // The strongest ground survives truncation, which is what a reader looks for.
    assert.deepEqual(paint.cells.map(c => c.intensity), [25.5, 25, 24.5, 24, 23.5, 23, 22.5, 22, 21.5, 21])
    assert.ok(TRAIL_PAINT_MAX_CELLS >= 256, 'the default cap must be generous enough to look like paths')
})

test('trailPaintFor: debug mode draws the real cell, unjittered, tinted by walker', () => {
    const f = field()
    f.deposit(20, 20, 30, 0, 'forager')
    const paint = trailPaintFor({ field: f, rect: RECT, tick: 0, debug: true })
    const cell = paint.cells[0]
    assert.equal(paint.debug, true)
    assert.equal(cell.size, TRAIL_CELL_SIZE)
    assert.equal(cell.x, (cell.cx + 0.5) * TRAIL_CELL_SIZE)
    assert.equal(cell.y, (cell.cy + 0.5) * TRAIL_CELL_SIZE)
    assert.equal(cell.color, TRAIL_KIND_COLORS.forager)
})

test('paintSignature: idle ground and a still camera mean no rebuild at all', () => {
    const f = field()
    f.deposit(4, 4, 10, 0, 'pawn')
    const first = paintSignature({ field: f, rect: RECT, tick: 0 })
    assert.equal(paintSignature({ field: f, rect: RECT, tick: 3 }), first)

    f.deposit(12, 4, 10, 4, 'pawn')
    assert.notEqual(paintSignature({ field: f, rect: RECT, tick: 0 }), first, 'a footfall must repaint')

    const noFootfall = paintSignature({ field: f, rect: RECT, tick: 0 })
    assert.notEqual(paintSignature({ field: f, rect: RECT, tick: TRAIL_PAINT_REFRESH_TICKS }), noFootfall, 'decay is a change')
    assert.notEqual(paintSignature({ field: f, rect: { ...RECT, x0: 400 }, tick: 0 }), noFootfall, 'panning is a change')
    assert.notEqual(paintSignature({ field: f, rect: RECT, tick: 0, debug: true }), noFootfall, 'so is the debug view')
    assert.equal(paintSignature({ field: f, rect: { ...RECT, x0: RECT.x0 + 1 }, tick: 0 }), noFootfall, 'sub-quantum drift is not')
    assert.equal(paintSignature({ field: null, rect: RECT }), '')
})

test('trailReadout: a sentence about the ground, or an honest none', () => {
    const f = field()
    assert.equal(trailReadout(f, 0), 'no ground worn yet')
    assert.equal(trailReadout(null, 0), 'no ground worn yet')
    f.deposit(4, 4, 12, 0, 'pawn')
    f.deposit(12, 4, 5, 0, 'forager')
    const text = trailReadout(f, 0)
    assert.match(text, /paths \d+ cells/)
    assert.match(text, /peak \d+/)
    assert.match(text, /pawn \d+.*forager \d+/)
})

test('trailDebugFromParams: ?trails=1 on, ?trails=0 off, absent off', () => {
    assert.equal(trailDebugFromParams(new URLSearchParams('trails=1')), true)
    assert.equal(trailDebugFromParams(new URLSearchParams('trails=on')), true)
    assert.equal(trailDebugFromParams(new URLSearchParams('trails=0')), false)
    assert.equal(trailDebugFromParams(new URLSearchParams('trails=off')), false)
    assert.equal(trailDebugFromParams(new URLSearchParams('trails=false')), false)
    assert.equal(trailDebugFromParams(new URLSearchParams('')), false)
    assert.equal(trailDebugFromParams(undefined), false)
})

// ------------------------------------------------------------------ end to end

test('a walked corridor comes out of the ground as a band of pawn-tinted cells', () => {
    const world = { width: 1000, height: 1000, tick: 0, chunkManager: null }
    const f = resetTrailField(world)
    const pawn = new Pawn('p1', 'Scout', 60, 60)
    pawn.world = world

    const ticks = (() => {
        let n = 0
        while (n < 4000 && Math.hypot(340 - pawn.x, 90 - pawn.y) > pawn.distanceThreshold) {
            pawn.setValidatedTarget(340, 90)
            pawn.move()
            world.tick++
            n++
        }
        return n
    })()
    assert.ok(ticks > 10, 'the walk should have taken a while')
    assert.ok(f.deposits > 10, 'walking should have worn the ground')

    const rect = { x0: 0, y0: 0, x1: 400, y1: 200 }
    const paint = trailPaintFor({ field: f, rect, tick: world.tick })
    assert.ok(paint.worn >= 10, `expected a trail, got ${paint.worn} cells`)
    // The band is contiguous in x, roughly on the line walked, and attributed.
    const xs = paint.cells.map(c => c.x).sort((a, b) => a - b)
    assert.ok(xs[xs.length - 1] - xs[0] > 100, 'the path should span the corridor')
    for (const cell of paint.cells) {
        assert.ok(cell.y > 40 && cell.y < 140, `cell at ${cell.y} is nowhere near the walked line`)
        assert.equal(cell.kind, 'pawn')
        assert.equal(cell.color, TRAIL_DIRT_COLOR)
    }

    // Leave it alone for a fortnight of game time and the path is gone.
    const gone = trailPaintFor({ field: f, rect, tick: world.tick + TRAIL_DECAY_HALF_LIFE * 12 })
    assert.deepEqual(gone.cells, [])
})

test('trailFieldFor with create:false lets a renderer read without building a world', () => {
    const world = { width: 100, height: 100, tick: 5 }
    assert.equal(trailFieldFor(world, { create: false }), null)
    assert.equal(world.trailField, undefined)
    assert.ok(trailFieldFor(world) instanceof TrailField)
})

// ------------------------------------------------------------- renderer hooks

function stubContext() {
    const calls = []
    return {
        calls,
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        save() { calls.push(['save']) },
        restore() { calls.push(['restore']) },
        fillRect(x, y, w, h) { calls.push(['fillRect', x, y, w, h, this.fillStyle, this.globalAlpha]) },
        strokeRect(x, y, w, h) { calls.push(['strokeRect', x, y, w, h, this.strokeStyle]) }
    }
}

test('CanvasRenderer.renderTrails: paints the worn ground it can see, and caches it', () => {
    const Renderer = CanvasRenderer
    const harness = stub2DRendererHarness()
    try {
        const world = harness.world
        const f = resetTrailField(world)
        for (let i = 0; i < 20; i++) f.deposit(240 + i * 2, 300, 8, 0, 'pawn')

        const renderer = new Renderer(world, 'game-canvas')
        renderer.camera.viewX = 250
        renderer.camera.viewY = 300
        renderer.camera.zoomLevel = 1

        renderer.renderTrails()
        const fills = harness.context.calls.filter(c => c[0] === 'fillRect')
        assert.ok(fills.length > 0, 'worn ground under the camera should be painted')
        assert.ok(fills.every(c => c[6] > 0 && c[6] <= TRAIL_PAINT_MAX_ALPHA))
        assert.equal(fills[0][5], TRAIL_DIRT_COLOR)

        // Nothing changed: the same cells, and no third save/restore pass.
        const before = harness.context.calls.length
        renderer.renderTrails()
        assert.ok(harness.context.calls.length > before)
        const again = harness.context.calls.filter(c => c[0] === 'fillRect').length
        assert.equal(again, fills.length * 2, 'a cached refresh should redraw the same set')

        // Hiding them costs nothing at all.
        renderer.trailsVisible = false
        const quiet = harness.context.calls.length
        renderer.renderTrails()
        assert.equal(harness.context.calls.length, quiet)
    } finally {
        harness.restore()
    }
})

test('CanvasRenderer.renderTrails: debug mode strokes the raw cell grid', () => {
    const Renderer = CanvasRenderer
    const harness = stub2DRendererHarness()
    try {
        const world = harness.world
        const f = resetTrailField(world)
        for (let i = 0; i < 6; i++) f.deposit(240 + i * 8, 300, 12, 0, 'forager')

        const renderer = new Renderer(world, 'game-canvas')
        renderer.camera.viewX = 260
        renderer.camera.viewY = 300
        renderer.camera.zoomLevel = 1
        renderer.trailDebug = true

        renderer.renderTrails()
        const strokes = harness.context.calls.filter(c => c[0] === 'strokeRect')
        assert.equal(strokes.length, 6)
        assert.equal(strokes[0][5], TRAIL_KIND_COLORS.forager)
        assert.ok(harness.context.calls.filter(c => c[0] === 'fillRect').length === 6)
    } finally {
        harness.restore()
    }
})

/** Same DOM stubs as canvas-renderer-capabilities.test.js, with a recording context. */
function stub2DRendererHarness() {
    const context = stubContext()
    const canvas = {
        width: 800,
        height: 600,
        style: {},
        addEventListener() {},
        getContext: () => context,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
    }
    const previousDocument = globalThis.document
    const previousWindow = globalThis.window
    globalThis.window = { innerWidth: 800, innerHeight: 600, addEventListener() {}, removeEventListener() {} }
    globalThis.document = {
        getElementById: () => canvas,
        createElement: () => canvas,
        body: { appendChild() {} }
    }
    const world = {
        width: 1000,
        height: 1000,
        tick: 0,
        clock: { currentTick: 0, getProgress: () => ({ progress: 0, reset: false }) },
        entitiesMap: new Map(),
        entities: [],
        chunkManager: null
    }
    return {
        world,
        context,
        canvas,
        restore() {
            globalThis.document = previousDocument
            globalThis.window = previousWindow
        }
    }
}

// ------------------------------------------------- the 3D overlay's geometry

/**
 * three.js cannot be imported under `node --test` (ThreeRenderer resolves its
 * loaders from the served /vendor copy), so the 3D half of #93 is tested at its
 * seam: the paint feed in, the vertex attributes out. The renderer's own job is
 * checked at the source level below.
 */
function fakeAttributes(quads) {
    return {
        position: {
            count: quads * 4,
            xyz: new Map(),
            needsUpdate: false,
            setXYZ(i, x, y, z) { this.xyz.set(i, [x, y, z]) }
        },
        color: {
            count: quads * 4,
            rgba: new Map(),
            needsUpdate: false,
            setXYZW(i, r, g, b, a) { this.rgba.set(i, [r, g, b, a]) }
        }
    }
}

test('writeTrailQuads: one quad per worn cell, hugging the sampled ground', () => {
    const f = field()
    for (let i = 0; i < 5; i++) f.deposit(200 + i * 8, 300, 20, 0, 'predator')
    const cells = trailPaintFor({ field: f, rect: RECT, tick: 0 }).cells
    const attrs = fakeAttributes(cells.length)
    const slope = x => x / 100

    const count = writeTrailQuads(cells, attrs.position, attrs.color, { heightAt: slope, lift: 0.25 })
    assert.equal(count, cells.length)
    assert.equal(attrs.position.needsUpdate, true)
    assert.equal(attrs.color.needsUpdate, true)

    const cell = cells[0]
    const corners = [0, 1, 2, 3].map(i => attrs.position.xyz.get(i))
    // Centred on the cell and as wide as the feed says, in the XZ plane (three's
    // world Y is the game's y).
    assert.ok(Math.abs((corners[0][0] + corners[2][0]) / 2 - cell.x) < 1e-9)
    assert.ok(Math.abs((corners[0][2] + corners[2][2]) / 2 - cell.y) < 1e-9)
    assert.ok(Math.abs((corners[1][0] - corners[0][0]) - cell.size) < 1e-9)
    assert.ok(Math.abs((corners[2][2] - corners[0][2]) - cell.size) < 1e-9)
    for (const corner of corners) {
        assert.ok(Math.abs(corner[1] - (slope(corner[0]) + 0.25)) < 1e-9,
            'each corner takes the height under it, or a sloped path floats')
    }

    const expected = hexRgb(TRAIL_KIND_COLORS.predator)
    const tint = attrs.color.rgba.get(0)
    assert.deepEqual(tint.slice(0, 3), expected)
    assert.ok(tint[3] > 0 && tint[3] <= TRAIL_PAINT_MAX_ALPHA, 'wear is vertex alpha')
})

test('writeTrailQuads: junk, overflow and empty feeds are contained', () => {
    const attrs = fakeAttributes(4)
    assert.equal(writeTrailQuads([], attrs.position, attrs.color), 0)
    assert.equal(writeTrailQuads(null, attrs.position, attrs.color), 0)
    assert.equal(attrs.position.xyz.size, 0)

    // More cells than there is room for: the smaller budget wins, and the
    // attributes are never overrun.
    const many = Array.from({ length: 10 }, () => ({ x: 1, y: 2, size: 4, alpha: 1, color: '#ffffff' }))
    assert.equal(writeTrailQuads(many, attrs.position, attrs.color, { maxCells: 3 }), 3)
    assert.equal(writeTrailQuads(many, attrs.position, attrs.color), 4, 'or the attribute size')
    assert.equal(attrs.position.xyz.size, 16)

    const sink = fakeAttributes(1)
    const junk = [{ x: NaN, y: 4, size: NaN, alpha: NaN, color: undefined }]
    assert.equal(writeTrailQuads(junk, sink.position, sink.color, { heightAt: () => NaN }), 1)
    assert.ok(Number.isFinite(sink.position.xyz.get(0)[0]))
    assert.equal(sink.position.xyz.get(0)[1], 0, 'a NaN height reads as sea level')
})

test('hexRgb: short, long and broken colours all come out as channels', () => {
    assert.deepEqual(hexRgb('#ffffff'), [1, 1, 1])
    assert.deepEqual(hexRgb('#000000'), [0, 0, 0])
    assert.deepEqual(hexRgb('fff'), [1, 1, 1])
    assert.deepEqual(hexRgb('#8a6f4d'), [138 / 255, 111 / 255, 77 / 255])
    assert.deepEqual(hexRgb(undefined), [1, 1, 1])
    assert.deepEqual(hexRgb('nonsense'), [1, 1, 1])
})

test('both renderers are wired to the shared feed', () => {
    const two = readFileSync(new URL('../js/rendering/CanvasRenderer.js', import.meta.url), 'utf8')
    const three = readFileSync(new URL('../js/rendering/ThreeRenderer.js', import.meta.url), 'utf8')

    for (const source of [two, three]) {
        assert.match(source, /trailPaintFor\(/, 'views must go through the paint feed, not the raw field')
        assert.match(source, /paintSignature\(/, 'and rebuild only when it actually changed')
        assert.match(source, /trailsVisible/, 'with a way to hide the layer')
        assert.match(source, /trailDebug/, 'and the raw-grid debug view')
    }
    // Called from render() rather than left as dead code beside it.
    assert.match(two, /this\.renderTrails\(\)/)
    assert.match(three, /this\._updateTrailPaint\(\)/)
    // The 3D overlay is allocated once at the cap, so a refresh rewrites numbers.
    assert.match(three, /TRAIL_PAINT_MAX_CELLS/)
    assert.match(three, /setDrawRange/)
})

