import test from 'node:test'
import assert from 'node:assert'
import { esc, computeTrend } from '../js/ui/uiPanels.js'

test('esc escapes HTML-significant characters', () => {
    assert.strictEqual(esc('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    assert.strictEqual(esc("Tom's rock & roll"), 'Tom&#39;s rock &amp; roll')
})

test('esc handles non-string and empty values', () => {
    assert.strictEqual(esc(null), '')
    assert.strictEqual(esc(undefined), '')
    assert.strictEqual(esc(42), '42')
})

test('computeTrend returns 0 for the first sample', () => {
    const samples = new Map()
    assert.strictEqual(computeTrend('a', 10, 1000, samples), 0)
})

test('computeTrend detects rising and falling within window anchors', () => {
    const samples = new Map()
    computeTrend('hunger', 20, 0, samples)
    assert.strictEqual(computeTrend('hunger', 30, 2000, samples), 1)
    assert.strictEqual(computeTrend('hunger', 5, 5000, samples), -1)
})

test('computeTrend holds verdict between anchor updates (no flicker)', () => {
    const samples = new Map()
    computeTrend('thirst', 10, 0, samples)
    assert.strictEqual(computeTrend('thirst', 40, 2000, samples), 1)
    // mid-window repaints reuse the cached trend even if value dipped
    assert.strictEqual(computeTrend('thirst', 12, 2500, samples), 1)
})

test('computeTrend treats small deltas as steady', () => {
    const samples = new Map()
    computeTrend('energy', 50, 0, samples)
    assert.strictEqual(computeTrend('energy', 51, 2000, samples), 0)
})
