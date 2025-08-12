import WaterSource from '../models/entities/resources/WaterSource.js'

class WaterGenerator {
    constructor(world) {
        this.world = world
        this._id = 0
    }

    addWater(x, y, { size = 12, quantity = 200, maxQuantity = 200, replenishRate = 0.5, name = 'Water' } = {}) {
        const id = `water_${this._id++}`
        const ws = new WaterSource(id, name, Math.round(x), Math.round(y))
    ws.size = Math.max(1, size)
        ws.quantity = quantity
        ws.maxQuantity = maxQuantity
        ws.replenishRate = replenishRate
        this.world.addEntity(ws)
        return ws
    }

    // Create a meandering river by placing water nodes along a path
    placeRiver({ start, end, width = 16, spacing = 20, meander = 0.35, name = 'River' }) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.floor(length / spacing))
        // Perpendicular vector
        const px = -dy / length
        const py = dx / length
        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const bx = start.x + dx * t
            const by = start.y + dy * t
            // Meander using sin waves
            const m = Math.sin(t * Math.PI * 2) * meander * width
            const x = bx + px * m
            const y = by + py * m
            this.addWater(x, y, { size: width * 0.5, quantity: 500, maxQuantity: 500, replenishRate: 1.0, name })
        }
    }

    // Scatter a handful of water nodes within a circular area to represent a lake
    placeLake(cx, cy, radius = 80, { name = 'Lake', nodes = null } = {}) {
        const n = nodes ?? Math.max(6, Math.floor(radius / 10))
        for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2
            const r = Math.sqrt(Math.random()) * radius
            const x = cx + Math.cos(ang) * r
            const y = cy + Math.sin(ang) * r
            const size = 10 + Math.random() * 8
            this.addWater(x, y, { size, quantity: 300, maxQuantity: 300, replenishRate: 0.8, name })
        }
    }

    // Small low-capacity water nodes that deplete quickly
    placePuddles(count = 12, bounds = null) {
        const rect = bounds || { x: 0, y: 0, w: this.world.width, h: this.world.height }
        for (let i = 0; i < count; i++) {
            const x = rect.x + Math.random() * rect.w
            const y = rect.y + Math.random() * rect.h
            const size = 5 + Math.random() * 4
            const maxQ = 30 + Math.random() * 30
            const q = maxQ * (0.5 + Math.random() * 0.5)
            this.addWater(x, y, { size, quantity: q, maxQuantity: maxQ, replenishRate: 0.05, name: 'Puddle' })
        }
    }
}

export default WaterGenerator
