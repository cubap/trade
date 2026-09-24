import test from 'node:test'
import assert from 'node:assert'
import {
    UNIT_METERS,
    PAWN_HEIGHT_UNITS,
    MODEL_SCALES,
    stageScale,
    targetHeightFor
} from '../js/rendering/ModelScales.js'

test('canonical constants are sane', () => {
    assert.ok(UNIT_METERS > 0)
    assert.strictEqual(PAWN_HEIGHT_UNITS, MODEL_SCALES.pawn.targetHeight)
})

test('every category has a positive target height and bounded jitter', () => {
    for (const [name, entry] of Object.entries(MODEL_SCALES)) {
        assert.ok(Number.isFinite(entry.targetHeight) && entry.targetHeight > 0, `${name} targetHeight`)
        assert.ok(entry.jitter >= 0 && entry.jitter <= 1, `${name} jitter range`)
    }
})

test('pawn is the reference figure and stays proportional', () => {
    const pawn = targetHeightFor('pawn', 0.5)
    assert.ok(Math.abs(pawn - 7.5) < 0.01)
    // animals should not tower over the pawn
    assert.ok(targetHeightFor('animal', 0.5) <= pawn)
    // trees should tower over the pawn
    assert.ok(targetHeightFor('tree', 0.5, 'adult') > pawn * 2)
})

test('tree stage multipliers are monotonic and <= 1', () => {
    const sprout = stageScale('tree', 'sprout')
    const sapling = stageScale('tree', 'sapling')
    const adult = stageScale('tree', 'adult')
    assert.ok(sprout < sapling && sapling < adult)
    assert.strictEqual(adult, 1)
})

test('tree target height respects growth stage', () => {
    const adult = targetHeightFor('tree', 0.5, 'adult')
    const sapling = targetHeightFor('tree', 0.5, 'sapling')
    const sprout = targetHeightFor('tree', 0.5, 'sprout')
    assert.ok(sprout < sapling && sapling < adult)
    assert.ok(Math.abs(sapling - adult * 0.25) < 0.01)
})

test('unknown tree stage falls back to adult scale', () => {
    assert.strictEqual(stageScale('tree', 'seed'), 1)
    assert.strictEqual(stageScale('rock', 'adult'), 1)
})

test('jitter stays within +/- declared band', () => {
    for (const [name, entry] of Object.entries(MODEL_SCALES)) {
        const lo = targetHeightFor(name, 0, entry.stages ? 'adult' : null, entry.referenceSize)
        const hi = targetHeightFor(name, 1, entry.stages ? 'adult' : null, entry.referenceSize)
        assert.ok(lo >= entry.targetHeight * (1 - entry.jitter) - 0.001, `${name} low`)
        assert.ok(hi <= entry.targetHeight * (1 + entry.jitter) + 0.001, `${name} high`)
    }
})

test('rock height scales with entity size', () => {
    const small = targetHeightFor('rock', 0.5, null, 1.5)
    const big = targetHeightFor('rock', 0.5, null, 6)
    assert.ok(big > small * 3.5, `expected ${big} > ${small * 3.5}`)
})

test('unknown category returns null', () => {
    assert.strictEqual(targetHeightFor('cloud', 0.5), null)
})
