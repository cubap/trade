import test from 'node:test'
import assert from 'node:assert/strict'
import {
    getTerrainMoveContext,
    terrainSpeedFactor,
    clampTargetToPassable,
    DEEP_WATER_DEPTH,
    SHALLOW_WATER_FACTOR,
    STEEP_SLOPE_FACTOR,
    DENSE_FOREST_FACTOR
} from '../js/models/entities/mobile/MovementTerrain.js'
import MobileEntity from '../js/models/entities/mobile/MobileEntity.js'

function fakeWorld({ water = 0, elevations = {}, biome = 'plains', passable = null } = {}) {
    return {
        width: 1000,
        height: 1000,
        tick: 0,
        chunkManager: {
            getWaterDepthAt: () => water,
            getElevationAt: (x, y) => elevations[`${Math.round(x)},${Math.round(y)}`] ?? 0,
            getChunkAtPosition: () => ({ biome }),
            isPassable: passable ?? (() => true)
        }
    }
}

test('terrainSpeedFactor: deep water is impassable', () => {
    const result = terrainSpeedFactor({ waterDepth: DEEP_WATER_DEPTH + 0.1, slope: 0, biome: 'plains' })
    assert.equal(result.factor, 0)
    assert.equal(result.reason, 'deep_water')
})

test('terrainSpeedFactor: steep slope slows the hardest', () => {
    const result = terrainSpeedFactor({ waterDepth: 0, slope: 1.5, biome: 'plains' })
    assert.equal(result.factor, STEEP_SLOPE_FACTOR)
    assert.equal(result.reason, 'steep_slope')
})

test('terrainSpeedFactor: shallow water wading is slower than open ground', () => {
    const result = terrainSpeedFactor({ waterDepth: 0.2, slope: 0, biome: 'plains' })
    assert.equal(result.factor, SHALLOW_WATER_FACTOR)
    assert.equal(result.reason, 'shallow_water')
})

test('terrainSpeedFactor: forest undergrowth slows movement', () => {
    const result = terrainSpeedFactor({ waterDepth: 0, slope: 0, biome: 'forest' })
    assert.equal(result.factor, DENSE_FOREST_FACTOR)
    assert.equal(result.reason, 'dense_forest')
})

test('terrainSpeedFactor: open plains are unimpeded', () => {
    const result = terrainSpeedFactor({ waterDepth: 0, slope: 0, biome: 'plains' })
    assert.equal(result.factor, 1)
    assert.equal(result.reason, null)
})

test('getTerrainMoveContext: samples slope from elevation neighbors', () => {
    // 8 elevation units over the 4-unit sample offset = slope 2 (steep)
    const world = fakeWorld({ elevations: { '100,100': 0, '104,100': 8 } })
    const ctx = getTerrainMoveContext(world, 100, 100)
    assert.equal(ctx.slope, 2)
    assert.equal(ctx.biome, 'plains')
})

test('getTerrainMoveContext: returns null without a chunk manager', () => {
    assert.equal(getTerrainMoveContext({ width: 10, height: 10 }, 1, 1), null)
    assert.deepEqual(terrainSpeedFactor(null), { factor: 1, reason: null })
})

test('clampTargetToPassable: stops at the edge of impassable water', () => {
    // Impassable beyond x >= 20
    const world = fakeWorld({ passable: (x) => x < 20 })
    const result = clampTargetToPassable(world, 0, 10, 40, 10, 2)
    assert.equal(result.clamped, true)
    assert.ok(result.x < 20, `expected clamped x < 20, got ${result.x}`)
    assert.ok(result.x >= 18, `expected to stop near the edge, got ${result.x}`)
    assert.equal(result.y, 10)
})

test('clampTargetToPassable: leaves passable targets alone', () => {
    const world = fakeWorld()
    const result = clampTargetToPassable(world, 0, 0, 10, 0, 2)
    assert.equal(result.clamped, false)
    assert.equal(result.x, 10)
})

test('MobileEntity: deep water blocks movement entirely', () => {
    const world = fakeWorld({ water: 1 })
    const e = new MobileEntity('walker', 'walker', 10, 10)
    e.world = world
    e.setValidatedTarget(15, 10)
    e.move()
    assert.equal(e.x, 10)
    assert.equal(e._movementImpediment.reason, 'deep_water')
})

test('MobileEntity: forest slows each step', () => {
    const plainWorld = fakeWorld()
    const forestWorld = fakeWorld({ biome: 'forest' })
    const plain = new MobileEntity('plain', 'plain', 10, 10)
    const forest = new MobileEntity('forest', 'forest', 10, 10)
    plain.world = plainWorld
    forest.world = forestWorld
    plain.setValidatedTarget(20, 10)
    forest.setValidatedTarget(20, 10)
    plain.move()
    forest.move()
    const plainStep = plain.x - 10
    const forestStep = forest.x - 10
    assert.ok(forestStep < plainStep, `forest step ${forestStep} should be shorter than plain step ${plainStep}`)
    assert.ok(Math.abs(forestStep - plainStep * DENSE_FOREST_FACTOR) < 1e-9)
})

test('MobileEntity: targets across impassable terrain are clamped to the edge', () => {
    const world = fakeWorld({ passable: (x) => x < 20 })
    const e = new MobileEntity('walker', 'walker', 10, 10)
    e.world = world
    e.setValidatedTarget(50, 10)
    assert.ok(e.targetX < 20)
    assert.equal(e._movementImpediment.reason, 'blocked_path')
})

test('MobileEntity: impediment thoughts are throttled per reason', () => {
    const world = fakeWorld({ biome: 'forest' })
    const e = new MobileEntity('walker', 'walker', 10, 10)
    e.world = world
    const thoughts = []
    e.addThought = (text, tag) => thoughts.push({ text, tag })
    e.setValidatedTarget(80, 10)
    for (let i = 0; i < 50; i++) {
        e.setValidatedTarget(80, 10)
        e.move()
    }
    assert.equal(thoughts.length, 1, 'same reason should notify once')
    assert.equal(thoughts[0].tag, 'movement')
})

test('MobileEntity: worlds without terrain data move exactly as before', () => {
    const world = { width: 1000, height: 1000, tick: 0 }
    const e = new MobileEntity('walker', 'walker', 10, 10)
    e.world = world
    e.setValidatedTarget(15, 10)
    e.move()
    assert.ok(e.x > 10)
    assert.equal(e._movementImpediment, undefined)
})
