import test from 'node:test'
import assert from 'node:assert'
import PlayerMode, { MODES, OVERSEER_SKILL_THRESHOLD, GOD_SKILL_THRESHOLD } from '../js/core/PlayerMode.js'

// ── Minimal stubs ──────────────────────────────────────────────────────────────

function makeRenderer() {
    return {
        camera: {
            zoomLevel: 1,
            minZoom: 0.1,
            maxZoom: 5,
            viewX: 1000,
            viewY: 1000,
            setZoomToShowRadius(radius, margin) {
                this.zoomLevel = margin ?? 1
            }
        },
        followedEntity: null,
        setFollowEntity(entity) {
            this.followedEntity = entity
        }
    }
}

function makeWorld() {
    return { width: 2000, height: 2000 }
}

function makePawn(totalSkill = 0, hasMembership = false) {
    const skills = totalSkill > 0 ? { gathering: totalSkill } : {}
    return {
        name: 'TestPawn',
        traits: { detection: 100 },
        skills,
        reputation: {
            membership: hasMembership ? { tribe_1: 1 } : {}
        }
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('PlayerMode — initial mode is PAWN', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())
    assert.strictEqual(pm.currentMode, MODES.PAWN)
})

test('PlayerMode — only PAWN mode unlocked with no pawn', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())
    const unlocked = pm.getUnlockedModes()
    assert.ok(unlocked.has(MODES.PAWN))
    assert.ok(!unlocked.has(MODES.OVERSEER))
    assert.ok(!unlocked.has(MODES.GOD))
})

test('PlayerMode — OVERSEER unlocks at skill threshold', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())
    pm.setTrackedPawn(makePawn(OVERSEER_SKILL_THRESHOLD - 1))
    assert.ok(!pm.getUnlockedModes().has(MODES.OVERSEER), 'not yet unlocked below threshold')

    pm.setTrackedPawn(makePawn(OVERSEER_SKILL_THRESHOLD))
    assert.ok(pm.getUnlockedModes().has(MODES.OVERSEER), 'unlocked at threshold')
})

test('PlayerMode — GOD mode requires skill threshold and group membership', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())

    // High skill, no membership → GOD locked
    pm.setTrackedPawn(makePawn(GOD_SKILL_THRESHOLD, false))
    assert.ok(!pm.getUnlockedModes().has(MODES.GOD), 'GOD locked without membership')

    // High skill + membership → GOD unlocked
    pm.setTrackedPawn(makePawn(GOD_SKILL_THRESHOLD, true))
    assert.ok(pm.getUnlockedModes().has(MODES.GOD), 'GOD unlocked with membership')
})

test('PlayerMode — switchMode returns false when mode is locked', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())
    pm.setTrackedPawn(makePawn(0))
    const result = pm.switchMode(MODES.OVERSEER)
    assert.strictEqual(result, false)
    assert.strictEqual(pm.currentMode, MODES.PAWN)
})

test('PlayerMode — switchMode succeeds when unlocked and fires listener', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())
    pm.setTrackedPawn(makePawn(OVERSEER_SKILL_THRESHOLD))

    let fired = null
    pm.onModeChange((next, prev) => { fired = { next, prev } })

    const result = pm.switchMode(MODES.OVERSEER)
    assert.strictEqual(result, true)
    assert.strictEqual(pm.currentMode, MODES.OVERSEER)
    assert.deepStrictEqual(fired, { next: MODES.OVERSEER, prev: MODES.PAWN })
})

test('PlayerMode — addWaypoint only works in OVERSEER mode', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())
    pm.setTrackedPawn(makePawn(OVERSEER_SKILL_THRESHOLD))

    // In PAWN mode, waypoints are rejected
    const rejected = pm.addWaypoint(100, 200, 'test')
    assert.strictEqual(rejected, null)

    pm.switchMode(MODES.OVERSEER)
    const wp = pm.addWaypoint(100, 200, 'cache')
    assert.ok(wp, 'waypoint created')
    assert.strictEqual(pm.mapWaypoints.length, 1)
    assert.strictEqual(pm.mapWaypoints[0].label, 'cache')
})

test('PlayerMode — removeWaypoint removes by id', () => {
    const pm = new PlayerMode(makeWorld(), makeRenderer())
    pm.setTrackedPawn(makePawn(OVERSEER_SKILL_THRESHOLD))
    pm.switchMode(MODES.OVERSEER)

    const wp = pm.addWaypoint(300, 400, 'mine')
    pm.removeWaypoint(wp.id)
    assert.strictEqual(pm.mapWaypoints.length, 0)
})

test('PlayerMode — GOD mode detaches camera follow', () => {
    const renderer = makeRenderer()
    const pm = new PlayerMode(makeWorld(), renderer)
    const pawn = makePawn(GOD_SKILL_THRESHOLD, true)
    pm.setTrackedPawn(pawn)

    pm.switchMode(MODES.GOD)
    assert.strictEqual(renderer.followedEntity, null, 'camera detached in GOD mode')
})
