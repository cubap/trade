/**
 * Tests for #97 - the 3D renderer used to be unimportable under `node --test`, so
 * all ~2600 lines of ThreeRenderer.js were covered by text-scanning its source
 * instead of running it.
 *
 * Two helpers make that stop: `helpers/client-import-map.mjs` hands Node the same
 * importmap the page uses (so bare `three` and the root-absolute `/vendor/three/...`
 * loaders resolve to the *one* copy the browser loads), and `helpers/fake-browser.mjs`
 * stands in for `document`/`window` and a WebGL2 context. With those, this file
 * constructs the real renderer, drives the worn-ground overlay #93 added, and holds
 * teardown to account for the GPU resources it allocated.
 *
 * What this cannot prove: anything about pixels. The fake context accepts calls and
 * returns plausible parameters; shader compilation and draw output are not modelled.
 * Assert bookkeeping - what is in the scene, what the attributes hold, what got
 * released - never appearance.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { registerClientImportMap, importClientModule } from './helpers/client-import-map.mjs'
import { installFakeBrowser } from './helpers/fake-browser.mjs'
import { TRAIL_PAINT_MAX_CELLS, paintSignature, trailPaintFor } from '../js/core/TrailPaint.js'

const PAINT_RADIUS = 320 // mirrors TRAIL_PAINT_RADIUS_3D in ThreeRenderer.js
const LIFT = 0.25        // mirrors TRAIL_PAINT_LIFT
// The quad corners writeTrailQuads uses, kept here so expected positions come from
// the documented TrailPaint contract rather than from the code under test.
const CORNERS = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]

let THREE
let ThreeRenderer
let World
let TrailField
let browser

before(async () => {
    registerClientImportMap()
    browser = installFakeBrowser()
    ThreeRenderer = (await importClientModule('solo/js/rendering/ThreeRenderer.js')).default
    World = (await importClientModule('solo/js/core/World.js')).default
    TrailField = (await importClientModule('solo/js/core/TrailField.js')).default
    THREE = await import('three')
})

after(() => browser.restore())

/** Nothing ticks here, so a bare World is a frozen one - which is what we want. */
function makeWorld() {
    return new World(600, 600, { mapSeed: 7 })
}

/** Worn ground clustered around the point of view, which is what the overlay reads. */
function makeTrails(count = 12, amount = 60) {
    const field = new TrailField()
    for (let i = 0; i < count; i++) {
        field.deposit(300 + i * 8, 300 + (i % 4) * 8, amount, 1, 'pawn')
    }
    return field
}

/**
 * The renderer built the way app.js builds it: by canvas id, with the element
 * already in the document so `renderer.canvas` is the fake whose WebGL calls we see.
 */
function makeRenderer({ world = makeWorld(), view = { x: 300, y: 300 }, id = 'game-canvas', adopt = true } = {}) {
    let canvas = null
    if (adopt) {
        canvas = browser.document.createElement('canvas')
        canvas.id = id
        browser.document.body.appendChild(canvas)
    }

    const renderer = new ThreeRenderer(world, id)
    if (view) {
        renderer.viewX = view.x
        renderer.viewY = view.y
    }
    return { renderer, world, canvas }
}

// ------------------------------------------------------------------ importability

test('#97: bare `three` resolves to the vendored copy, not a second one', () => {
    // Two copies of three would make the vendored loaders' output fail `instanceof`
    // against the renderer's THREE, which is the trap this closes.
    assert.match(import.meta.resolve('three').replace(/\\/g, '/'),
        /\/vendor\/three\/build\/three\.module\.js$/)
    assert.equal(typeof THREE.Group, 'function')
    assert.equal(new THREE.Vector3(0, 3, 4).length(), 5)
})

test('#97: the loader modules that used to break the import resolve', async () => {
    // These are the files whose root-absolute `/vendor/three/examples/jsm/...`
    // specifiers Node used to turn into a path on the drive root.
    for (const rel of [
        'solo/js/rendering/ModelLoader.js',
        'solo/js/rendering/CameraController3D.js',
        'solo/js/rendering/TerrainMesh.js'
    ]) {
        const mod = await importClientModule(rel)
        assert.ok(mod, `${rel} should import`)
        assert.ok(Object.keys(mod).length > 0, `${rel} should export something`)
    }
})

test('#97: ThreeRenderer imports as a class', () => {
    assert.equal(typeof ThreeRenderer, 'function')
    assert.equal(ThreeRenderer.name, 'ThreeRenderer')
})

// ------------------------------------------------------------------- construction

test('#97: the renderer constructs headlessly against a stubbed WebGL context', () => {
    const { renderer, canvas } = makeRenderer()
    assert.equal(renderer.canvas, canvas, 'the existing canvas is adopted, not replaced')
    assert.ok(renderer.scene, 'the scene should exist')
    assert.ok(renderer.webglRenderer, 'the WebGL renderer should have been constructed')
    assert.ok(renderer.camera, 'the PlayerMode camera proxy should exist')
    // Terrain, lights and sky are built synchronously, so the scene is not empty
    // before a single model has loaded.
    assert.ok(renderer.scene.children.length > 0, 'scene has content')
    // Proof the constructor's asset tail was reached (and survived) rather than
    // skipped: the model loaders really did ask for their files.
    assert.ok(browser.requestsTo('models/').length > 0, 'model requests went through the fake fetch')
    renderer.destroy()
})

test('#97: a canvas that does not exist yet is created and adopted', () => {
    const { renderer } = makeRenderer({ id: 'never-made-canvas', adopt: false })
    assert.equal(renderer.canvas.id, 'never-made-canvas')
    assert.equal(browser.document.getElementById('never-made-canvas'), renderer.canvas,
        'the canvas it made is the one the document can find')
    assert.equal(renderer.canvas.getContext('webgl2'), renderer.webglRenderer.getContext(),
        'the renderer drew into the canvas it was given, once')
    renderer.destroy()
})

test('#97: the camera proxy reads and writes the renderer view state', () => {
    const { renderer } = makeRenderer({ view: { x: 120, y: 240 } })
    assert.equal(renderer.camera.viewX, 120)
    renderer.camera.viewY = 999
    assert.equal(renderer.viewY, 999, 'the proxy writes through instead of shadowing')
    renderer.destroy()
})

test('#97: resize and a frame run without a real GPU', () => {
    const { renderer } = makeRenderer()
    renderer.resizeCanvas()
    renderer.render()
    assert.ok(true, 'neither threw')
    renderer.destroy()
})

// -------------------------------------------------------------------- trail overlay

test('_trailRect: the overlay spans a fixed radius around the point of view', () => {
    const { renderer } = makeRenderer({ view: { x: 300, y: 300 } })
    assert.deepEqual(renderer._trailRect(), {
        x0: 300 - PAINT_RADIUS, y0: 300 - PAINT_RADIUS,
        x1: 300 + PAINT_RADIUS, y1: 300 + PAINT_RADIUS
    })
    renderer.destroy()
})

test('_ensureTrailMesh: allocated once, sized at the paint cap, and hidden until used', () => {
    const { renderer } = makeRenderer()

    const first = renderer._ensureTrailMesh()
    const second = renderer._ensureTrailMesh()
    assert.equal(first, second, 'the overlay is allocated once and reused')
    assert.equal(first.geometry.attributes.position.count, TRAIL_PAINT_MAX_CELLS * 4)
    assert.equal(first.geometry.attributes.color.count, TRAIL_PAINT_MAX_CELLS * 4)
    assert.equal(first.geometry.index.count, TRAIL_PAINT_MAX_CELLS * 6)
    assert.equal(first.visible, false, 'a mesh with nothing painted on it is hidden')
    assert.equal(first.frustumCulled, false, 'it spans the view, so culling would blink it out')
    assert.ok(renderer.scene.children.includes(first), 'the overlay is in the scene')

    renderer.destroy()
})

test('_updateTrailPaint: worn ground under the camera becomes quads', () => {
    const field = makeTrails(12, 60)
    const world = makeWorld()
    world.trailField = field
    const { renderer } = makeRenderer({ world })

    renderer._updateTrailPaint()
    const mesh = renderer._trailMesh
    assert.ok(mesh, 'the overlay exists after a paint pass')
    assert.equal(mesh.visible, true, 'worn ground is shown')

    // Independent oracle: ask TrailPaint itself what this view should look like.
    const rect = renderer._trailRect()
    const expected = trailPaintFor({ field, rect, tick: world.clock?.currentTick ?? 0 })
    assert.ok(expected.cells.length > 0, 'the fixture really does wear the visible rect')
    assert.equal(mesh.geometry.drawRange.count, expected.cells.length * 6, 'two triangles per cell')

    const pos = mesh.geometry.getAttribute('position')
    const col = mesh.geometry.getAttribute('color')
    for (let q = 0; q < expected.cells.length; q++) {
        const cell = expected.cells[q]
        for (let k = 0; k < 4; k++) {
            const v = q * 4 + k
            const [dx, dy] = CORNERS[k]
            assert.ok(Math.abs(pos.getX(v) - (cell.x + dx * cell.size)) < 1e-3,
                `quad ${q} corner ${k} x`)
            assert.ok(Math.abs(pos.getZ(v) - (cell.y + dy * cell.size)) < 1e-3,
                `quad ${q} corner ${k} z`)
            assert.ok(Number.isFinite(pos.getY(v)), `quad ${q} corner ${k} sits on sampled ground`)
            assert.ok(pos.getY(v) >= LIFT - 1e-6, `quad ${q} corner ${k} clears the surface by the lift`)
            assert.ok(Math.abs(col.getW(v) - cell.alpha) < 1e-6,
                `quad ${q} corner ${k} alpha is the cell's wear`)
        }
    }
    renderer.destroy()
})

test('_updateTrailPaint: the same view does not rewrite the attributes twice', () => {
    const field = makeTrails()
    const world = makeWorld()
    world.trailField = field
    const { renderer } = makeRenderer({ world })

    renderer._updateTrailPaint()
    assert.equal(renderer._trailSignature,
        paintSignature({ field, rect: renderer._trailRect(), tick: world.clock?.currentTick ?? 0 }),
        'the cache key comes from TrailPaint')

    let writes = 0
    const realWrite = renderer._writeTrailQuads.bind(renderer)
    renderer._writeTrailQuads = (...args) => { writes++; return realWrite(...args) }

    renderer._updateTrailPaint()
    renderer._updateTrailPaint()
    assert.equal(writes, 0, 'an unchanged signature must not touch the buffer again')

    field.deposit(320, 320, 90, 2, 'pawn')
    renderer._updateTrailPaint()
    assert.equal(writes, 1, 'new wear repaints exactly once')
    renderer.destroy()
})

test('_updateTrailPaint: panning the view repaints even when nothing walked', () => {
    const field = makeTrails()
    const world = makeWorld()
    world.trailField = field
    const { renderer } = makeRenderer({ world })
    renderer._updateTrailPaint()

    let writes = 0
    const realWrite = renderer._writeTrailQuads.bind(renderer)
    renderer._writeTrailQuads = (...args) => { writes++; return realWrite(...args) }

    renderer.viewX += 64
    renderer._updateTrailPaint()
    assert.equal(writes, 1, 'a quantised view change is a new signature')
    renderer.destroy()
})

test('_updateTrailPaint: hiding trails hides the overlay', () => {
    const field = makeTrails()
    const world = makeWorld()
    world.trailField = field
    const { renderer } = makeRenderer({ world })

    renderer._updateTrailPaint()
    assert.equal(renderer._trailMesh.visible, true)

    renderer.trailsVisible = false
    renderer._updateTrailPaint()
    assert.equal(renderer._trailMesh.visible, false, 'the overlay is hidden')
    renderer.destroy()
})

test('_updateTrailPaint: a world with no trail field shows nothing', () => {
    const { renderer } = makeRenderer()
    renderer._updateTrailPaint()
    assert.equal(renderer._trailMesh.visible, false, 'unworn ground draws no overlay')
    assert.equal(renderer._trailPaint, null, 'and holds no paint feed')
    renderer.destroy()
})

// --------------------------------------------------------------------- teardown

test('#97: destroy releases the overlay geometry and material it allocated', () => {
    const field = makeTrails()
    const world = makeWorld()
    world.trailField = field
    const { renderer } = makeRenderer({ world })
    renderer._updateTrailPaint()
    const mesh = renderer._trailMesh
    assert.ok(mesh, 'the overlay exists before teardown')

    let geoDisposed = 0
    let matDisposed = 0
    mesh.geometry.dispose = () => { geoDisposed++ }
    mesh.material.dispose = () => { matDisposed++ }

    renderer.destroy()
    assert.equal(geoDisposed, 1, 'the paint geometry should be disposed exactly once')
    assert.equal(matDisposed, 1, 'the paint material should be disposed exactly once')
})

test('#97: destroy releases the terrain mesh, the largest allocation there is', () => {
    const { renderer } = makeRenderer()
    const terrain = renderer._ground
    assert.ok(terrain, 'a terrain mesh should have been built')

    let geoDisposed = 0
    let matDisposed = 0
    terrain.geometry.dispose = () => { geoDisposed++ }
    terrain.material.dispose = () => { matDisposed++ }

    renderer.destroy()
    assert.equal(geoDisposed, 1, 'the terrain geometry should be disposed exactly once')
    assert.equal(matDisposed, 1, 'the terrain material should be disposed exactly once')
})

test('#97: destroy leaves no undisposed geometry or material in the scene', () => {
    const field = makeTrails()
    const world = makeWorld()
    world.trailField = field
    const { renderer } = makeRenderer({ world })
    renderer._ensureSightRing()
    renderer._updateTrailPaint()

    // Everything three keeps on the GPU until dispose() says otherwise.
    const seen = []
    const track = (obj, kind, resource) => {
        let disposed = 0
        const real = typeof resource.dispose === 'function' ? resource.dispose.bind(resource) : null
        resource.dispose = () => { disposed++; return real?.() }
        seen.push({ label: `${kind}:${obj.name || obj.type}`, disposed: () => disposed })
    }
    renderer.scene.traverse(obj => {
        if (obj.geometry) track(obj, 'geometry', obj.geometry)
        const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : [])
        for (const m of mats) track(obj, 'material', m)
    })
    assert.ok(seen.length > 0, 'the scene should hold resources to release')

    renderer.destroy()
    const leaked = seen.filter(e => e.disposed() === 0).map(e => e.label)
    assert.deepEqual(leaked, [], 'destroy() should release every resource the scene holds')
})

test('#97: destroy empties the scene so a rebuilt renderer cannot double-draw', () => {
    const { renderer } = makeRenderer()
    renderer._updateTrailPaint()
    renderer.destroy()
    assert.equal(renderer.scene.children.length, 0, 'nothing is left attached to the scene')
})
