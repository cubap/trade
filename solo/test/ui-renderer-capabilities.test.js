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

test('UIRenderer route_traces overlay calls stroke when provider returns segments', () => {
    let strokeCalled = 0
    const ctx = {
        ...makeContext(),
        stroke() { strokeCalled += 1 },
        save() {},
        restore() {}
    }
    const world = { width: 1000, height: 1000, entitiesMap: new Map() }
    const renderer = new UIRenderer(ctx, world)

    renderer.setCapabilities({
        modules: { minimap: 'radar_icons', mapOverlay: ['route_traces'] }
    })

    const traceSegments = [{ points: [{ x: 100, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 150 }] }]
    renderer.setRouteTraceProvider(() => traceSegments)

    renderer.renderMinimapOverlays(10, 10, 150)
    assert.ok(strokeCalled >= 1, 'stroke should be called at least once for a route trace segment')
})

test('UIRenderer waypoints_local overlay renders a dot for each waypoint', () => {
    let arcCalled = 0
    const ctx = {
        ...makeContext(),
        arc() { arcCalled += 1 },
        fill() {},
        save() {},
        restore() {}
    }
    const world = { width: 1000, height: 1000, entitiesMap: new Map() }
    const renderer = new UIRenderer(ctx, world)

    renderer.setCapabilities({
        modules: { minimap: 'local_full_map', mapOverlay: ['waypoints_local'] }
    })

    const waypoints = [{ x: 200, y: 300, id: 1, label: 'camp' }, { x: 600, y: 700, id: 2, label: 'water' }]
    renderer.setWaypointProvider(() => waypoints)

    renderer.renderMinimapOverlays(10, 10, 150)
    // Each waypoint draws 2 arc calls (outer ring + inner dot)
    assert.strictEqual(arcCalled, waypoints.length * 2, 'each waypoint draws two arcs')
})

test('UIRenderer renderMinimapOverlays dispatches to all active overlay types', () => {
    const called = { chunkEdges: false, resourceMarkers: false, routeTraces: false, waypoints: false }
    const ctx = {
        ...makeContext(),
        fill() { called.waypoints = true },
        save() {},
        restore() {},
        stroke() { called.routeTraces = true },
        arc() {}
    }

    const world = {
        width: 1000,
        height: 1000,
        entitiesMap: new Map([['r1', { type: 'immobile', x: 400, y: 400 }]]),
        chunkManager: { chunksX: 4, chunksY: 4 }
    }
    const renderer = new UIRenderer(ctx, world)

    renderer.setCapabilities({
        modules: {
            minimap: 'local_full_map',
            mapOverlay: ['biome_edges', 'resource_class', 'route_traces', 'waypoints_local']
        }
    })

    renderer.setRouteTraceProvider(() => [{ points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] }])
    renderer.setWaypointProvider(() => [{ x: 500, y: 500, id: 99, label: 'test' }])

    renderer.renderMinimapOverlays(10, 10, 150)

    assert.ok(called.routeTraces, 'route_traces overlay should trigger stroke')
    assert.ok(called.waypoints, 'waypoints_local overlay should trigger fill')
})
