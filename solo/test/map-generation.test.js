import test from 'node:test'
import assert from 'node:assert'
import ChunkManager from '../js/core/ChunkManager.js'

test('ChunkManager map generation uses only livable biome palette', () => {
    const manager = new ChunkManager(7000, 7000, 420, { seed: 1337 })
    const allowed = new Set(['plains', 'forest', 'hills'])

    for (let x = 0; x < manager.chunksX; x++) {
        for (let y = 0; y < manager.chunksY; y++) {
            const chunk = manager.getChunk(x, y)
            assert.ok(allowed.has(chunk.biome), `Unexpected biome ${chunk.biome} at ${x},${y}`)
            assert.ok(chunk.settlementSuitability >= 0 && chunk.settlementSuitability <= 1)
        }
    }
})

test('ChunkManager settlement basins are spatially separated', () => {
    const manager = new ChunkManager(7000, 7000, 420, { seed: 2024 })
    const basins = manager.getSettlementBasins(10)

    assert.ok(basins.length > 0, 'Expected at least one settlement basin')

    for (let i = 0; i < basins.length; i++) {
        for (let j = i + 1; j < basins.length; j++) {
            const dx = basins[i].chunkX - basins[j].chunkX
            const dy = basins[i].chunkY - basins[j].chunkY
            const distance = Math.sqrt(dx * dx + dy * dy)
            assert.ok(distance >= 5, `Settlement basins too close: ${distance}`)
        }
    }
})
