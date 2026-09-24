import test from 'node:test'
import assert from 'node:assert'
import createTerrainMesh from '../js/rendering/TerrainMesh.js'

// Curved elevation so mesh chords differ from generator values within a cell
function elevation(x, y) {
    return 10 + 0.01 * x * x + 0.02 * y * y
}

function makeRenderer({ withMesh = true } = {}) {
    const renderer = {
        world: { width: 200, height: 100 },
        _terrainSegmentsX: 4,
        _terrainSegmentsY: 2,
        scene: { add() {}, remove() {} },
        _terrainGenerator: {
            getElevation: (x, y) => elevation(x, y),
            getTerrainType: () => 'plains',
            getWaterDepth: () => 0,
            config: { maxElevation: 400, waterLevel: 0.12 }
        }
    }
    Object.assign(renderer, createTerrainMesh(renderer))
    if (withMesh) renderer._buildTerrainMesh()
    return renderer
}

test('_getGroundHeightAt falls back to generator when no mesh exists', () => {
    const renderer = makeRenderer({ withMesh: false })
    assert.strictEqual(renderer._getGroundHeightAt(37, 61), elevation(37, 61))
})

test('_buildTerrainMesh places vertices exactly on generator elevation', () => {
    const renderer = makeRenderer({ withMesh: false })
    renderer._buildTerrainMesh()
    const attr = renderer._ground.geometry.attributes.position
    const vertsPerRow = renderer._terrainSegmentsX + 1
    const idx = 1 * vertsPerRow + 2
    const x = 2 * (renderer.world.width / renderer._terrainSegmentsX)
    const y = 1 * (renderer.world.height / renderer._terrainSegmentsY)
    assert.strictEqual(attr.array[idx * 3], x)
    assert.strictEqual(attr.array[idx * 3 + 1], elevation(x, y))
    assert.strictEqual(attr.array[idx * 3 + 2], y)
})

test('_getGroundHeightAt samples the rendered mesh, not the raw generator', () => {
    const renderer = makeRenderer()
    // Cell center: mesh triangle interpolation must differ from curved generator value
    const x = 25 // cell i=0 (dx=50), u=0.5
    const y = 25 // cell j=0 (dz=50), v=0.5
    const meshH = renderer._sampleTerrainMesh(x, y)
    const genH = elevation(x, y)
    assert.ok(Number.isFinite(meshH))
    assert.notStrictEqual(meshH, genH, 'curved generator should disagree with mesh chord')
    assert.strictEqual(renderer._getGroundHeightAt(x, y), meshH)

    // On a convex surface the chord lies above the curve, which is why
    // generator-sampled entities floated over the rendered mesh (#83)
    assert.ok(meshH > genH)
})

test('_sampleTerrainMesh matches vertex heights at grid corners and is continuous', () => {
    const renderer = makeRenderer()
    const dx = renderer.world.width / renderer._terrainSegmentsX
    const dz = renderer.world.height / renderer._terrainSegmentsY
    for (let j = 0; j <= renderer._terrainSegmentsY; j++) {
        for (let i = 0; i <= renderer._terrainSegmentsX; i++) {
            const x = Math.min(i * dx, renderer.world.width - 1e-6)
            const y = Math.min(j * dz, renderer.world.height - 1e-6)
            const h = renderer._sampleTerrainMesh(x, y)
            assert.ok(Math.abs(h - elevation(i * dx, j * dz)) < 1e-3)
        }
    }
    // Crossing the b-c diagonal must not produce a seam
    const below = renderer._sampleTerrainMesh(24.999, 24.999)
    const above = renderer._sampleTerrainMesh(25.001, 25.001)
    assert.ok(Math.abs(below - above) < 0.01)
})

test('_sampleTerrainMesh returns null outside the mesh bounds', () => {
    const renderer = makeRenderer()
    assert.strictEqual(renderer._sampleTerrainMesh(-1, 10), null)
    assert.strictEqual(renderer._sampleTerrainMesh(10, renderer.world.height + 0.001), null)
    assert.strictEqual(renderer._sampleTerrainMesh(NaN, 10), null)
})

test('_waterSurfaceHeight reflects generator water level', () => {
    const renderer = makeRenderer()
    assert.strictEqual(renderer._waterSurfaceHeight(), 0.12 * 400)
})

test('water entity surface clamps to water level over basins', () => {
    const renderer = makeRenderer()
    const waterElev = renderer._waterSurfaceHeight()
    // A point whose terrain sits below the water surface
    const basinGen = { getElevation: () => waterElev - 5, config: renderer._terrainGenerator.config }
    renderer._terrainGenerator = basinGen
    renderer._ground = null
    const terrainHeight = renderer._getGroundHeightAt(10, 10)
    const surfaceY = Math.max(terrainHeight, renderer._waterSurfaceHeight())
    assert.strictEqual(surfaceY, waterElev)
    // Above water level, the ground itself wins
    renderer._terrainGenerator = { getElevation: () => waterElev + 8, config: basinGen.config }
    const hillHeight = renderer._getGroundHeightAt(10, 10)
    assert.strictEqual(Math.max(hillHeight, renderer._waterSurfaceHeight()), waterElev + 8)
})
