import test from 'node:test'
import assert from 'node:assert'
import CanvasRenderer from '../js/rendering/CanvasRenderer.js'

function setupDomStubs() {
    const ctx = {
        clearRect() {},
        fillRect() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        strokeRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        setLineDash() {},
        fillText() {},
        globalAlpha: 1,
        fillStyle: '#000',
        strokeStyle: '#fff',
        lineWidth: 1,
        font: '12px Arial',
        textAlign: 'left',
        textBaseline: 'middle'
    }

    const canvas = {
        width: 800,
        height: 600,
        style: {},
        addEventListener() {},
        getContext() { return ctx },
        getBoundingClientRect() {
            return { left: 0, top: 0, width: 800, height: 600 }
        }
    }

    const previousWindow = globalThis.window
    const previousDocument = globalThis.document

    globalThis.window = {
        innerWidth: 800,
        innerHeight: 600,
        addEventListener() {},
        removeEventListener() {}
    }

    globalThis.document = {
        getElementById() {
            return canvas
        },
        createElement() {
            return canvas
        },
        body: {
            appendChild() {}
        }
    }

    return {
        restore() {
            globalThis.window = previousWindow
            globalThis.document = previousDocument
        }
    }
}

test('CanvasRenderer applies capability state to minimap, panning, and perception policy', () => {
    const stubs = setupDomStubs()
    try {
        const world = {
            width: 1000,
            height: 1000,
            clock: { currentTick: 0, getProgress: () => ({ progress: 0, reset: false }) },
            entitiesMap: new Map(),
            chunkManager: null
        }

        const renderer = new CanvasRenderer(world, 'game-canvas')

        renderer.setCapabilities({
            modules: {
                validCamera: 'third_free',
                minimap: 'radar_icons',
                compass: 'cardinal_with_landmarks',
                perceptionModePolicy: 'phase_aware'
            }
        })

        assert.strictEqual(renderer.uiRenderer.showMinimap, true)
        assert.strictEqual(renderer.camera.allowManualPan, true)
        assert.strictEqual(renderer.perceptionPolicy, 'phase_aware')

        renderer.setCapabilities({
            modules: {
                validCamera: 'first_locked',
                minimap: 'none',
                compass: 'none',
                perceptionModePolicy: 'disabled'
            }
        })

        assert.strictEqual(renderer.uiRenderer.showMinimap, false)
        assert.strictEqual(renderer.camera.allowManualPan, false)
        assert.strictEqual(renderer.perceptionPolicy, 'disabled')
    } finally {
        stubs.restore()
    }
})
