// Inventory overlay — shows held items and nearby caches/chests
// Press I to toggle

export function setupInventory(pawnGetter, worldGetter) {
    const overlay = document.createElement('div')
    overlay.id = 'inventory-overlay'
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(5, 5, 15, 0.85);
        z-index: 1600;
        display: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    `

    const panel = document.createElement('div')
    panel.id = 'inventory-panel'
    panel.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 520px;
        height: 80%;
        background: rgba(15, 15, 30, 0.95);
        border: 1px solid rgba(94, 196, 192, 0.3);
        border-radius: 12px;
        padding: 24px;
        font-family: Georgia, serif;
        color: #c8c0cc;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    `

    // Header
    const header = document.createElement('div')
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;'

    const title = document.createElement('h2')
    title.textContent = '🎒 Inventory'
    title.style.cssText = 'margin: 0; font-weight: normal; font-size: 18px; letter-spacing: 1px; color: #94a3b8;'

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = `
        background: rgba(192, 94, 94, 0.15);
        border: 1px solid rgba(192, 94, 94, 0.4);
        border-radius: 4px;
        padding: 4px 10px;
        color: #c46060;
        font-family: Georgia, serif;
        font-size: 14px;
        cursor: pointer;
    `
    closeBtn.addEventListener('click', toggle)

    header.appendChild(title)
    header.appendChild(closeBtn)
    panel.appendChild(header)

    // Scrollable content
    const content = document.createElement('div')
    content.id = 'inventory-content'
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding-right: 8px;
        scrollbar-width: thin;
    `
    panel.appendChild(content)

    // Footer with hint
    const footer = document.createElement('div')
    footer.style.cssText = 'margin-top: 12px; font-size: 11px; color: #64748b; text-align: center; font-style: italic;'
    footer.textContent = 'Press I to close • Nearby caches and chests will appear as you explore'
    panel.appendChild(footer)

    overlay.appendChild(panel)
    document.body.appendChild(overlay)

    let visible = false

    function itemName(item) {
        return item?.name ?? item?.type ?? item?.subtype ?? 'item'
    }

    function findNearbyCaches(pawn) {
        const world = worldGetter?.()
        if (!world || !pawn) return []

        const caches = []
        const searchRadius = 120 // units

        for (const entity of world.entitiesMap.values()) {
            if (!entity || !Number.isFinite(entity?.x) || !Number.isFinite(entity?.y)) continue
            const dist = Math.hypot(entity.x - pawn.x, entity.y - pawn.y)
            if (dist > searchRadius) continue

            const isCache = entity.subtype === 'cache' || entity.tags?.has?.('resource_cache') || entity.tags?.includes?.('resource_cache')
            if (isCache && Array.isArray(entity.items)) {
                caches.push({
                    name: entity.name ?? 'Cache',
                    distance: Math.round(dist),
                    items: entity.items,
                    capacity: entity.capacity ?? 0,
                })
            }
        }

        return caches.sort((a, b) => a.distance - b.distance)
    }

    function renderInventory() {
        const pawn = pawnGetter?.()
        if (!pawn) return

        const inventory = Array.isArray(pawn?.inventory) ? pawn.inventory : []
        const slots = pawn?.inventorySlots ?? 0
        const weight = pawn?.inventoryWeight ?? 0
        const maxWeight = pawn?.maxWeight ?? 50

        content.innerHTML = ''

        // --- Held Items section ---
        const heldSection = document.createElement('div')
        heldSection.style.cssText = 'margin-bottom: 20px;'

        const heldHeader = document.createElement('div')
        heldHeader.style.cssText = 'font-size: 14px; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.5px;'
        heldHeader.textContent = `Hands (${inventory.length}/${slots} slots, ${Math.round(weight)}/${maxWeight} weight)`
        heldSection.appendChild(heldHeader)

        if (inventory.length === 0) {
            const empty = document.createElement('p')
            empty.style.cssText = 'text-align: center; color: #64748b; font-style: italic; margin: 12px 0; font-size: 13px;'
            empty.textContent = 'Empty hands — nothing carried yet.'
            heldSection.appendChild(empty)
        } else {
            for (let i = 0; i < inventory.length; i++) {
                const item = inventory[i]
                if (!item) continue

                const entry = document.createElement('div')
                entry.style.cssText = `
                    padding: 8px 12px;
                    margin-bottom: 4px;
                    background: rgba(30, 41, 59, 0.5);
                    border-left: 2px solid rgba(94, 196, 192, 0.3);
                    border-radius: 0 4px 4px 0;
                    font-size: 13px;
                    line-height: 1.4;
                `

                const text = document.createElement('span')
                text.style.cssText = 'color: #cbd5e1;'
                text.textContent = `${i + 1}. ${itemName(item)}`
                entry.appendChild(text)

                heldSection.appendChild(entry)
            }
        }

        content.appendChild(heldSection)

        // --- Nearby Caches section ---
        const caches = findNearbyCaches(pawn)
        const cacheSection = document.createElement('div')
        cacheSection.style.cssText = 'margin-bottom: 20px;'

        const cacheHeader = document.createElement('div')
        cacheHeader.style.cssText = 'font-size: 14px; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.5px;'
        cacheHeader.textContent = `Nearby Caches (${caches.length})`
        cacheSection.appendChild(cacheHeader)

        if (caches.length === 0) {
            const empty = document.createElement('p')
            empty.style.cssText = 'text-align: center; color: #64748b; font-style: italic; margin: 12px 0; font-size: 13px;'
            empty.textContent = 'No caches nearby — explore to find storage.'
            cacheSection.appendChild(empty)
        } else {
            for (const cache of caches) {
                const entry = document.createElement('div')
                entry.style.cssText = `
                    padding: 10px 12px;
                    margin-bottom: 6px;
                    background: rgba(30, 41, 59, 0.5);
                    border-left: 2px solid rgba(196, 160, 94, 0.4);
                    border-radius: 0 4px 4px 0;
                    font-size: 13px;
                    line-height: 1.4;
                `

                const nameLine = document.createElement('div')
                nameLine.style.cssText = 'color: #cbd5e1; margin-bottom: 4px;'
                nameLine.textContent = `${cache.name} (${cache.distance} units away)`
                entry.appendChild(nameLine)

                const summary = document.createElement('div')
                summary.style.cssText = 'font-size: 11px; color: #64748b;'
                summary.textContent = `${cache.items.length}/${cache.capacity} items`
                entry.appendChild(summary)

                // Show item types in this cache
                if (cache.items.length > 0) {
                    const typeCounts = {}
                    for (const item of cache.items) {
                        const name = itemName(item)
                        typeCounts[name] = (typeCounts[name] || 0) + 1
                    }
                    const itemLine = document.createElement('div')
                    itemLine.style.cssText = 'font-size: 11px; color: #94a3b8; margin-top: 2px;'
                    itemLine.textContent = Object.entries(typeCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([name, count]) => `${name} ×${count}`)
                        .join(', ')
                    entry.appendChild(itemLine)
                }

                cacheSection.appendChild(entry)
            }
        }

        content.appendChild(cacheSection)
    }

    function toggle() {
        visible = !visible
        if (visible) {
            renderInventory()
            overlay.style.display = 'block'
            requestAnimationFrame(() => {
                overlay.style.opacity = '1'
                overlay.style.pointerEvents = 'auto'
            })
        } else {
            overlay.style.opacity = '0'
            overlay.style.pointerEvents = 'none'
            setTimeout(() => {
                overlay.style.display = 'none'
            }, 300)
        }
    }

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 'i' || e.key === 'I') {
            if (e.target.tagName === 'INPUT') return
            toggle()
        }
        if (e.key === 'Escape' && visible) {
            toggle()
        }
    })

    return { toggle, element: overlay }
}
