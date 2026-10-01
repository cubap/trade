import test from 'node:test'
import assert from 'node:assert/strict'
import {
    createIntroCinematic,
    introCameraPose,
    INTRO_START_HEIGHT,
    INTRO_END_HEIGHT,
    INTRO_START_RADIUS,
    INTRO_TOTAL_MS
} from '../js/rendering/IntroCinematic.js'

// The mixin expects a browser-ish host for input listeners.
globalThis.window = globalThis.window || {
    addEventListener() {},
    removeEventListener() {}
}

function fakeRenderer() {
    const r = {
        _ground: null,
        entered: null,
        _camera3d: {
            position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } },
            looks: [],
            lookAt(x, y, z) { this.looks.push([x, y, z]) }
        },
        _getGroundHeightAt: () => 0,
        enterFirstPerson(pawn) { this.entered = pawn }
    }
    Object.assign(r, createIntroCinematic())
    return r
}

test('introCameraPose: opens high with a wide radius, looking at the pawn', () => {
    const pose = introCameraPose(0, 100, 200, 5)
    assert.equal(pose.y, 5 + INTRO_START_HEIGHT)
    assert.ok(Math.abs(pose.x - 100) <= INTRO_START_RADIUS + 1e-9)
    assert.equal(pose.lookX, 100)
    assert.equal(pose.lookZ, 200)
})

test('introCameraPose: ends directly above the pawn at low height', () => {
    const pose = introCameraPose(1, 100, 200, 5)
    assert.ok(Math.hypot(pose.x - 100, pose.z - 200) < 1e-6, 'radius should close to zero')
    assert.equal(pose.y, 5 + INTRO_END_HEIGHT)
})

test('introCameraPose: sweeps a full 360 degrees while descending', () => {
    const start = introCameraPose(0, 0, 0, 0)
    const end = introCameraPose(1, 0, 0, 0)
    assert.ok(Math.abs(end.azimuth - start.azimuth - Math.PI * 2) < 1e-9)
    let prevY = Infinity
    for (let t = 0; t <= 1.0001; t += 0.05) {
        const pose = introCameraPose(t, 0, 0, 0)
        assert.ok(pose.y <= prevY + 1e-9, 'height must be monotonically non-increasing')
        prevY = pose.y
    }
})

test('intro lifecycle: holds until terrain exists, then drives the camera', () => {
    const r = fakeRenderer()
    const pawn = { x: 10, y: 20 }
    r.startIntroCinematic(pawn)
    assert.equal(r._intro.active, true)

    // No terrain yet: camera untouched, clock not started.
    r._updateIntroCamera()
    assert.equal(r._intro.t0, null)
    assert.equal(r._camera3d.looks.length, 0)

    r._ground = {}
    r._updateIntroCamera()
    assert.notEqual(r._intro.t0, null)
    assert.equal(r._camera3d.looks.length, 1)
    assert.equal(r.entered, null)

    // Fast-forward past the full sequence.
    r._intro.t0 -= INTRO_TOTAL_MS + 10
    r._updateIntroCamera()
    assert.equal(r.entered, pawn)
    assert.equal(r._intro, null)
})

test('intro lifecycle: skip jumps straight to first person', () => {
    const r = fakeRenderer()
    const pawn = { x: 1, y: 2 }
    r._ground = {}
    r.startIntroCinematic(pawn)
    r._updateIntroCamera()
    r.skipIntroCinematic()
    r._updateIntroCamera()
    assert.equal(r.entered, pawn)
    assert.equal(r._intro, null)
})

test('intro lifecycle: overlay fades in from black and back to black on snap', () => {
    const created = []
    globalThis.document = {
        createElement: () => {
            const el = { style: {}, textContent: '', remove() { this.removed = true } }
            created.push(el)
            return el
        },
        body: { appendChild() {} }
    }
    try {
        const r = fakeRenderer()
        r._ground = {}
        r.startIntroCinematic({ x: 1, y: 2 })
        const ov = created[0]
        r._updateIntroCamera()
        assert.ok(Number(ov.style.opacity) > 0.9, 'first frame should be nearly black')

        // Mid fade-in
        r._intro.t0 = performance.now() - 600
        r._updateIntroCamera()
        const mid = Number(ov.style.opacity)
        assert.ok(mid > 0 && mid < 1, `expected partial fade, got ${mid}`)

        // Snap phase ends in black
        r._intro.t0 = performance.now() - (7000 + 1300 + 600)
        r._updateIntroCamera()
        assert.ok(Number(ov.style.opacity) > 0.5, 'snap should fade toward black')
    } finally {
        delete globalThis.document
    }
})

test('intro lifecycle: double start is ignored', () => {
    const r = fakeRenderer()
    r.startIntroCinematic({ x: 0, y: 0 })
    const first = r._intro
    r.startIntroCinematic({ x: 5, y: 5 })
    assert.equal(r._intro, first)
})
