/**
 * Tests for feedback channel UI — progression event → notification routing.
 *
 * Since feedbackChannelUI depends on browser DOM, we stub the minimum required globals.
 * Each test creates a fresh setupFeedbackChannelUI instance (independent closure state),
 * so a single module import is safe.
 */

import test from 'node:test'
import assert from 'node:assert'
import { setupFeedbackChannelUI } from '../js/ui/feedbackChannelUI.js'

// ── DOM stubs ──────────────────────────────────────────────────────────────────

function setupDomStubs(onTextContent) {
    const bodyEl = { appendChild() {} }

    const prev = {
        document: globalThis.document,
        requestAnimationFrame: globalThis.requestAnimationFrame,
        setTimeout: globalThis.setTimeout
    }

    globalThis.document = {
        getElementById() { return null },
        createElement() {
            const el = {
                style: { cssText: '', opacity: '0', transition: '' },
                innerHTML: '',
                _text: '',
                get textContent() { return this._text },
                set textContent(v) { this._text = v; onTextContent?.(v) },
                appendChild() {},
                remove() {}
            }
            return el
        },
        body: bodyEl
    }

    globalThis.requestAnimationFrame = fn => { fn(); return 0 }
    globalThis.setTimeout = () => 0

    return {
        restore() {
            globalThis.document = prev.document
            globalThis.requestAnimationFrame = prev.requestAnimationFrame
            globalThis.setTimeout = prev.setTimeout
        }
    }
}

// ── Minimal ProgressionController stub ────────────────────────────────────────

function makeProgressionStub() {
    const listeners = new Set()
    return {
        onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn) },
        emit(event) { listeners.forEach(fn => fn(event)) }
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('feedbackChannelUI — capability_reflection shows on phase transition', () => {
    let createdElementCount = 0
    const stubs = setupDomStubs()
    const origCreateElement = globalThis.document.createElement.bind(globalThis.document)
    globalThis.document.createElement = () => {
        createdElementCount += 1
        return origCreateElement()
    }
    try {
        const progression = makeProgressionStub()
        const { onProgressionPayload } = setupFeedbackChannelUI(progression)

        // First call establishes lastPhase without showing a panel
        onProgressionPayload({ phase: 'phase0_embodied', modules: { feedbackChannels: ['capability_reflection'] } }, null)

        const before = createdElementCount

        // Phase change should trigger capability_reflection panel
        onProgressionPayload({
            phase: 'phase1_situated',
            modules: {
                feedbackChannels: ['capability_reflection'],
                validCamera: 'third_lock',
                minimap: 'radar_blips',
                interactionControls: ['nudge_need_focus']
            }
        }, null)

        assert.ok(createdElementCount > before, 'createElement called when phase changes and capability_reflection is active')
    } finally {
        stubs.restore()
    }
})

test('feedbackChannelUI — intent_confirmation fires when pawn goal changes', () => {
    const toasts = []
    const stubs = setupDomStubs(text => { toasts.push(text) })
    try {
        const progression = makeProgressionStub()
        const { onProgressionPayload } = setupFeedbackChannelUI(progression)

        const pawn = { goals: { currentGoal: { type: 'gather', description: 'Gathering sticks' } } }
        const payload = { phase: 'phase1_situated', modules: { feedbackChannels: ['intent_confirmation'] } }

        // First call with a goal — should show toast
        onProgressionPayload(payload, pawn)

        const intentToasts = toasts.filter(t => t.includes('Gathering sticks'))
        assert.ok(intentToasts.length >= 1, 'intent toast shown when goal appears')
    } finally {
        stubs.restore()
    }
})

test('feedbackChannelUI — capability_unlocked progression event shows toast', () => {
    const toastTexts = []
    const stubs = setupDomStubs(text => { toastTexts.push(text) })
    try {
        const progression = makeProgressionStub()
        setupFeedbackChannelUI(progression)

        progression.emit({
            type: 'capability_unlocked',
            tick: 50,
            phase: 'phase1_situated',
            changes: [{ module: 'minimap', from: 'none', to: 'radar_blips' }]
        })

        const unlockToasts = toastTexts.filter(t => t.includes('minimap') || t.includes('radar blips'))
        assert.ok(unlockToasts.length >= 1, 'capability unlock toast shown')
    } finally {
        stubs.restore()
    }
})
