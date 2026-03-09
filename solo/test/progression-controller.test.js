import test from 'node:test'
import assert from 'node:assert'
import ProgressionController from '../js/core/ProgressionController.js'

function makeWorld(tick = 0) {
    return { clock: { currentTick: tick } }
}

function makePawn(overrides = {}) {
    return {
        skills: {
            gathering: 0,
            orienteering: 0,
            planning: 0,
            cartography: 0,
            ...overrides.skills
        },
        inventorySlots: overrides.inventorySlots ?? 2,
        reputation: { membership: overrides.membership ?? {} },
        progressionMetrics: {
            createdLandmarkReturnLoops: overrides.createdLandmarkReturnLoops ?? 0,
            routeRecallConsistency: overrides.routeRecallConsistency ?? 0
        }
    }
}

test('ProgressionController — default payload starts in phase0', () => {
    const controller = new ProgressionController()
    const payload = controller.evaluate(makePawn(), makeWorld(10))

    assert.strictEqual(payload.phase, 'phase0_embodied')
    assert.strictEqual(payload.modules.validCamera, 'first_locked')
    assert.strictEqual(payload.modules.compass, 'none')
    assert.strictEqual(payload.modules.minimap, 'none')
    assert.strictEqual(payload.modules.perceptionModePolicy, 'disabled')
    assert.strictEqual(payload.modules.labels, 'nearby_class_only')
    assert.deepStrictEqual(payload.modules.mapOverlay, [])
    assert.strictEqual(payload.modules.steering, 'need_nudges_only')
    assert.ok(payload.modules.interactionControls.includes('nudge_basic'))
    assert.ok(payload.modules.feedbackChannels.includes('thought_stream_basic'))
    assert.deepStrictEqual(payload.modules.pawnStatus, ['vitals_basic', 'task_intent'])
})

test('ProgressionController — phase override forces module preset', () => {
    const controller = new ProgressionController()
    controller.setOverridePhase('overseer')

    const payload = controller.evaluate(makePawn(), makeWorld(10))
    assert.strictEqual(payload.phase, 'overseer')
    assert.strictEqual(payload.overrideActive, true)
    assert.strictEqual(payload.modules.minimap, 'local_full_map')
    assert.strictEqual(payload.modules.perceptionModePolicy, 'mode_aware')
    assert.strictEqual(payload.modules.labels, 'named_landmarks')
    assert.ok(payload.modules.mapOverlay.includes('waypoints_local'))
    assert.strictEqual(payload.modules.steering, 'waypoint_policy_local')
    assert.ok(payload.modules.interactionControls.includes('waypoint_place'))
    assert.ok(payload.modules.feedbackChannels.includes('system_dashboard_local'))
    assert.ok(payload.modules.pawnStatus.includes('inventory_detail'))
})

test('ProgressionController — clearing override returns to evaluator phase output', () => {
    const controller = new ProgressionController()
    controller.setOverridePhase('god')

    const overridden = controller.evaluate(makePawn(), makeWorld(10))
    assert.strictEqual(overridden.phase, 'god')
    assert.strictEqual(overridden.overrideActive, true)
    assert.strictEqual(overridden.telemetryContext.isOverrideSession, true)

    controller.clearOverridePhase()
    const normal = controller.evaluate(makePawn(), makeWorld(11))
    assert.strictEqual(normal.phase, 'phase0_embodied')
    assert.strictEqual(normal.overrideActive, false)
    assert.strictEqual(normal.telemetryContext.isOverrideSession, false)
})

test('ProgressionController — mode unlock gates follow skill/membership', () => {
    const controller = new ProgressionController()
    const pawn = makePawn({
        skills: { gathering: 50 },
        membership: { tribe_1: 1 }
    })

    const payload = controller.evaluate(pawn, makeWorld(20))
    assert.strictEqual(payload.modeUnlocked.overseer, true)
    assert.strictEqual(payload.modeUnlocked.god, true)
})

test('ProgressionController — emits transition telemetry when phase changes', () => {
    const controller = new ProgressionController()
    const events = []
    controller.onEvent(event => events.push(event))

    controller.evaluate(makePawn(), makeWorld(1))
    controller.evaluate(makePawn({ inventorySlots: 4 }), makeWorld(2))

    const phaseEvents = events.filter(e => e.type === 'phase_entered')
    assert.ok(phaseEvents.length >= 2)
})

test('ProgressionController — emits capability_unlocked when module levels change', () => {
    const controller = new ProgressionController()
    const events = []
    controller.onEvent(event => events.push(event))

    controller.evaluate(makePawn(), makeWorld(1))
    controller.evaluate(makePawn({ inventorySlots: 4 }), makeWorld(2))

    const capabilityEvents = events.filter(e => e.type === 'capability_unlocked')
    assert.ok(capabilityEvents.length >= 1)
})

test('ProgressionController — does not emit capability_unlocked for unchanged module values', () => {
    const controller = new ProgressionController()
    const events = []
    controller.onEvent(event => events.push(event))

    const pawn = makePawn({ inventorySlots: 4 })
    controller.evaluate(pawn, makeWorld(1))
    controller.evaluate(pawn, makeWorld(2))
    controller.evaluate(pawn, makeWorld(3))

    const capabilityEvents = events.filter(e => e.type === 'capability_unlocked')
    assert.strictEqual(capabilityEvents.length, 0)
})

test('ProgressionController — fast-forward transition correctness across milestones', () => {
    const controller = new ProgressionController()
    const events = []
    controller.onEvent(event => events.push(event))

    // Simulate progression over skipped time by evaluating milestone states at increasing ticks.
    controller.evaluate(makePawn(), makeWorld(100))
    controller.evaluate(makePawn({
        skills: { orienteering: 15 },
        createdLandmarkReturnLoops: 2
    }), makeWorld(2000))
    controller.evaluate(makePawn({
        skills: { gathering: 50, orienteering: 20, planning: 12 },
        createdLandmarkReturnLoops: 2,
        routeRecallConsistency: 0.8,
        membership: { tribe_1: 1 }
    }), makeWorld(5000))

    const phases = events.filter(e => e.type === 'phase_entered').map(e => e.phase)
    assert.ok(phases.includes('phase0_embodied'))
    assert.ok(phases.includes('overseer'))
    assert.ok(phases.includes('god'))
})
