import Chunk from './Chunk.js'

class ChunkManager {
    constructor(worldWidth, worldHeight, chunkSize = 200, options = {}) {
        this.worldWidth = worldWidth
        this.worldHeight = worldHeight
        this.chunkSize = chunkSize
        this.chunksX = Math.ceil(worldWidth / chunkSize)
        this.chunksY = Math.ceil(worldHeight / chunkSize)
        this.seed = options.seed ?? Math.floor(Math.random() * 2147483647)
        this.mapStyle = options.mapStyle ?? 'temperate_frontier'
        this.settlementBasins = []
        this.activeChunkKeys = new Set()
        this.dormantEntitiesByChunk = new Map()
        this.dormantSimulationStepTicks = 20
        
        // 2D array of chunks
        this.chunks = []
        this.initializeChunks()
        this.generateContinentalMask()
        this.generateBiomes()
        this.generateWaterDepth()
        this.generateRivers()
        this.generateLakes()
        this.generateSettlementBasins()
    }
    
    initializeChunks() {
        for (let x = 0; x < this.chunksX; x++) {
            this.chunks[x] = []
            for (let y = 0; y < this.chunksY; y++) {
                this.chunks[x][y] = new Chunk(x, y, this.chunkSize)
            }
        }
    }
    
    noise2D(x, y) {
        const n = Math.sin((x * 127.1 + y * 311.7 + this.seed * 0.0001)) * 43758.5453123
        return n - Math.floor(n)
    }

    smoothNoise(x, y) {
        const corners = (
            this.noise2D(x - 1, y - 1) +
            this.noise2D(x + 1, y - 1) +
            this.noise2D(x - 1, y + 1) +
            this.noise2D(x + 1, y + 1)
        ) / 16
        const sides = (
            this.noise2D(x - 1, y) +
            this.noise2D(x + 1, y) +
            this.noise2D(x, y - 1) +
            this.noise2D(x, y + 1)
        ) / 8
        const center = this.noise2D(x, y) / 4
        return corners + sides + center
    }

    fbm(x, y, octaves = 3) {
        let total = 0
        let amplitude = 0.5
        let frequency = 1
        let norm = 0

        for (let i = 0; i < octaves; i++) {
            total += this.smoothNoise(x * frequency, y * frequency) * amplitude
            norm += amplitude
            amplitude *= 0.5
            frequency *= 2
        }

        if (norm === 0) return 0
        return total / norm
    }

    clamp01(value) {
        return Math.max(0, Math.min(1, value))
    }

    getMapProfile() {
        return {
            seed: this.seed,
            style: this.mapStyle,
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight,
            chunkSize: this.chunkSize,
            chunksX: this.chunksX,
            chunksY: this.chunksY,
            settlementBasins: this.settlementBasins
        }
    }

    // Generate broad continental-scale regions (Kansas prairie → Ozark highlands → Appalachian mountains)
    // Very low-frequency FBM creates contiguous regions, not checkerboard noise
    generateContinentalMask() {
        for (let x = 0; x < this.chunksX; x++) {
            for (let y = 0; y < this.chunksY; y++) {
                const chunk = this.chunks[x][y]

                // Normalize to 0-1 across the chunk grid
                const nx = x / Math.max(1, this.chunksX)
                const ny = y / Math.max(1, this.chunksY)

                // Very low-frequency FBM for broad regional zones
                // 1-2 octaves, large scale → creates smooth contiguous regions
                const continental = this.fbm(nx * 1.8, ny * 1.8, 2)

                // Secondary low-frequency layer for regional variation
                const regional = this.fbm((nx + 7.3) * 2.4, (ny + 3.1) * 2.4, 2)

                // Combine: continental dominates, regional adds character
                chunk.continentalMask = continental * 0.75 + regional * 0.25
            }
        }
    }

    // Generate broad, livable biomes: plains / forest / hills
    // Biomes derived from continental mask + elevation for geographic realism
    generateBiomes() {
        for (let x = 0; x < this.chunksX; x++) {
            for (let y = 0; y < this.chunksY; y++) {
                const chunk = this.chunks[x][y]

                const nx = x / Math.max(1, this.chunksX)
                const ny = y / Math.max(1, this.chunksY)

                // Continental mask defines broad region
                const mask = chunk.continentalMask ?? 0.5

                // Local elevation detail within the region
                const elevation = this.fbm(nx * 4.2, ny * 4.2, 4)
                const moisture = this.fbm((nx + 17.3) * 3.6, (ny + 9.7) * 3.6, 4)
                const openness = this.fbm((nx + 31.1) * 2.4, (ny + 6.4) * 2.4, 3)

                // Regional biome assignment with transition blending
                if (mask > 0.62) {
                    // Mountains (Appalachian zone) — high elevation, steep, rugged
                    chunk.biome = 'hills'
                    chunk.foodDensity = 0.9
                    chunk.waterDensity = 0.85
                    chunk.shelterDensity = 1.1
                    chunk.coverDensity = 36
                    chunk.humidity = 46 + Math.round(moisture * 12)
                    chunk.fertility = 48 + Math.round(moisture * 18)
                    chunk.temperature = 17
                    chunk.elevation = 0.62 + elevation * 0.55
                } else if (mask > 0.35) {
                    // Highlands/Ozarks — mid elevation, rolling, forested
                    // Moisture and openness determine forest vs transitional plains
                    if (moisture > 0.48 && openness < 0.65) {
                        chunk.biome = 'forest'
                        chunk.foodDensity = 1.22
                        chunk.waterDensity = 1.08
                        chunk.shelterDensity = 1.35
                        chunk.coverDensity = 60
                        chunk.humidity = 62 + Math.round(moisture * 14)
                        chunk.fertility = 66 + Math.round(moisture * 16)
                        chunk.temperature = 20
                        chunk.elevation = 0.36 + elevation * 0.34
                    } else {
                        // Transition zone — dry uplands or river valley corridor
                        chunk.biome = 'plains'
                        chunk.foodDensity = 1.06
                        chunk.waterDensity = 0.96
                        chunk.shelterDensity = 0.9
                        chunk.coverDensity = 24
                        chunk.humidity = 44 + Math.round(moisture * 14)
                        chunk.fertility = 60 + Math.round(moisture * 12)
                        chunk.temperature = 21
                        chunk.elevation = 0.22 + elevation * 0.24
                    }
                } else {
                    // Prairie (Kansas zone) — low elevation, flat, open
                    chunk.biome = 'plains'
                    chunk.foodDensity = 1.06
                    chunk.waterDensity = 0.96
                    chunk.shelterDensity = 0.9
                    chunk.coverDensity = 24
                    chunk.humidity = 44 + Math.round(moisture * 14)
                    chunk.fertility = 60 + Math.round(moisture * 12)
                    chunk.temperature = 21
                    chunk.elevation = 0.22 + elevation * 0.24
                }

                const foodN = this.clamp01((chunk.foodDensity - 0.75) / 0.7)
                const waterN = this.clamp01((chunk.waterDensity - 0.65) / 0.7)
                const shelterN = this.clamp01((chunk.shelterDensity - 0.7) / 0.8)
                const hillPenalty = chunk.biome === 'hills' ? 0.15 : 0
                const plainBonus = chunk.biome === 'plains' ? 0.08 : 0

                chunk.settlementSuitability = this.clamp01(
                    foodN * 0.44 +
                    waterN * 0.36 +
                    shelterN * 0.2 +
                    plainBonus -
                    hillPenalty
                )
            }
        }
    }

    getChunkCoordsAtPosition(worldX, worldY) {
        const chunkX = Math.floor(worldX / this.chunkSize)
        const chunkY = Math.floor(worldY / this.chunkSize)
        return {
            chunkX: Math.max(0, Math.min(this.chunksX - 1, chunkX)),
            chunkY: Math.max(0, Math.min(this.chunksY - 1, chunkY))
        }
    }

    getElevationAt(worldX, worldY) {
        const clampedX = Math.max(0, Math.min(this.worldWidth - 1, worldX))
        const clampedY = Math.max(0, Math.min(this.worldHeight - 1, worldY))

        const fx = clampedX / this.chunkSize
        const fy = clampedY / this.chunkSize
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const x1 = Math.min(this.chunksX - 1, x0 + 1)
        const y1 = Math.min(this.chunksY - 1, y0 + 1)
        const tx = fx - x0
        const ty = fy - y0

        const c00 = this.getChunk(x0, y0)
        const c10 = this.getChunk(x1, y0)
        const c01 = this.getChunk(x0, y1)
        const c11 = this.getChunk(x1, y1)

        const e00 = c00?.elevation ?? 0.2
        const e10 = c10?.elevation ?? e00
        const e01 = c01?.elevation ?? e00
        const e11 = c11?.elevation ?? e10

        const top = e00 * (1 - tx) + e10 * tx
        const bottom = e01 * (1 - tx) + e11 * tx
        const normalized = top * (1 - ty) + bottom * ty

        // Multi-scale detail noise for visible hills, ridges, and local relief
        const ridge = Math.abs(this.fbm(clampedX / 80, clampedY / 80, 4) - 0.5)
        const hill = this.fbm(clampedX / 200 + 5.3, clampedY / 200 + 2.1, 3)
        const swell = this.fbm(clampedX / 600 + 12.4, clampedY / 600 + 3.7, 3) - 0.5
        const detail = ridge * 0.4 + hill * 0.35 + swell * 0.25

        // World-space vertical meters — large range with strong local detail
        // Base: -5 to 45 from chunk elevation, detail adds ±20m of local relief
        return -5 + normalized * 40 + detail * 40
    }

    // Generate water depth map — 0 = land, >0 = water depth
    // Uses continental mask + elevation: very low areas = deep water, medium-low + moist = marsh
    generateWaterDepth() {
        for (let x = 0; x < this.chunksX; x++) {
            for (let y = 0; y < this.chunksY; y++) {
                const chunk = this.chunks[x][y]
                const nx = x / Math.max(1, this.chunksX)
                const ny = y / Math.max(1, this.chunksY)

                // Moisture layer influences where water collects
                const moisture = this.fbm((nx + 17.3) * 3.6, (ny + 9.7) * 3.6, 4)
                const elev = chunk.elevation ?? 0.3

                // Very low elevation + high moisture = deep water
                if (elev < 0.25 && moisture > 0.5) {
                    chunk.waterDepth = 0.5 + (0.25 - elev) * 2 + moisture * 0.3
                } else if (elev < 0.32 && moisture > 0.4) {
                    // Shallow water / marsh
                    chunk.waterDepth = 0.1 + (0.32 - elev) * 0.5
                } else {
                    chunk.waterDepth = 0
                }

                // World edges at low elevation become marsh/deep water
                const edgeDistX = Math.min(x, this.chunksX - 1 - x) / this.chunksX
                const edgeDistY = Math.min(y, this.chunksY - 1 - y) / this.chunksY
                const edgeDist = Math.min(edgeDistX, edgeDistY)
                if (edgeDist < 0.06 && elev < 0.35) {
                    chunk.waterDepth = Math.max(chunk.waterDepth, 0.3 + (0.06 - edgeDist) * 5)
                }
            }
        }
    }

    // Get interpolated water depth at world position
    getWaterDepthAt(worldX, worldY) {
        const clampedX = Math.max(0, Math.min(this.worldWidth - 1, worldX))
        const clampedY = Math.max(0, Math.min(this.worldHeight - 1, worldY))

        const fx = clampedX / this.chunkSize
        const fy = clampedY / this.chunkSize
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const x1 = Math.min(this.chunksX - 1, x0 + 1)
        const y1 = Math.min(this.chunksY - 1, y0 + 1)
        const tx = fx - x0
        const ty = fy - y0

        const c00 = this.getChunk(x0, y0)
        const c10 = this.getChunk(x1, y0)
        const c01 = this.getChunk(x0, y1)
        const c11 = this.getChunk(x1, y1)

        const d00 = c00?.waterDepth ?? 0
        const d10 = c10?.waterDepth ?? d00
        const d01 = c01?.waterDepth ?? d00
        const d11 = c11?.waterDepth ?? d10

        const top = d00 * (1 - tx) + d10 * tx
        const bottom = d01 * (1 - tx) + d11 * ty
        return top * (1 - ty) + bottom * ty
    }

    // Generate rivers — steepest descent from highlands/mountains to lowlands
    generateRivers() {
        this.rivers = []
        // Find seed points in mountain/highland zones
        const seeds = []
        for (let x = 0; x < this.chunksX; x++) {
            for (let y = 0; y < this.chunksY; y++) {
                const chunk = this.chunks[x][y]
                if (!chunk) continue
                const elev = chunk.elevation ?? 0.3
                // Seeds in high elevation areas, but not on edges
                if (elev > 0.5 && x > 2 && x < this.chunksX - 3 && y > 2 && y < this.chunksY - 3) {
                    seeds.push({ x, y, elev })
                }
            }
        }

        // Sort by elevation descending, pick top candidates spread out
        seeds.sort((a, b) => b.elev - a.elev)
        const selected = []
        const minDist = 8 // Minimum chunk distance between river sources
        for (const s of seeds) {
            if (selected.length >= 6) break // Cap at 6 rivers
            const tooClose = selected.some(sel => Math.hypot(sel.x - s.x, sel.y - s.y) < minDist)
            if (!tooClose) selected.push(s)
        }

        // Trace each river downhill
        for (const seed of selected) {
            const path = []
            let cx = seed.x
            let cy = seed.y
            let steps = 0
            const maxSteps = 80

            while (steps < maxSteps) {
                const chunk = this.getChunk(cx, cy)
                const wx = cx * this.chunkSize + this.chunkSize / 2
                const wy = cy * this.chunkSize + this.chunkSize / 2
                path.push({ x: wx, y: wy, chunkX: cx, chunkY: cy })

                // Mark chunk as river-adjacent (boost moisture)
                if (chunk) {
                    chunk.riverAdjacent = true
                    chunk.fertility = Math.min(95, (chunk.fertility ?? 50) + 8)
                }

                // Find steepest descent neighbor
                let bestDir = null
                let bestDrop = -Infinity
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue
                        const nx = cx + dx
                        const ny = cy + dy
                        const nChunk = this.getChunk(nx, ny)
                        if (!nChunk) continue
                        const nElev = nChunk.elevation ?? 0.3
                        const drop = ((chunk?.elevation ?? 0.3) - nElev)
                        // Prefer downhill, but allow slight uphill for natural flow
                        if (drop > bestDrop) {
                            bestDrop = drop
                            bestDir = { dx, dy }
                        }
                    }
                }

                if (!bestDir) break
                cx += bestDir.dx
                cy += bestDir.dy

                // Stop if we reach water or edge
                const finalChunk = this.getChunk(cx, cy)
                if (finalChunk?.waterDepth > 0.3 || cx < 0 || cx >= this.chunksX || cy < 0 || cy >= this.chunksY) break
                steps++
            }

            if (path.length > 5) {
                this.rivers.push(path)
            }
        }
    }

    // Generate lakes in elevation basins (local minima) in highland/mountain zones
    generateLakes() {
        this.lakes = []
        for (let x = 2; x < this.chunksX - 2; x++) {
            for (let y = 2; y < this.chunksY - 2; y++) {
                const chunk = this.chunks[x][y]
                if (!chunk) continue

                // Check if this is a local minimum (basin)
                let isBasin = true
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue
                        const nChunk = this.getChunk(x + dx, y + dy)
                        if (nChunk && (nChunk.elevation ?? 0.3) < (chunk.elevation ?? 0.3)) {
                            isBasin = false
                            break
                        }
                    }
                    if (!isBasin) break
                }

                if (!isBasin) continue

                // Basin in highland/mountain zone with some moisture = lake candidate
                const nx = x / Math.max(1, this.chunksX)
                const ny = y / Math.max(1, this.chunksY)
                const moisture = this.fbm((nx + 17.3) * 3.6, (ny + 9.7) * 3.6, 4)

                if (moisture > 0.45 && (chunk.elevation ?? 0.3) > 0.28) {
                    const wx = x * this.chunkSize + this.chunkSize / 2
                    const wy = y * this.chunkSize + this.chunkSize / 2
                    const radius = this.chunkSize * (0.6 + moisture * 0.4)
                    this.lakes.push({ x: wx, y: wy, radius })

                    // Mark surrounding chunks as lake-adjacent
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            const adj = this.getChunk(x + dx, y + dy)
                            if (adj) adj.lakeAdjacent = true
                        }
                    }
                }
            }
        }
    }

    // Check if a world position is passable (not cliff, steep gradient, or deep water)
    isPassable(worldX, worldY) {
        const elevation = this.getElevationAt(worldX, worldY)
        // Normalize elevation to 0-1 range (new scale: -5 to 80)
        const normElev = (elevation + 5) / 80

        // High elevation = cliff face, impassable
        if (normElev > 0.75) return false

        // Deep water is impassable
        const waterDepth = this.getWaterDepthAt(worldX, worldY)
        if (waterDepth > 0.4) return false

        // Check gradient — if adjacent cells differ too much, it's a cliff edge
        const dx = [1, -1, 0, 0]
        const dy = [0, 0, 1, -1]
        for (let i = 0; i < 4; i++) {
            const adjElev = this.getElevationAt(worldX + dx[i], worldY + dy[i])
            const gradient = Math.abs(elevation - adjElev)
            if (gradient > 8) return false // Steep cliff face
        }

        return true
    }

    generateSettlementBasins(targetCount = 10, minDistanceChunks = 5) {
        const allChunks = []
        for (let x = 3; x < this.chunksX - 3; x++) {
            for (let y = 3; y < this.chunksY - 3; y++) {
                const chunk = this.chunks[x][y]
                if (!chunk) continue
                if ((chunk.settlementSuitability ?? 0) < 0.58) continue
                allChunks.push(chunk)
            }
        }

        allChunks.sort((a, b) => (b.settlementSuitability ?? 0) - (a.settlementSuitability ?? 0))
        const basins = []

        for (const chunk of allChunks) {
            if (basins.length >= targetCount) break

            const tooClose = basins.some(basin => {
                const dx = basin.chunkX - chunk.x
                const dy = basin.chunkY - chunk.y
                return Math.sqrt(dx * dx + dy * dy) < minDistanceChunks
            })

            if (tooClose) continue

            basins.push({
                chunkX: chunk.x,
                chunkY: chunk.y,
                x: chunk.worldX + chunk.size / 2,
                y: chunk.worldY + chunk.size / 2,
                suitability: chunk.settlementSuitability,
                biome: chunk.biome
            })
        }

        this.settlementBasins = basins
    }

    getSettlementBasins(count = 10) {
        return this.settlementBasins.slice(0, count)
    }

    getEntitiesInChunkRadius(centerChunkX, centerChunkY, radius = 3, includeCenter = true) {
        const entities = []

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (!includeCenter && dx === 0 && dy === 0) continue
                const chunk = this.getChunk(centerChunkX + dx, centerChunkY + dy)
                if (!chunk) continue

                for (const entity of chunk.entities) {
                    entities.push(entity)
                }
            }
        }

        return entities
    }

    getEntitiesInChunkRadiusAtPosition(worldX, worldY, radius = 3, includeCenter = true) {
        const { chunkX, chunkY } = this.getChunkCoordsAtPosition(worldX, worldY)
        return this.getEntitiesInChunkRadius(chunkX, chunkY, radius, includeCenter)
    }

    _chunkKey(chunkX, chunkY) {
        return `${chunkX},${chunkY}`
    }

    _getChunkCoordsInRadius(centerChunkX, centerChunkY, radius = 3) {
        const coords = []
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const chunkX = centerChunkX + dx
                const chunkY = centerChunkY + dy
                if (chunkX < 0 || chunkX >= this.chunksX || chunkY < 0 || chunkY >= this.chunksY) continue
                coords.push({ chunkX, chunkY })
            }
        }
        return coords
    }

    _hashString(text = '') {
        let hash = 0
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i)
            hash |= 0
        }
        return Math.abs(hash)
    }

    _dormantRoll(entity, tick, channel = 'default') {
        const key = `${entity?.id ?? entity?.name ?? 'entity'}:${channel}`
        const h = this._hashString(key)
        return this.noise2D((tick + h * 0.013) / 41.7, (h % 9973) / 19.3)
    }

    _isDormantTradeGoal(goal) {
        if (!goal) return false
        return goal.type === 'establish_trade' || goal.action === 'trade'
    }

    _isDormantForagingGoal(goal) {
        if (!goal) return false
        const type = String(goal.type ?? '')
        if (type === 'find_food' || type === 'gather_materials' || type === 'gather_specific' || type === 'search_resource') return true
        if (goal.action === 'gather') return true
        if (Array.isArray(goal.targetTags) && goal.targetTags.some(tag => tag === 'food' || tag === 'harvestable')) return true
        const description = String(goal.description ?? '').toLowerCase()
        return description.includes('hunt') || description.includes('forage')
    }

    _createDormantItem(type, tick, quantity = 1) {
        const normalizedType = String(type ?? 'resource').toLowerCase()
        const base = {
            id: `offscreen_${normalizedType}_${tick}_${Math.floor(this.noise2D(tick, quantity) * 100000)}`,
            type: normalizedType,
            subtype: normalizedType,
            name: normalizedType.replace(/_/g, ' '),
            quantity,
            weight: Math.max(0.5, quantity),
            size: 1,
            tags: []
        }

        if (normalizedType === 'meat' || normalizedType === 'berries' || normalizedType === 'forage') {
            base.tags = ['food']
        } else if (normalizedType === 'hide') {
            base.tags = ['material']
        } else if (normalizedType === 'trade_bundle') {
            base.tags = ['trade', 'valuable']
            base.weight = Math.max(0.8, quantity * 0.8)
        }

        return base
    }

    _grantDormantYield(pawn, item) {
        if (!pawn || !item) return false
        const added = pawn.addItemToInventory?.(item)
        if (added) return true

        pawn.hiddenInventory = pawn.hiddenInventory ?? []
        pawn.hiddenInventory.push(item)
        return true
    }

    _completeDormantGoal(pawn, goal) {
        if (!pawn?.goals || !goal) return
        pawn.setRecentAction?.(`Completed offscreen ${goal.type ?? 'goal'}`)
        pawn.goals.completeCurrentGoal?.()
    }

    _simulateDormantForaging(world, pawn, goal, tick) {
        const gathering = pawn.getSkill?.('gathering') ?? 0
        const hunting = pawn.getSkill?.('hunting') ?? 0
        const tracking = pawn.getSkill?.('tracking') ?? 0
        const targetBias = Array.isArray(goal.targetTags) && goal.targetTags.includes('food') ? 0.08 : 0
        const successChance = Math.min(0.92, 0.2 + gathering * 0.018 + hunting * 0.016 + tracking * 0.01 + targetBias)

        const roll = this._dormantRoll(pawn, tick, `forage:${goal.type ?? 'generic'}`)
        if (roll > successChance) return

        const huntBias = goal.type === 'find_food' || String(goal.description ?? '').toLowerCase().includes('hunt')
        const meatRoll = this._dormantRoll(pawn, tick, 'forage:meat')
        const hideRoll = this._dormantRoll(pawn, tick, 'forage:hide')
        const qtyRoll = this._dormantRoll(pawn, tick, 'forage:qty')
        const quantity = 1 + Math.floor(qtyRoll * 2)

        if (huntBias && meatRoll < 0.68) {
            this._grantDormantYield(pawn, this._createDormantItem('meat', tick, quantity))
            if (hideRoll < 0.35) this._grantDormantYield(pawn, this._createDormantItem('hide', tick, 1))
        } else {
            const forageType = meatRoll < 0.5 ? 'berries' : 'forage'
            this._grantDormantYield(pawn, this._createDormantItem(forageType, tick, quantity))
        }

        goal.offscreenYieldCount = (goal.offscreenYieldCount ?? 0) + 1
        pawn.useSkill?.('gathering', 0.03)
        if (huntBias) pawn.useSkill?.('hunting', 0.02)

        const targetYields = goal.offscreenTargetYields ?? (goal.type === 'find_food' ? 2 : 3)
        if ((goal.offscreenYieldCount ?? 0) >= targetYields) {
            this._completeDormantGoal(pawn, goal)
        }
    }

    _simulateDormantTrade(world, pawn, goal, tick) {
        const convincing = pawn.getSkill?.('convincing') ?? 0
        const storytelling = pawn.getSkill?.('storytelling') ?? 0
        const planning = pawn.getSkill?.('planning') ?? 0
        const successChance = Math.min(0.9, 0.18 + convincing * 0.02 + storytelling * 0.012 + planning * 0.009)
        const roll = this._dormantRoll(pawn, tick, `trade:${goal.type ?? 'generic'}`)

        if (roll <= successChance) {
            const quantity = 1 + Math.floor(this._dormantRoll(pawn, tick, 'trade:qty') * 2)
            this._grantDormantYield(pawn, this._createDormantItem('trade_bundle', tick, quantity))
            pawn.needs?.satisfyNeed?.('social', 8)
            pawn.needs?.satisfyNeed?.('purpose', 6)
            pawn.useSkill?.('convincing', 0.05)
            goal.offscreenTradeCount = (goal.offscreenTradeCount ?? 0) + 1
        }

        const targetTrades = goal.offscreenTargetTrades ?? 2
        if ((goal.offscreenTradeCount ?? 0) >= targetTrades) {
            this._completeDormantGoal(pawn, goal)
        }
    }

    _simulateDormantPawn(world, pawn, tick) {
        if (!pawn || pawn.subtype !== 'pawn') return

        pawn.timeTick?.(world.clock.getGameSeconds?.() ?? 0)
        pawn.needs?.updateNeeds?.(tick)

        const state = pawn._dormantSimulation ?? {
            lastTick: tick,
            carryTicks: 0
        }

        const elapsed = Math.max(0, tick - (state.lastTick ?? tick))
        state.lastTick = tick
        state.carryTicks = (state.carryTicks ?? 0) + elapsed

        const step = this.dormantSimulationStepTicks
        const loops = Math.floor((state.carryTicks ?? 0) / step)
        if (loops <= 0) {
            pawn._dormantSimulation = state
            return
        }

        state.carryTicks -= loops * step

        for (let i = 0; i < loops; i++) {
            if (!pawn.goals?.currentGoal && Array.isArray(pawn.goals?.goalQueue) && pawn.goals.goalQueue.length > 0) {
                pawn.goals.currentGoal = pawn.goals.goalQueue.shift()
                pawn.goals.startGoal?.(pawn.goals.currentGoal)
            }

            const goal = pawn.goals?.currentGoal
            if (!goal) {
                if (this._dormantRoll(pawn, tick + i, 'idle:planner') < 0.2) pawn.applyIdlePlanner?.(tick)
                continue
            }

            if (!goal.startTime) goal.startTime = tick

            if (this._isDormantTradeGoal(goal)) {
                this._simulateDormantTrade(world, pawn, goal, tick + i)
                continue
            }

            if (this._isDormantForagingGoal(goal)) {
                this._simulateDormantForaging(world, pawn, goal, tick + i)
                continue
            }

            if (goal.duration) {
                const elapsedSinceStart = tick - goal.startTime
                if (elapsedSinceStart >= goal.duration) {
                    this._completeDormantGoal(pawn, goal)
                }
            }
        }

        pawn.updateGroupDynamics?.(tick)
        pawn._dormantSimulation = state
    }

    advanceDormantSimulation(world, tick) {
        if (!world || this.dormantEntitiesByChunk.size === 0) return

        for (const entities of this.dormantEntitiesByChunk.values()) {
            for (const entity of entities) {
                this._simulateDormantPawn(world, entity, tick)
            }
        }
    }

    syncActiveChunkWindow(world, centerWorldX, centerWorldY, radius = 3) {
        if (!world) return

        const { chunkX: centerChunkX, chunkY: centerChunkY } = this.getChunkCoordsAtPosition(centerWorldX, centerWorldY)
        const nextActiveKeys = new Set(
            this._getChunkCoordsInRadius(centerChunkX, centerChunkY, radius)
                .map(({ chunkX, chunkY }) => this._chunkKey(chunkX, chunkY))
        )

        for (const key of this.activeChunkKeys) {
            if (nextActiveKeys.has(key)) continue
            const [chunkX, chunkY] = key.split(',').map(Number)
            const chunk = this.getChunk(chunkX, chunkY)
            if (!chunk || chunk.entities.size === 0) continue

            const dormantEntities = Array.from(chunk.entities)
            this.dormantEntitiesByChunk.set(key, dormantEntities)

            for (const entity of dormantEntities) {
                entity._dormantSimulation = {
                    ...(entity._dormantSimulation ?? {}),
                    lastTick: world.clock?.currentTick ?? 0,
                    carryTicks: 0
                }
                chunk.removeEntity(entity)
                const entityKey = entity.id || entity.name
                if (entityKey) world.entitiesMap.delete(entityKey)
                if (entity) entity.currentChunk = null
            }
        }

        for (const key of nextActiveKeys) {
            if (this.activeChunkKeys.has(key)) continue
            const [chunkX, chunkY] = key.split(',').map(Number)
            const chunk = this.getChunk(chunkX, chunkY)
            if (!chunk) continue

            const dormantEntities = this.dormantEntitiesByChunk.get(key)
            if (!dormantEntities?.length) continue

            for (const entity of dormantEntities) {
                const entityKey = entity.id || entity.name
                if (!entityKey) continue
                world.entitiesMap.set(entityKey, entity)
                entity.world = world
                chunk.addEntity(entity)
                entity.currentChunk = chunk
            }

            this.dormantEntitiesByChunk.delete(key)
        }

        this.activeChunkKeys = nextActiveKeys
        return nextActiveKeys
    }
    
    // Get chunk at world coordinates
    getChunkAtPosition(worldX, worldY) {
        const chunkX = Math.floor(worldX / this.chunkSize)
        const chunkY = Math.floor(worldY / this.chunkSize)
        return this.getChunk(chunkX, chunkY)
    }
    
    // Get chunk at chunk coordinates
    getChunk(chunkX, chunkY) {
        if (chunkX >= 0 && chunkX < this.chunksX && 
            chunkY >= 0 && chunkY < this.chunksY) {
            return this.chunks[chunkX][chunkY]
        }
        return null
    }
    
    // Add entity to appropriate chunk
    addEntity(entity) {
        const chunk = this.getChunkAtPosition(entity.x, entity.y)
        if (chunk) {
            chunk.addEntity(entity)
            entity.currentChunk = chunk
        }
    }
    
    // Update entity's chunk if it moved
    updateEntityChunk(entity, oldX, oldY) {
        const oldChunk = this.getChunkAtPosition(oldX, oldY)
        const newChunk = this.getChunkAtPosition(entity.x, entity.y)
        
        if (oldChunk !== newChunk) {
            if (oldChunk) {
                oldChunk.removeEntity(entity)
            }
            if (newChunk) {
                newChunk.addEntity(entity)
                entity.currentChunk = newChunk
            }
        }
    }
    
    // Get all entities within a radius
    getEntitiesInRadius(worldX, worldY, radius) {
        const entities = []
        
        // Calculate which chunks to check
        const minChunkX = Math.floor((worldX - radius) / this.chunkSize)
        const maxChunkX = Math.ceil((worldX + radius) / this.chunkSize)
        const minChunkY = Math.floor((worldY - radius) / this.chunkSize)
        const maxChunkY = Math.ceil((worldY + radius) / this.chunkSize)
        
        for (let x = minChunkX; x <= maxChunkX; x++) {
            for (let y = minChunkY; y <= maxChunkY; y++) {
                const chunk = this.getChunk(x, y)
                if (!chunk) continue
                
                // Check entities in this chunk
                for (const entity of chunk.entities) {
                    const dx = entity.x - worldX
                    const dy = entity.y - worldY
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    
                    if (distance <= radius) {
                        entities.push(entity)
                    }
                }
            }
        }
        
        return entities
    }
}

export default ChunkManager
