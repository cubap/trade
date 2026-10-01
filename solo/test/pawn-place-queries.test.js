import test from 'node:test'
import assert from 'node:assert/strict'

// PawnCivic and PawnMercantile have long asked pawns what is around them and
// what they call home, and Pawn answered neither: the methods simply were not
// there, so any settlement that got canonized threw. #95 walks straight into
// that (naming a route needs both ends), so the two queries now exist, and a
// place on the map's zero axes counts as a place.

import World from '../js/core/World.js'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import { getHomeLandmark, rememberLandmark } from '../js/models/entities/mobile/PawnMemory.js'

function worldWith(...pawns) {
    const world = new World(2000, 2000)
    for (const pawn of pawns) world.addEntity(pawn)
    return world
}

test('a pawn knows what stands around it', () => {
    const near = new Pawn('near', 'Near', 10, 10)
    const far = new Pawn('far', 'Far', 900, 900)
    const tree = { id: 'tree1', x: 14, y: 12, subtype: 'tree' }
    worldWith(near, far, tree)

    const around = near.getNearbyEntities(20)
    assert.deepEqual(around.map(e => e.id), ['tree1'], 'only the tree is within twenty units')
    assert.ok(!around.some(e => e.id === 'near'), 'a pawn is not scenery to itself')
    assert.equal(far.getNearbyEntities(20).length, 0)
})

test('a pawn with no world reports an empty neighbourhood', () => {
    const alone = new Pawn('alone', 'Alone', 0, 0)
    assert.deepEqual(alone.getNearbyEntities(100), [])
})

test('home is the shelter a pawn remembers, not the ground it stands on', () => {
    const pawn = new Pawn('ada', 'Ada', 0, 0)
    worldWith(pawn)
    assert.equal(pawn.getHomeLandmark(), null)

    pawn.rememberLandmark({ x: 40, y: 60, type: 'campfire', significance: 5 })
    assert.equal(pawn.getHomeLandmark(), null, 'a campfire is not a shelter')

    pawn.rememberLandmark({ x: 40, y: 60, type: 'shelter', significance: 2, name: 'Hollow' })
    pawn.rememberLandmark({ x: 80, y: 90, type: 'shelter', significance: 4, name: 'Cave' })
    assert.equal(pawn.getHomeLandmark().name, 'Cave', 'the most significant shelter wins')
    assert.equal(getHomeLandmark(pawn), pawn.getHomeLandmark(), 'the method is the module')
})

test('a place on the edge of the map is still a place', () => {
    const pawn = new Pawn('ada', 'Ada', 0, 0)
    worldWith(pawn)

    rememberLandmark(pawn, { x: 0, y: 0, type: 'shelter', significance: 5, name: 'Doorstep' })
    assert.equal(pawn.getHomeLandmark()?.name, 'Doorstep',
        'x = 0 used to be thrown away as if it were no coordinate at all')

    rememberLandmark(pawn, { x: NaN, y: 5, type: 'shelter', significance: 5 })
    rememberLandmark(pawn, { x: 5, type: 'shelter', significance: 5 })
    assert.equal(pawn.memoryMap.length, 1, 'junk coordinates are still refused')
})
