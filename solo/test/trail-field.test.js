import test from 'node:test'
import assert from 'node:assert/strict'
import TrailField, {
    trailFieldFor,
    resetTrailField,
    TRAIL_CELL_SIZE,
    TRAIL_DECAY_HALF_LIFE,
    TRAIL_MAX_INTENSITY,
    TRAIL_FOLLOW_THRESHOLD,
    TRAIL_MAX_TURN
} from '../js/core/TrailField.js'
import MobileEntity from '../js/models/entities/mobile/MobileEntity.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import SmallPredator from '../js/models/entities/mobile/SmallPredator.js'
import SmallForager from '../js/models/entities/mobile/SmallForager.js'

function fakeWorld({ tick = 0 } = {}) {
    return {
        width: 1000,
        height: 1000,
        tick,
        chunkManager: {
            getWaterDepthAt: () => 0,
            getElevationAt: () => 0,
            getChunkAtPosition: () => ({ biome: 'plains' }),
            isPassable: () => true
        }
    }
}

// Deterministic jitter for the emergence test.
function mulberry32(seed) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6D2B79F5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * Walk an entity to a destination, advancing the world clock as it goes.
 * Targets are re-issued because setValidatedTarget clamps to one move range.
 */
function walkTo(entity, world, x, y, maxTicks = 4000) {
    let ticks = 0
    while (ticks < maxTicks) {
        const remaining = Math.hypot(x - entity.x, y - entity.y)
        if (remaining <= entity.distanceThreshold) break
        entity.setValidatedTarget(x, y)
        entity.move()
        world.tick++
        ticks++
    }
    return ticks
}

// ---------------------------------------------------------------- field maths

test('deposit: wear accumulates on the ground underfoot', () => {
    const field = new TrailField()
    field.deposit(10, 10, 4, 0, 'pawn')
    assert.equal(field.intensityAt(10, 10), 4)
    assert.equal(field.cells.size, 1)
    // The far corner of the same cell reads the same wear.
    assert.equal(field.intensityAt(10 + TRAIL_CELL_SIZE - 3, 13), 4)
})

test('deposit: saturated ground stops accepting wear', () => {
    const field = new TrailField()
    const after = field.deposit(5, 5, TRAIL_MAX_INTENSITY * 3, 0)
    assert.equal(after, TRAIL_MAX_INTENSITY)
    assert.equal(field.intensityAt(5, 5), TRAIL_MAX_INTENSITY)
})

test('deposit: nothing is written for junk input', () => {
    const field = new TrailField()
    assert.equal(field.deposit(NaN, 5, 1, 0), 0)
    assert.equal(field.deposit(5, undefined, 1, 0), 0)
    assert.equal(field.deposit(5, 5, 0, 0), 0)
    assert.equal(field.deposit(5, 5, -3, 0), 0)
    assert.equal(field.deposit(5, 5, NaN, 0), 0)
    assert.equal(field.cells.size, 0)
})

test('keys: ground on either side of the origin is distinct', () => {
    const field = new TrailField()
    field.deposit(-4, -4, 2, 0)
    field.deposit(4, 4, 3, 0)
    assert.equal(field.cells.size, 2)
    assert.equal(field.intensityAt(-4, -4), 2)
    assert.equal(field.intensityAt(4, 4), 3)
})

test('decay: wear halves over one half-life and reading does not consume it', () => {
    const field = new TrailField()
    field.deposit(20, 20, 10, 0)
    const half = field.intensityAt(20, 20, TRAIL_DECAY_HALF_LIFE)
    assert.ok(Math.abs(half - 5) < 1e-9, `expected 5, got ${half}`)
    const quarter = field.intensityAt(20, 20, TRAIL_DECAY_HALF_LIFE * 2)
    assert.ok(Math.abs(quarter - 2.5) < 1e-9, `expected 2.5, got ${quarter}`)
    assert.equal(field.intensityAt(20, 20, 0), 10, 'the past is still readable')
})

test('decay: a later deposit folds the cell forward instead of reviving old wear', () => {
    const field = new TrailField()
    field.deposit(30, 30, 8, 0)
    field.deposit(30, 30, 1, TRAIL_DECAY_HALF_LIFE)
    assert.ok(Math.abs(field.intensityAt(30, 30, TRAIL_DECAY_HALF_LIFE) - 5) < 1e-9)
})

test('tracks: the ground remembers who left it', () => {
    const field = new TrailField()
    field.deposit(40, 40, 6, 0, 'pawn')
    field.deposit(40, 40, 2, 0, 'forager')
    assert.equal(field.trackAt(40, 40, 'forager'), 2)
    assert.equal(field.trackAt(40, 40, 'predator'), 0)
    assert.ok(Math.abs(field.trackShare(40, 40, 'forager') - 0.25) < 1e-9)
    assert.deepEqual(field.tracksAt(40, 40).map(t => t.kind), ['pawn', 'forager'])
    assert.equal(field.trackShare(1000, 1000, 'pawn'), 0)
    assert.deepEqual(field.tracksAt(1000, 1000), [])
})

test('followBias: unworn ground is no reason to turn', () => {
    const field = new TrailField()
    const bias = field.followBias(50, 50, 1, 0, { affinity: 1, tick: 0 })
    assert.equal(bias.turn, 0)
    assert.equal(bias.gain, 0)
    assert.equal(bias.dirX, 1)
    assert.equal(bias.dirY, 0)
})

test('followBias: faint scratchings are not yet a path', () => {
    const field = new TrailField()
    for (let i = 0; i < 12; i++) field.deposit(60 + i * 2, 40, TRAIL_FOLLOW_THRESHOLD / 4, 0)
    assert.equal(field.followBias(50, 50, 1, 0, { affinity: 1, tick: 0 }).turn, 0)
})

test('followBias: a walker heads for the worn strip', () => {
    const field = new TrailField()
    // Corridor running east-west "north" (lower y) of a walker facing east.
    for (let i = 0; i < 12; i++) field.deposit(60 + i * 2, 40, 6, 0, 'pawn')
    const bias = field.followBias(50, 50, 1, 0, { affinity: 1, tick: 0 })
    assert.ok(bias.gain > TRAIL_FOLLOW_THRESHOLD, `expected a real gain, got ${bias.gain}`)
    assert.ok(bias.turn < 0, `expected a turn toward the corridor, got ${bias.turn}`)
    assert.ok(Math.abs(Math.hypot(bias.dirX, bias.dirY) - 1) < 1e-9, 'still a unit heading')
})

test('followBias: affinity decides how much of the turn is taken', () => {
    const field = new TrailField()
    for (let i = 0; i < 12; i++) field.deposit(60 + i * 2, 40, 6, 0, 'pawn')
    const expert = field.followBias(50, 50, 1, 0, { affinity: 1, tick: 0 })
    const novice = field.followBias(50, 50, 1, 0, { affinity: 0.25, tick: 0 })
    assert.ok(Math.abs(expert.turn) > Math.abs(novice.turn))
    assert.ok(Math.abs(expert.turn) <= TRAIL_MAX_TURN + 1e-12)
    assert.ok(Math.abs(novice.turn) <= TRAIL_MAX_TURN * 0.25 + 1e-12)
    assert.equal(field.followBias(50, 50, 1, 0, { affinity: 0, tick: 0 }).turn, 0)
})

test('followBias: junk headings are refused rather than thrown on', () => {
    const field = new TrailField()
    for (let i = 0; i < 12; i++) field.deposit(60 + i * 2, 40, 6, 0)
    // A heading of zero length has nowhere to turn from.
    const still = field.followBias(50, 50, 0, 0, { affinity: 1, tick: 0 })
    assert.equal(still.turn, 0)
    assert.equal(still.gain, 0)
    // Garbage components are read as "no idea", never as NaN propagation.
    for (const dir of [[NaN, 1], [1, NaN], [NaN, NaN], [Infinity, Infinity]]) {
        const bias = field.followBias(50, 50, dir[0], dir[1], { affinity: 1, tick: 0 })
        assert.ok(Number.isFinite(bias.dirX) && Number.isFinite(bias.dirY), `${dir} produced NaN`)
        assert.ok(Number.isFinite(bias.turn) && Math.abs(bias.turn) <= TRAIL_MAX_TURN + 1e-12)
    }
})

test('corridorAt: reports the wear a walker is standing in', () => {
    const field = new TrailField()
    for (let i = 0; i < 12; i++) field.deposit(60 + i * 2, 50, 6, 0)
    const here = field.corridorAt(50, 50, { dirX: 1, dirY: 0, tick: 0 })
    assert.equal(here.worn, true)
    assert.ok(here.ahead > TRAIL_FOLLOW_THRESHOLD)
    const empty = field.corridorAt(500, 500, { tick: 0 })
    assert.equal(empty.strength, 0)
    assert.equal(empty.worn, false)
})

test('prune / stats / toJSON: the field stays inspectable and shrinkable', () => {
    const field = new TrailField()
    field.deposit(10, 10, 1, 0)
    field.deposit(20, 20, 8, 0, 'pawn')
    assert.equal(field.prune(0), 0, 'fresh wear is not waste')
    const snapshot = field.toJSON(0)
    assert.equal(snapshot.cells.length, 2)
    assert.equal(snapshot.stats.cells, 2)
    assert.equal(snapshot.stats.peak, 8)
    assert.ok(snapshot.stats.wornCells >= 1)
    assert.equal(field.prune(TRAIL_DECAY_HALF_LIFE * 30), 2)
    assert.equal(field.cells.size, 0)
})

test('trailFieldFor: one shared ground per world, created only when asked', () => {
    const world = fakeWorld({ tick: 120 })
    assert.equal(trailFieldFor(world, { create: false }), null)
    const field = trailFieldFor(world)
    assert.ok(field instanceof TrailField)
    assert.equal(field.tick, 120, 'the field inherits the world clock')
    assert.equal(trailFieldFor(world), field)
    assert.notEqual(resetTrailField(world), field)
    assert.equal(trailFieldFor(null), null)
    assert.equal(trailFieldFor('nope'), null)
})

// ------------------------------------------------------------ entity footfall

test('footfall: walking wears the ground along the route', () => {
    const world = fakeWorld()
    const e = new MobileEntity('walker', 'walker', 50, 50)
    e.world = world
    walkTo(e, world, 200, 50)
    const field = world.trailField
    assert.ok(field, 'the act of walking should create the field')
    assert.ok(field.intensityAt(60, 50) > 0, 'the departure ground is worn')
    assert.ok(field.intensityAt(195, 50) > 0, 'the arrival ground is worn')
    assert.ok(field.deposits > 20)
})

test('footfall: a jump is not a journey', () => {
    const world = fakeWorld()
    const field = trailFieldFor(world)
    const e = new MobileEntity('walker', 'walker', 50, 50)
    e.world = world
    walkTo(e, world, 60, 50)
    const before = field.cells.size
    assert.ok(before > 0, 'a real step wore the ground')
    e.x = 900
    e.y = 900
    e._depositFootfall(50, 50)
    assert.equal(field.cells.size, before, 'teleporting must not scrawl a road')
})

test('footfall: heavier things make deeper marks', () => {
    const light = fakeWorld()
    const heavy = fakeWorld()
    const a = new MobileEntity('a', 'a', 50, 50)
    const b = new MobileEntity('b', 'b', 50, 50)
    b.trailWeight = 3
    a.world = light
    b.world = heavy
    walkTo(a, light, 120, 50)
    walkTo(b, heavy, 120, 50)
    assert.ok(heavy.trailField.intensityAt(115, 50) > light.trailField.intensityAt(115, 50))
})

test('steering: entities that cannot read trails walk exactly as they used to', () => {
    const tempted = fakeWorld()
    const control = fakeWorld()
    // A tempting corridor exists in one world only.
    const field = trailFieldFor(tempted)
    for (let i = 0; i < 30; i++) field.deposit(50 + i * 3, 20, 20, 0, 'pawn')

    const walker = new MobileEntity('walker', 'walker', 50, 50)
    const straight = new MobileEntity('straight', 'straight', 50, 50)
    walker.world = tempted
    straight.world = control
    for (let i = 0; i < 40; i++) {
        tempted.tick++
        control.tick++
        walker.setValidatedTarget(200, 50)
        straight.setValidatedTarget(200, 50)
        walker.move()
        straight.move()
    }
    assert.equal(walker.trailAffinity, 0)
    assert.equal(walker.x, straight.x)
    assert.equal(walker.y, straight.y)
})

test('steering: an entity that can read trails drifts onto them', () => {
    const world = fakeWorld()
    const field = trailFieldFor(world)
    // Close enough to sense: a trail beyond the lookahead is not a trail.
    for (let i = 0; i < 40; i++) field.deposit(50 + i * 3, 34, 20, 0, 'pawn')

    const tracker = new MobileEntity('tracker', 'tracker', 50, 50)
    tracker.world = world
    tracker.trailAffinity = 1
    let followed = 0
    tracker.onTrailFollowed = () => { followed++ }

    const straight = new MobileEntity('straight', 'straight', 50, 50)
    straight.world = fakeWorld()

    for (let i = 0; i < 60; i++) {
        world.tick++
        tracker.setValidatedTarget(200, 50)
        tracker.move()
        straight.setValidatedTarget(200, 50)
        straight.move()
    }
    assert.ok(followed > 0, 'the hook should fire when a trail is taken')
    assert.ok(tracker.y < straight.y, `expected a pull toward the corridor: ${tracker.y} vs ${straight.y}`)
})

test('steering: no field means no steering and no allocation', () => {
    const world = { width: 500, height: 500 }
    const e = new MobileEntity('walker', 'walker', 10, 10)
    e.world = world
    e.trailAffinity = 1
    assert.deepEqual(e._steerAlongTrails(1, 0), { dirX: 1, dirY: 0, gain: 0 })
    assert.equal(world.trailField, undefined)
})

// --------------------------------------------------------------------- pawns

test('pawn: reading trails is a skill, not a gift', () => {
    const pawn = new Pawn('p1', 'Scout', 100, 100)
    assert.equal(pawn.trailKind, 'pawn')
    const novice = pawn.trailAwareness()
    assert.ok(novice > 0 && novice < 1, `novice affinity should be partial, got ${novice}`)
    pawn.skills.orienteering = 20
    assert.equal(pawn.trailAwareness(), 1, 'a mastered orienteer takes the whole turn')
    const cartographer = new Pawn('p2', 'Mapper', 100, 100)
    cartographer.skills.cartography = 20
    assert.equal(cartographer.trailAwareness(), 1)
    assert.ok(new Pawn('p3', 'Clueless', 100, 100).trailAwareness() < cartographer.trailAwareness())
})

test('pawn: walking a path it recognises teaches it things', () => {
    const world = fakeWorld({ tick: 10 })
    const field = trailFieldFor(world)
    // One mixed corridor: deer and folk both wore the same cells.
    for (let i = 0; i < 40; i++) {
        field.deposit(100 + i * 2, 86, 10, 10, 'forager')
        field.deposit(100 + i * 2, 86, 10, 10, 'pawn')
    }
    const pawn = new Pawn('p1', 'Scout', 100, 100)
    pawn.world = world
    const thoughts = []
    pawn.addThought = (text, tag) => thoughts.push({ text, tag })

    walkTo(pawn, world, 175, 95)

    assert.ok(pawn.trail.followed > 0, 'the scout should have used the ground')
    assert.ok(pawn.trail.steps >= pawn.trail.followed)
    assert.ok(pawn.trail.ahead > 0, 'it knows the path is near')
    assert.ok(pawn.getSkill('orienteering') > 0)
    assert.ok(pawn.getSkill('tracking') > 0, 'mixed tracks are what make a tracker')
    assert.equal(thoughts.length, 1, 'remarks are rare')
    assert.match(thoughts[0].text, /been this way before/)
    assert.equal(thoughts[0].tag, 'movement')
})

test('pawn: a bare world cannot stop a walker', () => {
    const world = { width: 200, height: 200 }
    const pawn = new Pawn('p1', 'Scout', 20, 20)
    pawn.world = world
    pawn.setValidatedTarget(80, 20)
    for (let i = 0; i < 30; i++) pawn.move()
    assert.ok(pawn.x > 20)
    assert.ok(pawn.trailAwareness() > 0)
})

// ------------------------------------------------------------------- animals

test('animals: predators hunt corridors harder than prey use them', () => {
    const hunter = new SmallPredator({ id: 's1', species: 'fox' })
    const deer = new SmallForager({ id: 's2', species: 'squirrel' })
    assert.equal(hunter.trailKind, 'predator')
    assert.equal(deer.trailKind, 'forager')
    assert.ok(hunter.trailAffinity > deer.trailAffinity)
    assert.ok(hunter.trailAffinity <= 1)
    assert.ok(deer.trailAffinity > 0, 'even prey benefits from a known route')
})

// ------------------------------------------------------------------- ambush

function animalWorld({ tick = 200 } = {}) {
    const world = fakeWorld({ tick })
    world.entities = []
    world.entitiesMap = new Map()
    world.queryEntitiesInRadius = (x, y, r) => world.entities.filter(e => Math.hypot(e.x - x, e.y - y) <= r)
    return world
}

function preyCorridor(field, tick) {
    for (let i = 0; i < 10; i++) field.deposit(100 + i * 4, 100, 8, tick, 'forager')
}

test('ambush: a beaten prey path is worth waiting on', () => {
    const world = animalWorld()
    preyCorridor(trailFieldFor(world), world.tick)
    const hunter = new SmallPredator({ id: 'fox', species: 'fox' })
    hunter.world = world
    hunter.x = 104
    hunter.y = 100

    assert.ok(hunter.isOnPreyTrail(world), 'deer ground reads as a place to wait')
    hunter.track(world)
    assert.equal(hunter.huntState, 'ambush')

    hunter.update(world.tick, world)
    assert.equal(hunter.targetX, hunter.x, 'it holds the spot instead of wandering')
    assert.equal(hunter.huntState, 'ambush')

    // The wait expires and nothing has come. It moves on, and does not simply
    // sit back down on the same cold path.
    const until = hunter.ambushUntil
    world.tick = until + 1
    hunter.update(world.tick, world)
    assert.equal(hunter.huntState, 'track')
    hunter.track(world)
    assert.equal(hunter.huntState, 'track', 'the same spot is not worth a second wait yet')
})

test('ambush: prey that wanders into the corridor is charged, not surveyed', () => {
    const world = animalWorld()
    preyCorridor(trailFieldFor(world), world.tick)
    const hunter = new SmallPredator({ id: 'fox', species: 'fox' })
    hunter.world = world
    hunter.x = 104
    hunter.y = 100
    hunter.huntState = 'ambush'
    hunter.ambushUntil = world.tick + 40
    const dinner = new SmallForager({ id: 'deer', species: 'deer' })
    dinner.x = 108
    dinner.y = 100
    world.entities.push(dinner)

    hunter.update(world.tick, world)
    assert.equal(hunter.huntState, 'charge')
    assert.equal(hunter.huntTarget, dinner)
})

test('ambush: bare ground is no place to wait', () => {
    const world = animalWorld()
    const hunter = new SmallPredator({ id: 'fox', species: 'fox' })
    hunter.world = world
    hunter.x = 100
    hunter.y = 100
    assert.equal(hunter.isOnPreyTrail(world), false)
    hunter.track(world)
    assert.equal(hunter.huntState, 'track')
    assert.notEqual(hunter.targetX, hunter.x, 'with no trail to read it must still search')
})

// ---------------------------------------------------------------- emergence

test('emergence: repeated trips between two places narrow into one path', () => {
    const world = fakeWorld()
    const field = trailFieldFor(world)
    const rnd = mulberry32(4242)
    const traveller = new MobileEntity('traveller', 'traveller', 60, 60)
    traveller.world = world
    traveller.trailAffinity = 1

    const newCellsPerTrip = []
    for (let trip = 0; trip < 12; trip++) {
        const before = new Set(field.cells.keys())
        // Everyone aims at roughly the same market, but not the same spot.
        const targetX = trip % 2 === 0 ? 320 : 60
        const targetY = 60 + Math.round((rnd() - 0.5) * 80)
        walkTo(traveller, world, targetX, targetY)
        let added = 0
        for (const key of field.cells.keys()) if (!before.has(key)) added++
        newCellsPerTrip.push(added)
    }

    const early = newCellsPerTrip.slice(0, 3).reduce((a, b) => a + b, 0)
    const late = newCellsPerTrip.slice(-3).reduce((a, b) => a + b, 0)
    assert.ok(late < early, `expected the route to narrow: ${early} then ${late} new cells`)
    const worn = field.activeCells(TRAIL_FOLLOW_THRESHOLD)
    assert.ok(worn.length > 0)
    assert.ok(worn[0].intensity > TRAIL_FOLLOW_THRESHOLD * 4, 'the corridor should be well beaten in')
})

test('emergence: an abandoned route grows back over', () => {
    const world = fakeWorld()
    const traveller = new MobileEntity('traveller', 'traveller', 60, 60)
    traveller.world = world
    traveller.trailAffinity = 1
    walkTo(traveller, world, 300, 60)
    assert.ok(world.trailField.stats(world.tick).wornCells > 0)
    world.tick += TRAIL_DECAY_HALF_LIFE * 20
    world.trailField.prune(world.tick)
    assert.equal(world.trailField.stats(world.tick).wornCells, 0, 'unused ground heals')
})
