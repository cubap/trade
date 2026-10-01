import test from 'node:test'
import assert from 'node:assert/strict'

// The civic module has always worked on a pawn: the ledger, the job board and
// the curriculum are pawn fields, and every function takes the pawn first. What
// was missing was the pawn itself. PawnGoals asks `this.pawn.canonizeEncampment
// (cache)`, `this.pawn.postJob(...)`, `this.pawn.addCurriculumLesson(...)` - and
// until now every one of those civic goals threw a TypeError the moment it
// reached the line, so no settlement was ever canonized in play and no road was
// ever opened by the town that grew around the cache. This is the seam between
// the module and the actor, tested in the order the handlers use it.

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import {
    trailFieldFor,
    TRAIL_CELL_SIZE,
    TRAIL_MAX_INTENSITY
} from '../js/core/TrailField.js'

function makeWorld() {
    const world = new World(2000, 2000)
    return { world, field: trailFieldFor(world) }
}

function makeTowner(world, name, x, y) {
    const pawn = new Pawn(name, name, x, y)
    world.addEntity(pawn)
    return pawn
}

/** A camp the pawn has decided to stay at. */
function campAt(pawn, x, y, members = []) {
    pawn.encampmentLandmark = {
        x,
        y,
        type: 'encampment',
        name: 'Ash Hollow',
        canonized: false,
        resourceRichness: 0,
        groupMembers: new Set([pawn.id, ...members])
    }
    return pawn.encampmentLandmark
}

function wearPath(field, ax, ay, bx, by, tick = 0) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (TRAIL_CELL_SIZE * 0.5)))
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        field.deposit(ax + (bx - ax) * t, ay + (by - ay) * t, TRAIL_MAX_INTENSITY * 0.5, tick, 'pawn')
    }
    return field
}

// ---------------------------------------------------------------- the seam

test('the civic goals have something to call', () => {
    const handlers = [
        'checkProtoSettlementTrigger', 'getResourceRichness', 'canonizeEncampment',
        'openSettlementRoads', 'recordCivicContribution', 'updateCivicScore',
        'getAverageGroupTrust', 'postJob', 'acceptJob', 'completeJob',
        'addCurriculumLesson', 'completeCurriculumLesson', 'gainSkill'
    ]
    for (const name of handlers) {
        assert.equal(typeof Pawn.prototype[name], 'function', `pawn.${name}() must exist`)
    }
})

// ------------------------------------------------------------ canonizing a camp

test('a town built on worn ground gets its road, and the credit for it', () => {
    const { world, field } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    campAt(ada, 200, 0)
    wearPath(field, 0, 0, 200, 0)

    // Exactly the sequence the build_cache goal handler runs.
    const cache = ada.createResourceCache({ x: 200, y: 0, purpose: 'communal', name: 'Settlement Cache' })
    assert.ok(cache, 'the cache is what makes a camp a town')

    const roads = ada.canonizeEncampment(cache)
    assert.equal(roads, 1, 'the path the townsfolk already walk becomes a road')
    assert.equal(ada.encampmentLandmark.canonized, true)
    assert.equal(ada.isSettlementDiscoverable, true)
    assert.deepEqual(
        ada.civicLedger.map(c => [c.type, c.amount]),
        [['build', 1]],
        'opening the road is counted as the build it was'
    )

    const roads2 = field.kindsInUse().find(k => k.kind === 'road')
    assert.ok(roads2 && roads2.cells > 0, 'the road is in the ground, not only in the ledger')
})

test('a town of wanderers gets no roads', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    campAt(ada, 200, 0)

    const cache = ada.createResourceCache({ x: 200, y: 0, purpose: 'communal' })
    assert.equal(ada.canonizeEncampment(cache), 0, 'virgin ground is not paved by a proclamation')
    assert.equal(ada.encampmentLandmark.canonized, true, 'the town is still a town')
    assert.equal(ada.civicLedger.length, 0, 'and it got no road it did not earn')
})

test('canonizing without a camp does nothing at all', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    assert.equal(ada.canonizeEncampment(null), undefined)
    assert.equal(ada.isSettlementDiscoverable, false)
})

// ------------------------------------------------------------------ jobs

test('a settlement posts, takes and finishes a job', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    const bob = makeTowner(world, 'Bob', 10, 0)
    campAt(ada, 0, 0, [bob.id])

    const job = ada.postJob('gather', 2, 200)
    assert.ok(job?.taskId, 'the job is on the board with an id')
    assert.equal(job.deadline, 200, 'deadline measured in ticks from now')
    assert.equal(job.postedBy, ada.id)

    assert.equal(ada.completeJob(job.taskId), false, 'nobody has taken it yet')
    // The board lives on the pawn rather than on the camp, so a neighbour cannot
    // see the job at all. Honest today, filed as the thing it should become.
    assert.equal(bob.acceptJob(job.taskId), null, 'Bob has his own empty board')

    assert.equal(ada.acceptJob(job.taskId)?.assignedTo, ada.id)
    ada.recordCivicContribution('build', 1)

    const before = ada.civicLedger.length
    assert.equal(ada.completeJob(job.taskId), true)
    assert.deepEqual(
        ada.civicLedger.slice(before).map(c => [c.type, c.amount]),
        [['gather', 2], ['tax', 0.2]],
        'the work is counted, and the town takes its tithe'
    )
    assert.equal(ada.completeJob(job.taskId), false, 'a finished job stays finished')
})

test('a lone wanderer has nowhere to post a job', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    assert.equal(ada.postJob('gather', 1, 100), null)
})

// ------------------------------------------------------------ curriculum

test('a lesson taught raises the student and closes the book', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    const bob = makeTowner(world, 'Bob', 5, 0)
    campAt(ada, 0, 0, [bob.id])

    const lesson = ada.addCurriculumLesson('knapping', null, 1)
    assert.equal(lesson.skill, 'knapping')
    assert.equal(ada.curriculum.length, 1)

    bob.gainSkill('knapping', 1)
    assert.equal(bob.getSkill('knapping'), 1, 'the student learned it whether or not the town did')

    assert.equal(ada.completeCurriculumLesson(lesson.lessonId), true)
    assert.equal(ada.completeCurriculumLesson(lesson.lessonId), false)
})

test('skill gained out of nothing is skill had', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    ada.gainSkill('bartering', 0.1)
    assert.equal(ada.getSkill('bartering'), 0.1, 'a market pays fractions of a point, not a crash')
})

// ---------------------------------------------------------------- reading the town

test('a pawn can describe the place it lives', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    const bob = makeTowner(world, 'Bob', 20, 0)
    const landmark = campAt(ada, 0, 0, [bob.id])

    world.addEntity({ id: 'hut', x: 4, y: 4, subtype: 'structure', tags: new Set(['structure']) })
    landmark.resourceRichness = 1

    assert.equal(typeof ada.getResourceRichness(50), 'number', 'richness is a 0-1 score')
    assert.ok(ada.getResourceRichness(50) >= 0)
    assert.equal(ada.getAverageGroupTrust(), 0, 'one recorded trust is all a brand new town has')

    ada.updateCivicScore()
    assert.ok(Number.isFinite(ada.civicScore), 'the score is a number, not NaN')
    assert.ok(ada.civicScore > 0, 'a town with a hut in it scores something')
})

test('a pawn with no camp has no civic score to update', () => {
    const { world } = makeWorld()
    const ada = makeTowner(world, 'Ada', 0, 0)
    assert.equal(ada.updateCivicScore(), undefined)
    assert.equal(ada.civicScore, 0)
})
