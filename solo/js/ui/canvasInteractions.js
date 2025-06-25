export function setupCanvasInteractions(world, renderer, createEntitySummary) {
    const canvas = renderer.canvas
    if (!canvas) {
        console.warn("Canvas not available in renderer, can't setup entity inspection")
        return
    }
    canvas.addEventListener('click', event => {
        const rect = canvas.getBoundingClientRect()
        const clickX = event.clientX - rect.left
        const clickY = event.clientY - rect.top
        const worldX = renderer.viewX + (clickX - canvas.width/2) / renderer.zoomLevel
        const worldY = renderer.viewY + (clickY - canvas.height/2) / renderer.zoomLevel
        const entity = findEntityAtPosition(world, worldX, worldY)
        if (entity) {
            console.log('Selected Entity:', entity)
            const summary = createEntitySummary(entity)
            console.log('Entity Summary:', summary)
            renderer.highlightEntity(entity, 1000)
        }
    })
}

export function findEntityAtPosition(world, x, y, threshold = 15) {
    if (!world?.entitiesMap) return null
    const entities = Array.from(world.entitiesMap.values())
    const nearbyEntities = entities.filter(entity => {
        const dx = entity.x - x
        const dy = entity.y - y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const clickRadius = entity.size || threshold
        return distance <= clickRadius
    })
    if (nearbyEntities.length > 1) {
        nearbyEntities.sort((a, b) => {
            if (a.zIndex !== undefined && b.zIndex !== undefined) {
                return b.zIndex - a.zIndex
            }
            const sizeA = a.size || 0
            const sizeB = b.size || 0
            return sizeB - sizeA
        })
    }
    return nearbyEntities[0] || null
}
