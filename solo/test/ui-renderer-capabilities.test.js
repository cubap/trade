import test from 'node:test'
import assert from 'node:assert'
import UIRenderer from '../js/rendering/UIRenderer.js'

function makeContext() {
    return {
        canvas: { width: 800, height: 600 },
        save() {},
        restore() {},
        fillRect() {},
        strokeRect() {},
        fillText() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        setLineDash() {},
        globalAlpha: 1,
        fillStyle: '#000',
        strokeStyle: '#fff',
        lineWidth: 1,
        font: '12px Arial',
        textAlign: 'left',
        textBaseline: 'middle'
    }
}

test('UIRenderer setCapabilities toggles compass/minimap and override badge', () => {
    const renderer = new UIRenderer(makeContext(), { width: 1000, height: 1000 })

    renderer.setCapabilities({
        phase: 'phase2_orienting',
        overrideActive: true,
        modules: {
            compass: 'cardinal_with_landmarks',
            minimap: 'radar_icons',
            labels: 'known_landmarks',
            mapOverlay: ['resource_known_types', 'route_traces']
        }
    })

    assert.strictEqual(renderer.showCompass, true)
    assert.strictEqual(renderer.showMinimap, true)
    assert.strictEqual(renderer.minimapMode, 'radar_icons')
    assert.strictEqual(renderer.overrideBadgeText, 'OVERRIDE: phase2_orienting')
    assert.strictEqual(renderer.labelsModeText, 'labels: known landmarks')
    assert.strictEqual(renderer.mapOverlayText, 'overlay: resource known types, route traces')
    assert.strictEqual(renderer.getActiveMapOverlays().has('route_traces'), true)

    renderer.setCapabilities({
        phase: 'phase0_embodied',
        overrideActive: false,
        modules: {
            compass: 'none',
            minimap: 'none',
            labels: 'nearby_class_only',
            mapOverlay: []
        }
    })

    assert.strictEqual(renderer.showCompass, false)
    assert.strictEqual(renderer.showMinimap, false)
    assert.strictEqual(renderer.minimapMode, 'none')
    assert.strictEqual(renderer.overrideBadgeText, '')
    assert.strictEqual(renderer.labelsModeText, 'labels: nearby class only')
    assert.strictEqual(renderer.mapOverlayText, 'overlay: none')
    assert.strictEqual(renderer.getActiveMapOverlays().size, 0)
})

test('UIRenderer minimap config varies by mode stage', () => {
    const renderer = new UIRenderer(makeContext(), { width: 1000, height: 1000, entitiesMap: new Map() })

    const radar = renderer.getMinimapRenderConfig('radar_icons')
    const partial = renderer.getMinimapRenderConfig('partial_recall_map')
    const full = renderer.getMinimapRenderConfig('local_full_map')

    assert.strictEqual(radar.scanRing, true)
    assert.strictEqual(radar.includeImmobile, false)
    assert.ok(radar.maxEntities < partial.maxEntities)
    assert.ok(partial.maxEntities < full.maxEntities)
    assert.strictEqual(full.includeImmobile, true)
})
