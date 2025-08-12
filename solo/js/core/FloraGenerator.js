// FloraGenerator.js
// Populate the world with Trees, Bushes, and Grass using chunk-aware placement

import { Tree, Bush, Grass } from '../models/entities/plants/Flora.js'

class FloraGenerator {
    constructor(world) {
        this.world = world
        this.ids = { tree: 0, bush: 0, grass: 0 }
    }

    generateFlora() {
        const chunkManager = this.world.chunkManager
        for (let cx = 0; cx < chunkManager.chunksX; cx++) {
            for (let cy = 0; cy < chunkManager.chunksY; cy++) {
                const chunk = chunkManager.getChunk(cx, cy)
                if (!chunk) continue
                this.generateForChunk(chunk)
            }
        }
    }

    generateForChunk(chunk) {
        // Numbers scale by biome
        const biome = chunk.biome
        const size = chunk.size
        const baseTrees = biome === 'forest' ? 20 : biome === 'plains' ? 4 : 8
        const baseBushes = biome === 'forest' ? 12 : biome === 'plains' ? 8 : 10
        const baseGrass = biome === 'plains' ? 30 : biome === 'forest' ? 18 : 22

        this.placeTrees(chunk, baseTrees)
        this.placeBushes(chunk, baseBushes)
        this.placeGrass(chunk, baseGrass)
    }

    placeTrees(chunk, count) {
        let placed = 0
        let attempts = 0
        while (placed < count && attempts < count * 10) {
            attempts++
            const { x, y } = this.randomPointInChunk(chunk, 30)
            // Enforce ≥3m from other adult trees
            const near = this.world.getNearbyEntities(x, y, 3).filter(e => e.type === 'tree' && e.stage === 'adult')
            if (near.length > 0) continue
            const id = `tree_${chunk.x}_${chunk.y}_${this.ids.tree++}`
            const name = 'Tree'
            const tree = new Tree({ id, name, x, y, stage: 'adult', variety: this.pickTreeVariety(chunk.biome) })
            // Tags: trees provide cover; some varieties provide food
            tree.tags.add('cover')
            if (this.isFoodBearingTree(tree.variety)) {
                tree.tags.add('food')
                // Optionally, persistent drops metadata (fruit/nuts)
                tree.setPersistentDrops?.([{ type: 'fruit', amount: 3 }])
            }
            this.world.addEntity(tree)
            placed++
        }
    }

    // New: place clumps of trees to simulate forests
    placeForestClump(centerX, centerY, radius = 120, density = 0.006) {
        // Approximate number of trees by area * density
        const area = Math.PI * radius * radius
        const desired = Math.max(10, Math.floor(area * density))
        let placed = 0
        let tries = 0
        while (placed < desired && tries < desired * 10) {
            tries++
            const ang = Math.random() * Math.PI * 2
            const r = Math.sqrt(Math.random()) * radius // bias toward center
            const x = Math.round(centerX + Math.cos(ang) * r)
            const y = Math.round(centerY + Math.sin(ang) * r)
            if (x < 0 || y < 0 || x > this.world.width || y > this.world.height) continue
            // Keep >=3m from adult trees
            const near = this.world.getNearbyEntities(x, y, 3).filter(e => e.type === 'tree' && e.stage === 'adult')
            if (near.length > 0) continue
            const id = `tree_clump_${this.ids.tree++}`
            const name = 'Tree'
            const tree = new Tree({ id, name, x, y, stage: 'adult', variety: this.pickTreeVariety('forest') })
            tree.tags.add('cover')
            if (Math.random() < 0.5) tree.tags.add('food')
            this.world.addEntity(tree)
            placed++
        }
        return placed
    }

    placeBushes(chunk, count) {
        for (let i = 0; i < count; i++) {
            // Prefer near treeline: try position within 10m of a tree; fallback random
            let pos = this.findNearTypeInChunk(chunk, 'tree', 10) || this.randomPointInChunk(chunk, 10)
            const { x, y } = pos
            const id = `bush_${chunk.x}_${chunk.y}_${this.ids.bush++}`
            const name = 'Bush'
            const bush = new Bush({ id, name, x, y, stage: 'mature' })
            // Bushes are cover; some are food
            bush.tags.add('cover')
            if (Math.random() < 0.6) bush.tags.add('food') // 60% have berries
            this.world.addEntity(bush)
        }
    }

    placeGrass(chunk, count) {
        // Scatter grass where no adult trees in the same meter (1m radius)
        let placed = 0
        let attempts = 0
        while (placed < count && attempts < count * 8) {
            attempts++
            const { x, y } = this.randomPointInChunk(chunk, 10)
            const adultTreesHere = this.world.getNearbyEntities(x, y, 1).some(e => e.type === 'tree' && e.stage === 'adult')
            if (adultTreesHere) continue
            const id = `grass_${chunk.x}_${chunk.y}_${this.ids.grass++}`
            const name = 'Grass'
            const grass = new Grass({ id, name, x, y, population: 50 + Math.floor(Math.random() * 50) })
            // Grass is food for herbivores
            grass.tags.add('food')
            this.world.addEntity(grass)
            placed++
        }
    }

    // Helpers
    randomPointInChunk(chunk, margin = 0) {
        const x = chunk.worldX + margin + Math.random() * (chunk.size - margin * 2)
        const y = chunk.worldY + margin + Math.random() * (chunk.size - margin * 2)
        return { x: Math.round(x), y: Math.round(y) }
    }

    findNearTypeInChunk(chunk, type, radius) {
        // Sample a point near an existing entity of given type within the chunk
        const candidates = []
        for (const e of chunk.entities) if (e.type === type) candidates.push(e)
        if (candidates.length === 0) return null
        const base = candidates[Math.floor(Math.random() * candidates.length)]
        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * radius
        const x = base.x + Math.cos(angle) * dist
        const y = base.y + Math.sin(angle) * dist
        // Clamp to chunk
        const cx = Math.max(chunk.worldX, Math.min(chunk.worldX + chunk.size, x))
        const cy = Math.max(chunk.worldY, Math.min(chunk.worldY + chunk.size, y))
        return { x: Math.round(cx), y: Math.round(cy) }
    }

    pickTreeVariety(biome) {
        const forest = ['oak', 'maple', 'pine']
        const plains = ['oak', 'maple']
        const mountain = ['pine']
        const wetland = ['oak']
        switch (biome) {
            case 'forest': return forest[Math.floor(Math.random() * forest.length)]
            case 'plains': return plains[Math.floor(Math.random() * plains.length)]
            case 'mountain': return mountain[0]
            case 'wetland': return wetland[0]
            default: return 'oak'
        }
    }

    isFoodBearingTree(variety) {
        return variety === 'oak' || variety === 'maple' // acorns/nuts, sap/seed
    }
}

export default FloraGenerator
