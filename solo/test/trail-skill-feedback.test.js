import test from 'node:test'
import assert from 'node:assert/strict'
import TrailField, { trailFieldFor } from '../js/core/TrailField.js'
import { trailReadout } from '../js/core/TrailPaint.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import UIRenderer from '../js/rendering/UIRenderer.js'
import CanvasRenderer from '../js/rendering/CanvasRenderer.js'

// #96: the walk has to be visibly worth something. Trail XP is paid in
// fractions per step, so the contract is: record every award with its cause,
// interrupt the player only when the work adds up to a whole level, and let the
// HUD say what the ground and the walking have done.

function fakeWorld({ tick = 0 } = {}) {
    const world = {
        width: 1000,
        height: 1000,
        tick,
        clock: { currentTick: tick },
        chunkManager: {
            getWaterDepthAt: () => 0,
            getElevationAt: () => 0,
            getChunkAtPosition: () => ({ biome: 'plains' }),
            isPassable: () => true
        }
    }
    world.trailField = trailFieldFor(world)
    return world
}

function makeWalker(world, id = 'p1') {
    const pawn = new Pawn(id, 'Scout', 0, 0)
    pawn.world = world
    pawn.addThought = () => {}
    return pawn
}

/** Wear a straight line so a road can be recognised along it (#95's rule). */
function wearLine(field, x0, y0, x1, y1, tick, amount = 20) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4))
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        field.deposit(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, amount, tick, 'pawn')
    }
}

/** Followed steps, the way MobileEntity hands them over. */
function follow(pawn, times, bias = {}) {
    for (let i = 0; i < times; i++) {
        pawn.onTrailFollowed({ gain: 0.5, intensity: 8, at: { x: 0, y: 0 }, ...bias })
    }
}

function fakeContext(lines = []) {
    return {
        canvas: { width: 800, height: 600 },
        save() {},
        restore() {},
        fillRect() {},
        strokeRect() {},
        fillText: text => lines.push(text)
    }
}

test('trailReadout: a panel can ask for silence instead of a sentence', () => {
    const field = new TrailField()
    assert.equal(trailReadout(field, 0), 'no ground worn yet', 'the default wording is unchanged')
    assert.equal(trailReadout(field, 0, { empty: '' }), '', 'nothing worn says nothing')
    assert.equal(trailReadout(null, 0, { empty: '' }), '')

    field.deposit(12, 12, 20, 0, 'pawn')
    const text = trailReadout(field, 0, { empty: '' })
    assert.match(text, /paths 1 cells/)
    assert.match(text, /pawn 20/, 'the readout names who wore it')
})

test('followed steps are recorded with their cause, and stay quiet', () => {
    const pawn = makeWalker(fakeWorld())
    follow(pawn, 100)

    assert.ok(pawn.getSkill('orienteering') > 0, 'the walk paid')
    assert.deepEqual(pawn.drainSkillNotices(), [], '100 steps of 0.004 is not a level')

    // The ledger is the last `maxSkillLedger` awards, not a lifetime tally.
    assert.equal(pawn.skillLedger.length, pawn.maxSkillLedger)
    const windowed = (0.004 * pawn.maxSkillLedger).toFixed(2)
    assert.equal(pawn.skillWhy('orienteering'), `trodden ground +${windowed} x${pawn.maxSkillLedger}`)
    assert.equal(pawn.skillWhy('tracking'), '', 'nothing earned it, nothing to explain')
})

test('a whole level of trail skill is worth interrupting for', () => {
    const pawn = makeWalker(fakeWorld())
    follow(pawn, 260)

    const notices = pawn.drainSkillNotices()
    assert.equal(notices.length, 1, 'exactly one notice per level crossed')
    assert.match(notices[0], /route you keep walking is paying off \(orienteering 1\)$/)
    assert.equal(pawn.getSkill('orienteering') >= 1, true)
    assert.deepEqual(pawn.drainSkillNotices(), [], 'reading the queue empties it')

    // 260 more steps is about 1.04 points, so exactly one further level.
    follow(pawn, 260)
    const second = pawn.drainSkillNotices()
    assert.equal(second.length, 1)
    assert.match(second[0], /\(orienteering 2\)$/)
})

test('reading mixed tracks is what makes a tracker, and says so', () => {
    const world = fakeWorld()
    const field = world.trailField
    for (let i = 0; i < 20; i++) {
        field.deposit(4, 4, 12, 0, 'forager')
        field.deposit(4, 4, 12, 0, 'predator')
    }
    const pawn = makeWalker(world)
    follow(pawn, 200)

    assert.ok(pawn.getSkill('tracking') >= 1, `expected a level of tracking, got ${pawn.getSkill('tracking')}`)
    const notices = pawn.drainSkillNotices()
    assert.ok(notices.some(text => /whose prints these are now \(tracking 1\)/.test(text)), notices.join(' | '))

    // The window is shared, so the answer is whatever the ledger still holds.
    const inWindow = pawn.skillLedger.filter(entry => entry.skill === 'tracking').length
    assert.equal(pawn.skillWhy('tracking'), `mixed tracks +${(0.006 * inWindow).toFixed(2)} x${inWindow}`)
    assert.equal(pawn.skillWhy('orienteering').startsWith('trodden ground'), true)
})

test('the ledger is bounded, so a long walk cannot grow it', () => {
    const pawn = makeWalker(fakeWorld())
    follow(pawn, 400)
    assert.equal(pawn.skillLedger.length, pawn.maxSkillLedger)
    assert.equal(pawn.skillNotices.length <= pawn.maxSkillNotices, true)
    assert.equal(pawn.skillLedger[pawn.skillLedger.length - 1].skill, 'orienteering')
})

test('a paved road pays in quarters and mentions the road', () => {
    const world = fakeWorld({ tick: 10 })
    const pawn = makeWalker(world)
    wearLine(world.trailField, 0, 0, 80, 0, 10)

    for (let i = 0; i < 4; i++) {
        const road = pawn.openRoadTo(80, 0)
        assert.equal(road.ok, true, 'the corridor was worn, so the road is real')
    }

    assert.equal(pawn.roadsOpened, 4)
    const notices = pawn.drainSkillNotices()
    assert.equal(notices.length, 1)
    assert.match(notices[0], /road you paved is worth remembering \(orienteering 1\)/)
    assert.match(pawn.skillWhy('orienteering'), /paved road \+1\.00 x4/)
})

test('trailReport says nothing until there is something to say', () => {
    const pawn = makeWalker(fakeWorld())
    assert.equal(pawn.trailReport(), '', 'a pawn that never used a path has no trail story')

    pawn.trail.followed = 40
    pawn.skills.orienteering = 3.24
    assert.match(pawn.trailReport(), /^40 trodden steps \(orienteering 3\.2\)$/)

    pawn.roadsOpened = 1
    assert.match(pawn.trailReport(), /1 road paved$/)
    pawn.roadsOpened = 2
    assert.match(pawn.trailReport(), /2 roads paved$/)
})

test('UIRenderer: the HUD trail row combines ground and walker', () => {
    const world = fakeWorld()
    const lines = []
    const ui = new UIRenderer(fakeContext(lines), world)
    assert.equal(ui.trailTextFor(), '', 'nobody followed, nothing worn')

    world.trailField.deposit(20, 20, 18, 0, 'pawn')
    assert.match(ui.trailTextFor(), /paths 1 cells/)
    assert.equal(ui.trailTextFor().includes('trodden'), false, 'no pawn, no claim about one')

    const pawn = makeWalker(world)
    follow(pawn, 20)
    ui.setVisionProvider(() => pawn)
    const text = ui.trailTextFor()
    assert.match(text, /paths 1 cells/)
    assert.match(text, /20 trodden steps/, 'the two halves join with a separator')

    ui.renderCapabilityPanel()
    assert.ok(lines.some(line => line === text), 'the row is actually drawn')
})

test('UIRenderer: a trail row alone still earns the panel', () => {
    const world = fakeWorld()
    world.trailField.deposit(24, 24, 30, 0, 'forager')
    const lines = []
    const ui = new UIRenderer(fakeContext(lines), world)
    ui.renderCapabilityPanel()
    assert.equal(lines.length, 1)
    assert.match(lines[0], /paths 1 cells/)
})

test('UIRenderer: an animal being followed still reads the ground', () => {
    const world = fakeWorld()
    world.trailField.deposit(8, 8, 12, 0, 'forager')
    const ui = new UIRenderer(fakeContext(), world)
    ui.setVisionProvider(() => ({ x: 0, y: 0 }))
    const text = ui.trailTextFor()
    assert.match(text, /paths 1 cells/)
    assert.equal(text.includes('trodden'), false, 'no trailReport, no invented pawn history')
})

test('CanvasRenderer: the newest notice reaches the screen and the queue is drained', () => {
    const pawn = makeWalker(fakeWorld())
    pawn.skillNotices.push('older', 'newer')

    const shown = []
    const renderer = Object.create(CanvasRenderer.prototype)
    renderer.camera = { followedEntity: pawn }
    renderer.showNotice = (text, ms) => shown.push({ text, ms })

    assert.equal(renderer.consumeSkillNotices(), true)
    assert.deepEqual(shown.map(n => n.text), ['newer'])
    assert.equal(shown[0].ms > 4000, true, 'a level is worth reading, so it stays a while')
    assert.deepEqual(pawn.skillNotices, [])
    assert.equal(renderer.consumeSkillNotices(), false, 'an empty queue is not a message')
})

test('CanvasRenderer: a followed entity with no notices cannot crash the frame', () => {
    const renderer = Object.create(CanvasRenderer.prototype)
    renderer.camera = { followedEntity: null }
    renderer.showNotice = () => assert.fail('nothing should be shown')
    assert.equal(renderer.consumeSkillNotices(), false)

    renderer.camera = { followedEntity: { x: 0, y: 0 } }
    assert.equal(renderer.consumeSkillNotices(), false)
})
