import test from 'node:test'
import assert from 'node:assert'
import {
    cameraFloorY,
    smoothLookY,
    CAMERA_GROUND_CLEARANCE
} from '../js/rendering/CameraGround.js'

test('cameraFloorY uses the highest sample along the camera-pawn segment', () => {
    // Ridge rising toward the pawn: pawn-side sample must win
    const sample = (x) => x * 2
    const floor = cameraFloorY(sample, 0, 0, 10, 0, 5)
    assert.strictEqual(floor, 20 + CAMERA_GROUND_CLEARANCE)
})

test('cameraFloorY covers a wall behind the pawn (camera-side sample)', () => {
    const sample = (x) => (x < 2 ? 50 : 0)
    const floor = cameraFloorY(sample, 0, 0, 10, 0, 5)
    assert.strictEqual(floor, 50 + CAMERA_GROUND_CLEARANCE)
})

test('cameraFloorY skips non-finite samples but returns null when all fail', () => {
    const partial = (x) => (x === 0 ? NaN : 5)
    assert.strictEqual(partial(0, 0), NaN)
    assert.strictEqual(cameraFloorY(partial, 0, 0, 10, 0, 2), 5 + CAMERA_GROUND_CLEARANCE)
    assert.strictEqual(cameraFloorY(() => NaN, 0, 0, 10, 0), null)
})

test('smoothLookY initializes from target and converges slowly', () => {
    assert.strictEqual(smoothLookY(undefined, 100), 100)
    assert.strictEqual(smoothLookY(NaN, 100), 100)
    // One step of default 0.05 smoothing barely moves the horizon
    const next = smoothLookY(100, 130)
    assert.ok(Math.abs(next - 101.5) < 1e-9)
    // A terrain spike is damped, not followed
    const spiked = smoothLookY(100, 400)
    assert.ok(spiked < 120, 'spike should not yank the horizon')
})

test('smoothLookY keeps prev when target goes non-finite', () => {
    assert.strictEqual(smoothLookY(90, NaN), 90)
})
