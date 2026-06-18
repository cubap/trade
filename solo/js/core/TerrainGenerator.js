// Terrain generator with global height map controlling local detail amplitude.
// A very low-frequency "blur" layer sets the base elevation across the world.
// Detail noise (ridges, hills) amplitude scales with that base height:
// - High base (200m): peaks jitter ±125m (125-350m range)
// - Mid base (100m): only ±50m variation
// - Low base (5m): tiny undulations, no real hills

/**
 * Simple hash-based noise (no external dependency)
 */
function hash(x, y, seed) {
    let n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.0001) * 43758.5453
    return n - Math.floor(n)
}

function smoothNoise(x, y, seed) {
    const intX = Math.floor(x)
    const intY = Math.floor(y)
    const fracX = x - intX
    const fracY = y - intY

    // Smoothstep
    const ux = fracX * fracX * (3 - 2 * fracX)
    const uy = fracY * fracY * (3 - 2 * fracY)

    const n00 = hash(intX, intY, seed)
    const n10 = hash(intX + 1, intY, seed)
    const n01 = hash(intX, intY + 1, seed)
    const n11 = hash(intX + 1, intY + 1, seed)

    const top = n00 + (n10 - n00) * ux
    const bottom = n01 + (n11 - n01) * ux
    return top + (bottom - top) * uy
}

function fbm(x, y, octaves, seed, lacunarity = 2, gain = 0.5) {
    let total = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0

    for (let i = 0; i < octaves; i++) {
        total += smoothNoise(x * frequency, y * frequency, seed + i * 100) * amplitude
        maxValue += amplitude
        amplitude *= gain
        frequency *= lacunarity
    }

    return total / maxValue
}

/**
 * Ridged noise — creates sharp mountain ridges by inverting and sharpening FBM.
 */
function ridgedNoise(x, y, octaves, seed, ridgeSharpness = 2) {
    let total = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0

    for (let i = 0; i < octaves; i++) {
        const n = smoothNoise(x * frequency, y * frequency, seed + i * 200)
        const ridge = 1 - Math.abs(n * 2 - 1)
        const sharpened = Math.pow(ridge, ridgeSharpness)
        total += sharpened * amplitude
        maxValue += amplitude
        amplitude *= 0.5
        frequency *= 2
    }

    return total / maxValue
}

/**
 * Create a terrain generator with global height-controlled detail amplitude.
 *
 * Design philosophy:
 * - A very low-frequency global height map sets the base elevation (the "blur")
 * - Detail noise (ridges, hills) amplitude scales with base height
 * - High base = dramatic peaks, low base = gentle undulations
 * - Rivers are carved from peaks downhill
 * - Water is added after the fact
 *
 * @param {Object} options
 */
export default function createTerrainGenerator(options = {}) {
    const {
        seed = 42,
        worldWidth = 2000,
        worldHeight = 2000,
        maxElevation = 400,
        waterLevel = 0.07,

        // Global height map ("blur" layer) - very low frequency
        globalScale = 1000, // Very large scale = only 1-2 features across the world
        globalOctaves = 2, // Just 2 octaves = extremely smooth
        globalMaxHeight = 200, // Peak of the global height map
        globalMinHeight = 0, // Lowest point (no below-sea-level)

        // Detail noise
        detailScale = 185, // Medium scale for hills and ridges
        detailOctaves = 6,
        ridgeSharpness = 2.5,
        ridgeStrength = 0.9,

        // Amplitude scaling - how detail varies with global height
        amplitudeExponent = 1, // Linear scaling (0.5-1.5)
        maxDetailAmplitude = 150, // Max variation at peak global height
        minDetailAmplitude = 2, // Minimum variation at lowest points

        // River carving
        riverCarvingDepth = 15, // Base carving depth
        riverBaseWidth = 3, // Width of a first-order stream (meters)
        riverWidthPerTributary = 4, // Extra width per tributary merged
        riverCarvePerTributary = 3, // Extra carving depth per tributary

        // Global grade for water flow
        globalGrade = 0.08
    } = options

    // River paths — each point has {x, y, elev, tributaries}
    let rivers = []

    // Lake drainage channels — terrain modifications carved by rivers escaping lakes
    // Each entry: {x, y, depth} — subtract this from elevation at that point
    let lakeChannels = []

    /**
     * Get the global base height at a world position.
     * This is the "blur" layer — very low frequency, smooth variation.
     */
    function getGlobalHeight(wx, wy) {
        const freq = 1 / globalScale
        const n = fbm(wx * freq, wy * freq, globalOctaves, seed)

        // Map noise [0,1] to [globalMinHeight, globalMaxHeight]
        return globalMinHeight + n * (globalMaxHeight - globalMinHeight)
    }

    /**
     * Get the detail noise at a world position (normalized 0-1).
     */
    function getDetailNoise(wx, wy) {
        // Ridged noise for sharp peaks
        const ridgeFreq = 1 / detailScale
        const ridge = ridgedNoise(wx * ridgeFreq, wy * ridgeFreq, detailOctaves, seed + 1, ridgeSharpness)

        // FBM for rolling hills
        const hillFreq = 1 / (detailScale * 1.5)
        const hills = fbm(wx * hillFreq, wy * hillFreq, 4, seed + 2)

        // Fine detail
        const detailFreq = 1 / (detailScale * 0.3)
        const fine = fbm(wx * detailFreq, wy * detailFreq, 3, seed + 3)

        // Combine
        let detail = 0
        detail += ridge * ridgeStrength * 0.6
        detail += hills * 0.3
        detail += fine * 0.1

        // Normalize to [0, 1]
        return Math.max(0, Math.min(1, detail))
    }

    /**
     * Get the detail amplitude based on global height.
     * Higher global height = more variation allowed.
     */
    function getDetailAmplitude(globalHeight) {
        // Normalize global height to [0, 1]
        const normalized = (globalHeight - globalMinHeight) / (globalMaxHeight - globalMinHeight)

        // Power curve: higher = more amplitude
        const scaled = Math.pow(normalized, amplitudeExponent)

        // Interpolate between min and max amplitude
        return minDetailAmplitude + scaled * (maxDetailAmplitude - minDetailAmplitude)
    }

    /**
     * Get elevation at a world position (in meters).
     */
    function getElevation(wx, wy) {
        // Get global base height
        const globalHeight = getGlobalHeight(wx, wy)

        // Get detail noise and amplitude
        const detail = getDetailNoise(wx, wy)
        const amplitude = getDetailAmplitude(globalHeight)

        // Center detail around 0.5 so it adds/subtracts from base
        const detailDeviation = (detail - 0.5) * 2 // [-1, 1]

        // Apply detail with amplitude scaling
        let elevation = globalHeight + detailDeviation * amplitude

        // River carving — each point knows its tributary count
        if (rivers.length > 0) {
            let minDist = Infinity
            let maxTributaries = 0
            for (const river of rivers) {
                for (const point of river) {
                    const dx = wx - point.x
                    const dy = wy - point.y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < minDist) {
                        minDist = dist
                        maxTributaries = Math.max(maxTributaries, point.tributaries || 1)
                    }
                }
            }
            // Carving width and depth scale with tributary count
            const carveWidth = riverBaseWidth + maxTributaries * riverWidthPerTributary
            const carveDepth = riverCarvingDepth + maxTributaries * riverCarvePerTributary
            if (minDist < carveWidth) {
                const carveFactor = 1 - (minDist / carveWidth)
                elevation -= carveFactor * carveDepth
            }
        }

        // Lake channel carving
        if (lakeChannels.length > 0) {
            for (const channel of lakeChannels) {
                const dx = wx - channel.x
                const dy = wy - channel.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < channel.width) {
                    const factor = 1 - (dist / channel.width)
                    elevation -= factor * channel.depth
                }
            }
        }

        // Ensure water level has some low areas
        const waterElevation = waterLevel * maxElevation
        if (elevation < waterElevation * 0.3) {
            elevation = waterElevation * 0.2 + elevation * 0.5
        }

        return elevation
    }

    /**
     * Get water depth at a world position.
     */
    function getWaterDepth(wx, wy) {
        const elevation = getElevation(wx, wy)
        const waterElevation = waterLevel * maxElevation

        if (elevation < waterElevation) {
            const depth = waterElevation - elevation
            return Math.min(depth / maxElevation, 1)
        }

        // Check for lakes (depressions that could hold water)
        const lakeNoise = fbm(wx / 100, wy / 100, 3, seed + 10)
        if (lakeNoise > 0.7 && elevation < waterElevation + 5) {
            return 0.1 + (lakeNoise - 0.7) * 0.3
        }

        return 0
    }

    /**
     * Get terrain type at a world position.
     */
    function getTerrainType(wx, wy) {
        const elevation = getElevation(wx, wy)
        const waterDepth = getWaterDepth(wx, wy)
        const globalHeight = getGlobalHeight(wx, wy)
        const normalizedElev = elevation / maxElevation

        if (waterDepth > 0.4) return 'deep_water'
        if (waterDepth > 0.1) return 'shallow_water'
        if (normalizedElev < 0.15) return 'beach'

        // Use global height to determine terrain character
        const heightRatio = (globalHeight - globalMinHeight) / (globalMaxHeight - globalMinHeight)

        if (heightRatio > 0.7) {
            // High global height = mountains
            if (normalizedElev > 0.7) return 'peak'
            if (normalizedElev > 0.5) return 'mountains'
            return 'hills'
        } else if (heightRatio > 0.4) {
            // Mid global height = hills/foothills
            if (normalizedElev > 0.5) return 'hills'
            if (normalizedElev > 0.35) return 'foothills'
            return 'forest'
        } else {
            // Low global height = plains
            if (normalizedElev < 0.3) return 'plains'
            return 'forest'
        }
    }

    /**
     * Generate rivers by picking sources one at a time from the highest regions.
     * After each river is simulated, check whether it joins an existing channel.
     * If it does, increment the existing river's tributary count and skip adding
     * a new independent river.
     *
     * Stop when we have enough good rivers (minRivers) AND the total path length
     * exceeds a threshold (minTotalLength), or we've exhausted candidates.
     *
     * Each river point tracks its tributary count so carving and rendering
     * can scale with river size.
     */
    function generateRivers(options = {}) {
        const {
            candidateSources = 80, // How many high points to sample
            minPathLength = 10, // Minimum steps to survive pruning
            minElevationDrop = 15, // Must drop this many meters to count
            maxLakeElevation = 40, // If stuck above this, it's a bad lake-out
            mergeProximity = 25, // Distance to count as joining an existing channel (tight — only real merges)
            sampleStep = 30, // Grid step for finding sources
            edgeMargin = 100, // Keep sources away from world edges
            minRivers = 5, // Stop once we have this many good rivers
            minTotalLength = 300, // ...and total points across all rivers
            maxRivers = 15 // Hard cap, don't keep searching forever
        } = options

        rivers = []

        // Sample elevation grid to find high-elevation candidates (stay away from edges)
        const candidates = []
        for (let x = edgeMargin; x < worldWidth - edgeMargin; x += sampleStep) {
            for (let y = edgeMargin; y < worldHeight - edgeMargin; y += sampleStep) {
                const elev = getElevation(x, y)
                const globalH = getGlobalHeight(x, y)
                // Only consider points on significant elevations
                if (globalH > 60) {
                    candidates.push({ x, y, elev, globalH })
                }
            }
        }

        console.log(`[Rivers] Candidates: ${candidates.length}`)

        // Sort by global height descending (highest regions first)
        candidates.sort((a, b) => b.globalH - a.globalH)

        // Pick random sources from the top candidates
        const sources = []
        const topCandidates = candidates.slice(0, Math.min(candidateSources, candidates.length))
        while (sources.length < maxRivers * 3 && sources.length < topCandidates.length) {
            const idx = Math.floor(Math.random() * topCandidates.length)
            sources.push(topCandidates[idx])
            topCandidates.splice(idx, 1)
        }

        // Helper: simulate a single river path from a source point
        const edgeBuffer = 120 // Rivers stop before reaching the world edge (coastline)
        const simulatePath = (src) => {
            const path = [{ x: src.x, y: src.y, elev: src.elev, tributaries: 1 }]
            let cx = src.x
            let cy = src.y
            const stepSize = 15
            const maxSteps = 500
            let lakeAttempts = 0

            for (let s = 0; s < maxSteps; s++) {
                // Stop if we reach the edge buffer (coastline)
                const edgeDist = Math.min(cx, cy, worldWidth - cx, worldHeight - cy)
                if (edgeDist < edgeBuffer) break

                // Use global height for descent direction (smooth, no local minima)
                const currentGlobal = getGlobalHeight(cx, cy)

                // Find steepest descent in global height, avoid edge buffer
                let bestGlobal = currentGlobal
                let bestX = cx
                let bestY = cy
                let bestDrop = 0
                let bestDx = 0
                let bestDy = 0

                for (let dx = -stepSize; dx <= stepSize; dx += stepSize) {
                    for (let dy = -stepSize; dy <= stepSize; dy += stepSize) {
                        if (dx === 0 && dy === 0) continue
                        const nx = cx + dx
                        const ny = cy + dy
                        if (nx < 0 || nx > worldWidth || ny < 0 || ny > worldHeight) continue
                        // Skip neighbors in the edge buffer zone
                        const nEdgeDist = Math.min(nx, ny, worldWidth - nx, worldHeight - ny)
                        if (nEdgeDist < edgeBuffer) continue

                        const g = getGlobalHeight(nx, ny)
                        const drop = currentGlobal - g
                        if (drop > bestDrop) {
                            bestDrop = drop
                            bestGlobal = g
                            bestX = nx
                            bestY = ny
                            bestDx = dx
                            bestDy = dy
                        }
                    }
                }

                // No descent found — laked out, try to escape (multiple short attempts allowed)
                if (bestDrop < 0.01) {
                    lakeAttempts++
                    if (lakeAttempts > 5) break // Truly trapped after 5 short escape attempts

                    // Search for the lowest escape point in a small nearby area (avoid edges)
                    const searchRadius = 60 // Small radius — short escape channels that merge easily
                    let lowestElev = getElevation(cx, cy)
                    let escapeX = cx
                    let escapeY = cy
                    let escapeDrop = 0

                    for (let dx = -searchRadius; dx <= searchRadius; dx += 10) {
                        for (let dy = -searchRadius; dy <= searchRadius; dy += 10) {
                            const dist = Math.sqrt(dx * dx + dy * dy)
                            if (dist < 15 || dist > searchRadius) continue
                            const nx = cx + dx
                            const ny = cy + dy
                            // Avoid escaping toward edges
                            const nEdgeDist = Math.min(nx, ny, worldWidth - nx, worldHeight - ny)
                            if (nEdgeDist < edgeBuffer + 30) continue
                            if (nx < 0 || nx > worldWidth || ny < 0 || ny > worldHeight) continue

                            const elev = getElevation(nx, ny)
                            const drop = lowestElev - elev
                            if (drop > escapeDrop) {
                                escapeDrop = drop
                                lowestElev = elev
                                escapeX = nx
                                escapeY = ny
                            }
                        }
                    }

                    // If we found a lower point, carve a short channel to it
                    if (escapeDrop > 1) {
                        const channelDepth = escapeDrop + 3
                        const steps = Math.max(Math.abs(escapeX - cx) / 5, Math.abs(escapeY - cy) / 5)

                        for (let t = 0; t <= steps; t++) {
                            const frac = t / steps
                            const px = cx + (escapeX - cx) * frac
                            const py = cy + (escapeY - cy) * frac
                            lakeChannels.push({
                                x: px,
                                y: py,
                                depth: channelDepth,
                                width: 6
                            })
                        }

                        // Continue from the escape point
                        cx = escapeX
                        cy = escapeY
                        const actualElev = getElevation(cx, cy)
                        path.push({ x: cx, y: cy, elev: actualElev, tributaries: path[path.length - 1].tributaries })

                        if (actualElev <= waterLevel * maxElevation) break
                        continue
                    }

                    // No escape found — truly trapped
                    break
                }

                lakeAttempts = 0 // Reset on successful step

                // Add meandering: small lateral offset perpendicular to the descent direction
                // This creates gentle curves instead of rigid grid-aligned lines
                const meanderStrength = 3 // Meters of lateral offset
                const len = Math.sqrt(bestDx * bestDx + bestDy * bestDy)
                const perpX = -bestDy / len // Normalized perpendicular
                const perpY = bestDx / len
                const meanderOffset = (Math.random() - 0.5) * 2 * meanderStrength
                cx = bestX + perpX * meanderOffset
                cy = bestY + perpY * meanderOffset

                // Clamp to valid bounds
                cx = Math.max(edgeBuffer, Math.min(worldWidth - edgeBuffer, cx))
                cy = Math.max(edgeBuffer, Math.min(worldHeight - edgeBuffer, cy))
                // Record actual terrain elevation for rendering
                const actualElev = getElevation(cx, cy)
                path.push({ x: cx, y: cy, elev: actualElev, tributaries: path[path.length - 1].tributaries })

                // Reached water level (check actual elevation)
                if (actualElev <= waterLevel * maxElevation) break
            }

            return path
        }

        // Pick sources one at a time, checking convergence after each
        let sourceIdx = 0
        while (sourceIdx < sources.length) {
            // Check convergence: enough rivers AND enough total length
            const totalLength = rivers.reduce((s, r) => s + r.length, 0)
            if (rivers.length >= minRivers && totalLength >= minTotalLength) {
                console.log(`[Rivers] Converged: ${rivers.length} rivers, ${totalLength} total points`)
                break
            }

            const src = sources[sourceIdx++]
            const path = simulatePath(src)

            // Skip if path is too short to be useful
            if (path.length < minPathLength) continue

            // Check if this path joins an existing river
            // Only count as a "join" if the connection happens early in the new path
            // (i.e., the headwaters feed into an existing channel)
            let joinedRiver = null
            let joinIdx = -1
            const maxJoinFraction = 0.3 // Only count as a join if it happens in the first 30% of the path
            const maxJoinPoints = Math.max(minPathLength, Math.floor(path.length * maxJoinFraction))
            for (let ri = 0; ri < rivers.length; ri++) {
                const existing = rivers[ri]
                for (let pi = 0; pi < maxJoinPoints; pi++) {
                    const p = path[pi]
                    for (let ei = 0; ei < existing.length; ei++) {
                        const e = existing[ei]
                        const d = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2)
                        if (d < mergeProximity) {
                            joinedRiver = existing
                            joinIdx = ei
                            break
                        }
                    }
                    if (joinedRiver) break
                }
                if (joinedRiver) break
            }

            if (joinedRiver) {
                // This path feeds into an existing river — boost its tributary count
                // from the join point downstream
                for (let ei = joinIdx; ei < joinedRiver.length; ei++) {
                    joinedRiver[ei].tributaries += 1
                }
                console.log(`[Rivers] Source ${sourceIdx} joined existing river at point ${joinIdx}`)
            } else {
                // Independent river, add it
                rivers.push(path)
                console.log(`[Rivers] Source ${sourceIdx} → new river (${path.length} pts, elev ${path[0].elev.toFixed(0)}→${path[path.length - 1].elev.toFixed(0)})`)
            }
        }

        console.log(`[Rivers] Final: ${rivers.length} rivers, total length ${rivers.reduce((s, r) => s + r.length, 0)}`)
        return rivers
    }

    /**
     * Get the distance to the nearest river.
     */
    function getRiverDistance(wx, wy) {
        if (rivers.length === 0) return Infinity

        let minDist = Infinity
        for (const river of rivers) {
            for (const point of river) {
                const dx = wx - point.x
                const dy = wy - point.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < minDist) {
                    minDist = dist
                }
            }
        }
        return minDist
    }

    // Generate rivers on creation
    generateRivers()

    return {
        getElevation,
        getGlobalHeight,
        getDetailNoise,
        getDetailAmplitude,
        getWaterDepth,
        getTerrainType,
        getRiverDistance,
        generateRivers,
        rivers,
        config: {
            maxElevation,
            waterLevel,
            globalScale,
            globalMaxHeight,
            globalMinHeight,
            detailScale,
            amplitudeExponent,
            maxDetailAmplitude,
            minDetailAmplitude,
            ridgeStrength,
            ridgeSharpness,
            riverCarvingDepth,
            riverBaseWidth,
            riverWidthPerTributary,
            riverCarvePerTributary,
            globalGrade
        }
    }
}
