const OVERLAY_DEFS = [
    { key: 'i', id: 'inventory', title: 'Inventory' },
    { key: 'j', id: 'journal', title: 'Journal' },
    { key: 'q', id: 'quest', title: 'Quest' },
    { key: 'm', id: 'map', title: 'Map' },
    { key: 't', id: 'technology', title: 'Technology' },
    { key: 'r', id: 'relationships', title: 'Relationships' },
    { key: 'n', id: 'needs', title: 'Needs' }
]

const OVERLAY_LABELS = OVERLAY_DEFS.map(def => `${def.key.toUpperCase()}: ${def.title}`).join(' | ')

function itemName(item) {
    return item?.name ?? item?.type ?? item?.subtype ?? 'item'
}

function listToHtml(items, emptyText = 'none') {
    if (!items.length) return `<div class="dev-overlay-empty">${emptyText}</div>`
    return `<ul class="dev-overlay-list">${items.map(text => `<li>${text}</li>`).join('')}</ul>`
}

function getPawnNeeds(pawn) {
    const needs = pawn?.needs?.needs
    if (!needs) return []
    return Object.entries(needs)
        .filter(([, value]) => Number.isFinite(value))
        .sort((a, b) => b[1] - a[1])
}

function capState(playerMode, overlayId) {
    const caps = playerMode?.getCapabilities?.()?.modules?.overlayPanels
    if (!Array.isArray(caps) || !caps.length) return true
    return caps.includes(overlayId)
}

export function setupDeveloperOverlays(world, renderer, playerMode, getTrackedPawn) {
    const root = document.createElement('div')
    root.id = 'dev-overlays-root'
    root.innerHTML = OVERLAY_DEFS.map(def => `
        <section class="dev-overlay-panel" data-overlay-id="${def.id}" hidden>
            <header class="dev-overlay-header">
                <strong>${def.title}</strong>
                <span class="dev-overlay-key">[${def.key.toUpperCase()}]</span>
            </header>
            <div class="dev-overlay-body"></div>
        </section>
    `).join('')
    document.body.appendChild(root)

    const panels = new Map()
    const mapCanvases = new Map()

    for (const panel of root.querySelectorAll('.dev-overlay-panel')) {
        const id = panel.dataset.overlayId
        const body = panel.querySelector('.dev-overlay-body')
        panels.set(id, { panel, body })

        if (id === 'map') {
            const canvas = document.createElement('canvas')
            canvas.width = 300
            canvas.height = 300
            canvas.className = 'dev-overlay-map'
            body.appendChild(canvas)
            const legend = document.createElement('div')
            legend.className = 'dev-overlay-legend'
            legend.textContent = 'green: trees  teal: bushes  blue: water  white: pawn  amber: animals'
            body.appendChild(legend)
            mapCanvases.set(id, canvas)
        }
    }

    function trackedPawn() {
        return getTrackedPawn?.() ?? playerMode?.trackedPawn ?? null
    }

    function renderInventory(body, pawn) {
        const inventory = Array.isArray(pawn?.inventory) ? pawn.inventory : []
        const items = inventory.slice(0, 24).map((item, index) => `${index + 1}. ${itemName(item)}`)
        const slots = pawn?.inventorySlots ?? 0
        const header = `<div>Slots: ${inventory.length}/${slots}</div>`
        body.innerHTML = `${header}${listToHtml(items, 'empty hands')}`
    }

    function renderJournal(body, pawn, tick) {
        const thoughts = Array.isArray(pawn?.thoughtLog) ? pawn.thoughtLog.slice(-8).reverse() : []
        const thoughtItems = thoughts.map(entry => `${entry?.tag ?? 'note'} @t${entry?.tick ?? '?'}: ${entry?.text ?? '...'} `)
        const recentAction = pawn?.recentAction ?? 'Idle'
        const currentGoal = pawn?.goals?.currentGoal?.description ?? pawn?.goals?.currentGoal?.type ?? 'none'

        body.innerHTML = `
            <div><strong>Recent Action:</strong> ${recentAction}</div>
            <div><strong>Current Goal:</strong> ${currentGoal}</div>
            <div><strong>Tick:</strong> ${tick}</div>
            ${listToHtml(thoughtItems, 'no thoughts logged yet')}
        `
    }

    function renderQuest(body, pawn) {
        const currentGoal = pawn?.goals?.currentGoal
        const queue = Array.isArray(pawn?.goals?.goalQueue) ? pawn.goals.goalQueue.slice(0, 6) : []
        const queueItems = queue.map(goal => `${goal?.description ?? goal?.type ?? 'goal'} (p${goal?.priority ?? '?'})`)
        const unlockedGoals = pawn?.unlocked?.goals?.size ?? 0
        const unlockedRecipes = pawn?.unlocked?.recipes?.size ?? 0

        body.innerHTML = `
            <div><strong>Active:</strong> ${currentGoal?.description ?? currentGoal?.type ?? 'none'}</div>
            <div><strong>Unlocked Goals:</strong> ${unlockedGoals}</div>
            <div><strong>Unlocked Recipes:</strong> ${unlockedRecipes}</div>
            <div class="dev-overlay-subtitle">Queue</div>
            ${listToHtml(queueItems, 'queue empty')}
        `
    }

    function drawMap(canvas, pawn) {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const centerX = pawn?.x ?? renderer?.viewX ?? world.width * 0.5
        const centerY = pawn?.y ?? renderer?.viewY ?? world.height * 0.5
        const radiusWorld = 240
        const scale = canvas.width / (radiusWorld * 2)

        const drawDot = (x, y, color, size = 2) => {
            const sx = (x - centerX) * scale + canvas.width * 0.5
            const sy = (y - centerY) * scale + canvas.height * 0.5
            if (sx < 0 || sy < 0 || sx > canvas.width || sy > canvas.height) return
            ctx.fillStyle = color
            ctx.fillRect(Math.round(sx - size / 2), Math.round(sy - size / 2), size, size)
        }

        const entities = Array.from(world.entitiesMap.values())
        for (const entity of entities) {
            if (!Number.isFinite(entity?.x) || !Number.isFinite(entity?.y)) continue
            if (Math.abs(entity.x - centerX) > radiusWorld || Math.abs(entity.y - centerY) > radiusWorld) continue

            if (entity.type === 'tree') {
                drawDot(entity.x, entity.y, '#22c55e', 2)
                continue
            }

            if (entity.type === 'bush') {
                drawDot(entity.x, entity.y, '#14b8a6', 2)
                continue
            }

            if (entity.subtype === 'water' || entity.tags?.includes?.('water') || entity.tags?.has?.('water')) {
                drawDot(entity.x, entity.y, '#60a5fa', 2)
                continue
            }

            if (entity.subtype === 'animal') {
                drawDot(entity.x, entity.y, '#f59e0b', 2)
                continue
            }

            if (entity.subtype === 'pawn') {
                drawDot(entity.x, entity.y, '#f8fafc', 3)
            }
        }

        ctx.strokeStyle = '#64748b'
        ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)

        ctx.strokeStyle = '#334155'
        ctx.beginPath()
        ctx.moveTo(canvas.width * 0.5, 0)
        ctx.lineTo(canvas.width * 0.5, canvas.height)
        ctx.moveTo(0, canvas.height * 0.5)
        ctx.lineTo(canvas.width, canvas.height * 0.5)
        ctx.stroke()
    }

    function renderTechnology(body, pawn) {
        const skills = Object.entries(pawn?.skills ?? {})
            .filter(([, value]) => Number.isFinite(value) && value > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([name, value]) => `${name}: ${value.toFixed(2)}`)

        const recipes = Array.from(pawn?.unlocked?.recipes ?? []).slice(0, 12)
        body.innerHTML = `
            <div><strong>Known Skills:</strong> ${skills.length}</div>
            ${listToHtml(skills, 'no active skills yet')}
            <div class="dev-overlay-subtitle">Recipes</div>
            ${listToHtml(recipes, 'no recipes unlocked')}
        `
    }

    function renderRelationships(body, pawn) {
        const memberships = Object.entries(pawn?.reputation?.membership ?? {})
            .map(([group, value]) => `${group}: ${Number(value).toFixed(2)}`)
            .slice(0, 12)

        const trust = Object.entries(pawn?.groupTrust ?? {})
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 8)
            .map(([id, value]) => `${id}: ${Number(value).toFixed(2)}`)

        body.innerHTML = `
            <div><strong>Group:</strong> ${pawn?.groupState?.id ?? 'none'}</div>
            <div><strong>Role:</strong> ${pawn?.groupState?.role ?? 'none'}</div>
            <div class="dev-overlay-subtitle">Membership</div>
            ${listToHtml(memberships, 'no memberships recorded')}
            <div class="dev-overlay-subtitle">Trust</div>
            ${listToHtml(trust, 'no trust links recorded')}
        `
    }

    function renderNeeds(body, pawn) {
        const needs = getPawnNeeds(pawn)
        const lines = needs.map(([name, value]) => {
            const rounded = Math.round(value)
            const state = rounded >= 75 ? 'critical' : rounded >= 50 ? 'high' : rounded >= 25 ? 'medium' : 'low'
            return `<li><span class="need-${state}">${name}: ${rounded}</span></li>`
        })

        const behavior = pawn?.behaviorState ?? 'idle'
        body.innerHTML = `
            <div><strong>Behavior:</strong> ${behavior}</div>
            ${lines.length ? `<ul class="dev-overlay-list">${lines.join('')}</ul>` : '<div class="dev-overlay-empty">needs unavailable</div>'}
        `
    }

    function renderOverlay(id) {
        const entry = panels.get(id)
        if (!entry) return
        const { body } = entry
        const pawn = trackedPawn()
        const tick = world.clock.currentTick

        if (!pawn && id !== 'map') {
            body.innerHTML = '<div class="dev-overlay-empty">no tracked pawn</div>'
            return
        }

        switch (id) {
            case 'inventory':
                renderInventory(body, pawn)
                break
            case 'journal':
                renderJournal(body, pawn, tick)
                break
            case 'quest':
                renderQuest(body, pawn)
                break
            case 'map':
                drawMap(mapCanvases.get('map'), pawn)
                break
            case 'technology':
                renderTechnology(body, pawn)
                break
            case 'relationships':
                renderRelationships(body, pawn)
                break
            case 'needs':
                renderNeeds(body, pawn)
                break
            default:
                body.innerHTML = '<div class="dev-overlay-empty">unknown overlay</div>'
        }
    }

    function toggleOverlay(id) {
        const entry = panels.get(id)
        if (!entry) return false
        if (!capState(playerMode, id)) return false

        const nowHidden = !entry.panel.hidden
        entry.panel.hidden = nowHidden
        if (!nowHidden) renderOverlay(id)
        return true
    }

    function toggleByKey(key) {
        const def = OVERLAY_DEFS.find(item => item.key === key)
        if (!def) return false
        return toggleOverlay(def.id)
    }

    function updateVisibleOverlays() {
        for (const [id, entry] of panels.entries()) {
            if (entry.panel.hidden) continue
            renderOverlay(id)
        }
        requestAnimationFrame(updateVisibleOverlays)
    }

    requestAnimationFrame(updateVisibleOverlays)

    return {
        toggleByKey,
        labels: OVERLAY_LABELS
    }
}
