import * as THREE from 'three'

/**
 * Terrain mesh builder — uses standalone TerrainGenerator for dramatic terrain.
 * Direct mapping: world X → Three.js X, world Y → Three.js Z, elevation → Three.js Y
 */
export default function createTerrainMesh(renderer) {
    return {
        _getGroundHeightAt(worldX, worldY) {
            const gen = renderer._terrainGenerator
            if (!gen) return 0
            return gen.getElevation(worldX, worldY)
        },

        _buildTerrainMesh() {
            const sx = renderer._terrainSegmentsX
            const sy = renderer._terrainSegmentsY
            const w = renderer.world.width
            const h = renderer.world.height
            const vertsPerRow = sx + 1
            const vertsPerCol = sy + 1
            const totalVerts = vertsPerRow * vertsPerCol

            const positions = new Float32Array(totalVerts * 3)
            const colors = new Float32Array(totalVerts * 3)
            const indices = []

            const dx = w / sx
            const dz = h / sy

            for (let j = 0; j < vertsPerCol; j++) {
                for (let i = 0; i < vertsPerRow; i++) {
                    const idx = j * vertsPerRow + i
                    const worldX = i * dx
                    const worldY = j * dz
                    const height = renderer._getGroundHeightAt(worldX, worldY)

                    positions[idx * 3] = worldX
                    positions[idx * 3 + 1] = height
                    positions[idx * 3 + 2] = worldY

                    const color = renderer._getTerrainColor(worldX, worldY, height)
                    colors[idx * 3] = color.r
                    colors[idx * 3 + 1] = color.g
                    colors[idx * 3 + 2] = color.b

                    if (i < sx && j < sy) {
                        const a = idx
                        const b = idx + 1
                        const c = idx + vertsPerRow
                        const d = idx + vertsPerRow + 1
                        indices.push(a, c, b)
                        indices.push(b, c, d)
                    }
                }
            }

            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
            geometry.setIndex(indices)
            geometry.computeVertexNormals()

            if (renderer._ground) {
                renderer._ground.geometry.dispose()
                renderer.scene.remove(renderer._ground)
            }

            renderer._ground = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({ color: '#355f2f', roughness: 1, metalness: 0, vertexColors: true })
            )
            renderer.scene.add(renderer._ground)
        },

        _getTerrainColor(worldX, worldY, height) {
            const gen = renderer._terrainGenerator
            const tint = new THREE.Color()

            if (gen) {
                const terrainType = gen.getTerrainType(worldX, worldY)
                const waterDepth = gen.getWaterDepth(worldX, worldY)
                const normalizedElev = height / (gen.config.maxElevation || 80)

                // Water coloring
                if (terrainType === 'deep_water') {
                    tint.set('#1A4A5E')
                    tint.lerp(new THREE.Color('#2E738A'), waterDepth * 0.5)
                    return tint
                } else if (terrainType === 'shallow_water') {
                    tint.set('#2E738A')
                    tint.lerp(new THREE.Color('#3A6A5E'), waterDepth * 0.3)
                    return tint
                }

                // Land coloring based on terrain type
                switch (terrainType) {
                    case 'beach':
                        tint.set('#C2B280')
                        break
                    case 'plains':
                        tint.set('#5A7A3E')
                        tint.lerp(new THREE.Color('#6B8B4E'), normalizedElev * 0.3)
                        break
                    case 'forest':
                        tint.set('#3A5F0B')
                        tint.lerp(new THREE.Color('#4A7A2E'), normalizedElev * 0.2)
                        break
                    case 'hills':
                        tint.set('#4A6B2E')
                        tint.lerp(new THREE.Color('#6B7B4E'), normalizedElev * 0.3)
                        break
                    case 'mountains':
                        tint.set('#6B6B5E')
                        tint.lerp(new THREE.Color('#8B8B7E'), normalizedElev * 0.2)
                        break
                    case 'peak':
                        tint.set('#8B8B7E')
                        // Snow caps on very high peaks
                        if (normalizedElev > 0.85) {
                            tint.lerp(new THREE.Color('#E8E8E8'), (normalizedElev - 0.85) / 0.15)
                        }
                        break
                    default:
                        tint.set('#5A7A3E')
                }

                // Elevation-based shading
                const shade = 0.85 + normalizedElev * 0.3
                tint.multiplyScalar(shade)
            } else {
                // Fallback: simple green
                tint.set('#5A7A3E')
            }

            return tint
        }
    }
}
