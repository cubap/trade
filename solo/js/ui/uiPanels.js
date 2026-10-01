// Unified UI panel system — all panels share consistent styling and behavior
// Only one panel open at a time; Escape closes any open panel

const PANEL_DEFS = [
    { key: 'i', id: 'inventory', title: 'Inventory', icon: '🎒' },
    { key: 'j', id: 'journal', title: 'Journal', icon: '📖' },
    { key: 'q', id: 'quest', title: 'Quest', icon: '🗺' },
    { key: 'm', id: 'map', title: 'Map', icon: '📍' },
    { key: 't', id: 'technology', title: 'Technology', icon: '⚙' },
    { key: 'r', id: 'relationships', title: 'Relationships', icon: '👥' },
    { key: 'c', id: 'character', title: 'Character', icon: '🧑' },
    { key: 's', id: 'skills', title: 'Skills', icon: '🌳' },
]

const PANEL_MAP = new Map(PANEL_DEFS.map(d => [d.key, d]))

// Skill tree definition: categories with parent-child relationships
const SKILL_TREE = {
    survival: {
        label: 'Survival',
        color: '#22c55e',
        skills: [
            { id: 'gathering', label: 'Gathering', children: ['herbalism', 'foraging'] },
            { id: 'foraging', label: 'Foraging', children: [] },
            { id: 'herbalism', label: 'Herbalism', children: ['alchemy', 'medicine'] },
            { id: 'orienteering', label: 'Orienteering', children: ['cartography', 'tracking'] },
            { id: 'cartography', label: 'Cartography', children: [] },
            { id: 'tracking', label: 'Tracking', children: ['hunting'] },
            { id: 'hunting', label: 'Hunting', children: [] },
            { id: 'survival', label: 'Survival', children: [] }
        ]
    },
    craft: {
        label: 'Craft',
        color: '#f59e0b',
        skills: [
            { id: 'manipulation', label: 'Manipulation', children: ['knapping', 'weaving'] },
            { id: 'knapping', label: 'Knapping', children: ['stonework', 'tool_making'] },
            { id: 'stonework', label: 'Stonework', children: ['mining'] },
            { id: 'mining', label: 'Mining', children: [] },
            { id: 'tool_making', label: 'Tool Making', children: [] },
            { id: 'weaving', label: 'Weaving', children: ['basketry', 'textile_work', 'rope_craft'] },
            { id: 'basketry', label: 'Basketry', children: [] },
            { id: 'textile_work', label: 'Textile Work', children: ['tailoring'] },
            { id: 'tailoring', label: 'Tailoring', children: ['leather_work', 'armor_repair'] },
            { id: 'leather_work', label: 'Leather Work', children: [] },
            { id: 'armor_repair', label: 'Armor Repair', children: [] },
            { id: 'rope_craft', label: 'Rope Craft', children: [] }
        ]
    },
    mind: {
        label: 'Mind',
        color: '#3b82f6',
        skills: [
            { id: 'planning', label: 'Planning', children: ['engineering', 'cooperation'] },
            { id: 'engineering', label: 'Engineering', children: ['construction_basics', 'carpentry'] },
            { id: 'construction_basics', label: 'Construction', children: ['carpentry'] },
            { id: 'carpentry', label: 'Carpentry', children: [] },
            { id: 'cooperation', label: 'Cooperation', children: [] }
        ]
    },
    healing: {
        label: 'Healing',
        color: '#ec4899',
        skills: [
            { id: 'alchemy', label: 'Alchemy', children: ['poisoncraft', 'chemistry'] },
            { id: 'poisoncraft', label: 'Poisoncraft', children: [] },
            { id: 'chemistry', label: 'Chemistry', children: [] },
            { id: 'medicine', label: 'Medicine', children: ['surgery', 'anatomy'] },
            { id: 'surgery', label: 'Surgery', children: [] },
            { id: 'anatomy', label: 'Anatomy', children: [] }
        ]
    }
}

const SKILL_META = {}
for (const [catId, cat] of Object.entries(SKILL_TREE)) {
    for (const skill of cat.skills) {
        SKILL_META[skill.id] = { ...skill, category: catId, categoryColor: cat.color, categoryLabel: cat.label }
    }
}

// --- Renderers ---

function itemName(item) {
    return item?.name ?? item?.type ?? item?.subtype ?? 'item'
}

// Escape dynamic strings before injecting them into panel innerHTML
export function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

/**
 * Direction of a fast-shifting value over a short window.
 * Returns 1 (rising), -1 (falling) or 0 (steady/unknown). The verdict is held
 * between anchor samples so trend arrows don't flicker on every repaint.
 */
export function computeTrend(key, current, nowMs, samples, { minDelta = 2, windowMs = 1500 } = {}) {
    const prev = samples.get(key)
    if (!prev) {
        samples.set(key, { value: current, at: nowMs, trend: 0 })
        return 0
    }
    if (nowMs - prev.at < windowMs) return prev.trend
    const delta = current - prev.value
    const trend = Math.abs(delta) < minDelta ? 0 : (delta > 0 ? 1 : -1)
    samples.set(key, { value: current, at: nowMs, trend })
    return trend
}

const needTrendSamples = new Map()

// Needs are urgency values (higher = worse), so rising is the warning color.
function trendGlyph(trend) {
    if (trend > 0) return '<span class="panel-need-trend panel-trend-up" title="Rising">&#9650;</span>'
    if (trend < 0) return '<span class="panel-need-trend panel-trend-down" title="Falling">&#9660;</span>'
    return '<span class="panel-need-trend panel-trend-flat" title="Steady">&#8226;</span>'
}

// Compact horizontal meter for capacity-style values (slots, weight)
function renderMeter(label, value, max) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    const tone = pct >= 90 ? 'panel-meter-critical' : pct >= 70 ? 'panel-meter-high' : ''
    return `
        <div class="panel-meter-row">
            <span class="panel-meter-label">${esc(label)}</span>
            <div class="panel-meter-bg"><div class="panel-meter-fill ${tone}" style="width: ${pct}%"></div></div>
            <span class="panel-meter-value">${Math.round(value)}/${Math.round(max)}</span>
        </div>
    `
}

function getPawnNeeds(pawn) {
    const needs = pawn?.needs?.needs
    if (!needs) return []
    return Object.entries(needs)
        .filter(([, value]) => Number.isFinite(value))
        .sort((a, b) => b[1] - a[1])
}

function renderInventory(pawn, world) {
    const inventory = Array.isArray(pawn?.inventory) ? pawn.inventory : []
    const slots = pawn?.inventorySlots ?? 0
    const weight = pawn?.inventoryWeight ?? 0
    const maxWeight = pawn?.maxWeight ?? 50

    // Held items
    const itemsHtml = inventory.slice(0, 24).map((item, i) =>
        `<div class="panel-item-row"><span class="panel-item-index">${i + 1}.</span><span class="panel-item-name">${esc(itemName(item))}</span></div>`
    ).join('')

    // Nearby caches
    const caches = findNearbyCaches(pawn, world)
    const cachesHtml = caches.map(cache => {
        const typeCounts = {}
        for (const item of cache.items) {
            const name = itemName(item)
            typeCounts[name] = (typeCounts[name] || 0) + 1
        }
        const itemSummary = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => `${esc(name)} ×${count}`)
            .join(', ')

        return `
            <div class="panel-cache-row">
                <div class="panel-cache-header">
                    <span class="panel-cache-name">${esc(cache.name)}</span>
                    <span class="panel-cache-distance">${cache.distance}u</span>
                </div>
                <div class="panel-cache-items">${itemSummary || 'empty'}</div>
            </div>
        `
    }).join('')

    return `
        <div class="panel-section">
            <div class="panel-section-header">
                <span>Hands</span>
                <span class="panel-section-meta">${inventory.length}/${slots} slots · ${Math.round(weight)}/${maxWeight} weight</span>
            </div>
            ${renderMeter('Slots', inventory.length, slots)}
            ${renderMeter('Weight', weight, maxWeight)}
            ${itemsHtml || '<div class="panel-empty">Empty hands — nothing carried yet.</div>'}
        </div>
        <div class="panel-section">
            <div class="panel-section-header">
                <span>Nearby Caches</span>
                <span class="panel-section-meta">${caches.length}</span>
            </div>
            ${cachesHtml || '<div class="panel-empty">No caches nearby — explore to find storage.</div>'}
        </div>
    `
}

function findNearbyCaches(pawn, world) {
    if (!world || !pawn) return []
    const caches = []
    const searchRadius = 120

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

function renderJournal(pawn) {
    const thoughts = pawn?.thoughtLog || []
    if (!thoughts.length) {
        return '<div class="panel-empty">No thoughts recorded yet.</div>'
    }

    const tagColors = {
        quiz: '#c4c05e',
        spawn: '#5ec4c0',
        hardship: '#c05e5e',
        insight: '#5ea0c4',
        social: '#c45ea0',
        epiphany: '#c4a05e',
        loss: '#787878',
    }

    // Cap the list so the panel stays responsive; oldest entries are dropped.
    const entriesHtml = thoughts.slice(-60).reverse().map(thought => {
        const tag = thought?.tag || 'general'
        const accent = tagColors[tag] || '#5ec4c0'
        return `
            <div class="panel-journal-entry" style="border-left-color: ${accent}">
                <div class="panel-journal-text">${esc(thought?.text || '')}</div>
                <div class="panel-journal-meta">
                    <span class="panel-journal-tag">${esc(tag)}</span>
                    <span class="panel-journal-tick">tick ${thought?.tick ?? '?'}</span>
                </div>
            </div>
        `
    }).join('')

    return `<div class="panel-journal-list">${entriesHtml}</div>`
}

function renderQuest(pawn) {
    const currentGoal = pawn?.goals?.currentGoal
    const queue = Array.isArray(pawn?.goals?.goalQueue) ? pawn.goals.goalQueue.slice(0, 6) : []
    const unlockedGoals = pawn?.unlocked?.goals?.size ?? 0
    const unlockedRecipes = pawn?.unlocked?.recipes?.size ?? 0
    const commitment = pawn?.goals?.getGoalCommitmentDebug?.() ?? null

    const queueHtml = queue.map(goal =>
        `<div class="panel-quest-queue-item">
            <span class="panel-quest-text">${esc(goal?.description ?? goal?.type ?? 'goal')}</span>
            <span class="panel-quest-priority">p${goal?.priority ?? '?'}</span>
        </div>`
    ).join('')

    // #82: show commitment state so the active goal reads as stable, not flickering
    let commitmentHtml = ''
    if (commitment?.active) {
        const state = commitment.preemptible
            ? '<span class="panel-goal-state panel-goal-preemptible">flexible</span>'
            : `<span class="panel-goal-state panel-goal-committed">committed</span>`
        const invested = `<span class="panel-goal-invested">${commitment.investedTicks}t</span>`
        const lastSwitch = commitment.recentSwitches?.length
            ? `<div class="panel-goal-last-switch">last switch: ${esc(commitment.recentSwitches[commitment.recentSwitches.length - 1].reason)}</div>`
            : ''
        commitmentHtml = `<div class="panel-goal-commitment-row">${state}${invested}</div>${lastSwitch}`
    }

    return `
        <div class="panel-section">
            <div class="panel-section-header">Active Goal</div>
            <div class="panel-quest-active">${esc(currentGoal?.description ?? currentGoal?.type ?? 'none')}</div>
            ${commitmentHtml}
        </div>
        <div class="panel-section">
            <div class="panel-section-header">
                <span>Queue</span>
                <span class="panel-section-meta">${queue.length}</span>
            </div>
            ${queueHtml || '<div class="panel-empty">Queue empty</div>'}
        </div>
        <div class="panel-section">
            <div class="panel-section-header">Unlocks</div>
            <div class="panel-unlocks-row">
                <span>Goals: ${unlockedGoals}</span>
                <span>Recipes: ${unlockedRecipes}</span>
            </div>
        </div>
    `
}

function renderMap(pawn, world, renderer) {
    // Returns HTML with a canvas placeholder; actual drawing happens in updateMap
    return `<canvas class="panel-map-canvas" width="400" height="400"></canvas>
            <div class="panel-map-legend">
                <span class="panel-map-legend-item"><span class="panel-map-dot" style="background:#22c55e"></span>Trees</span>
                <span class="panel-map-legend-item"><span class="panel-map-dot" style="background:#14b8a6"></span>Bushes</span>
                <span class="panel-map-legend-item"><span class="panel-map-dot" style="background:#60a5fa"></span>Water</span>
                <span class="panel-map-legend-item"><span class="panel-map-dot" style="background:#f59e0b"></span>Animals</span>
                <span class="panel-map-legend-item"><span class="panel-map-dot" style="background:#a78bfa"></span>Caches</span>
                <span class="panel-map-legend-item"><span class="panel-map-dot" style="background:#f8fafc"></span>Pawns</span>
            </div>`
}

function drawMap(canvas, pawn, world) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, w, h)

    const centerX = pawn?.x ?? world.width * 0.5
    const centerY = pawn?.y ?? world.height * 0.5
    const radiusWorld = 240
    const scale = w / (radiusWorld * 2)

    const drawDot = (x, y, color, size = 2) => {
        const sx = (x - centerX) * scale + w * 0.5
        const sy = (y - centerY) * scale + h * 0.5
        if (sx < 0 || sy < 0 || sx > w || sy > h) return
        ctx.fillStyle = color
        ctx.fillRect(Math.round(sx - size / 2), Math.round(sy - size / 2), size, size)
    }

    const entities = Array.from(world.entitiesMap.values())
    for (const entity of entities) {
        if (!Number.isFinite(entity?.x) || !Number.isFinite(entity?.y)) continue
        if (Math.abs(entity.x - centerX) > radiusWorld || Math.abs(entity.y - centerY) > radiusWorld) continue

        if (entity.type === 'tree') { drawDot(entity.x, entity.y, '#22c55e', 2); continue }
        if (entity.type === 'bush') { drawDot(entity.x, entity.y, '#14b8a6', 2); continue }
        if (entity.subtype === 'water' || entity.tags?.includes?.('water') || entity.tags?.has?.('water')) { drawDot(entity.x, entity.y, '#60a5fa', 2); continue }
        if (entity.subtype === 'cache' || entity.tags?.includes?.('resource_cache') || entity.tags?.has?.('resource_cache')) { drawDot(entity.x, entity.y, '#a78bfa', 4); continue }
        if (entity.subtype === 'animal') { drawDot(entity.x, entity.y, '#f59e0b', 2); continue }
        if (entity.subtype === 'pawn') { drawDot(entity.x, entity.y, '#f8fafc', 3) }
    }

    // Range rings every 80 world units so distances can be eyeballed
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)'
    ctx.lineWidth = 1
    for (let r = 80; r <= radiusWorld; r += 80) {
        ctx.beginPath()
        ctx.arc(w * 0.5, h * 0.5, r * scale, 0, Math.PI * 2)
        ctx.stroke()
    }

    // Tracked pawn marker at center (ring + dot)
    ctx.strokeStyle = '#f8fafc'
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.5, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(w * 0.5 - 1.5, h * 0.5 - 1.5, 3, 3)

    // North indicator
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)'
    ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('N', w * 0.5, 4)

    ctx.strokeStyle = '#64748b'
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
    ctx.strokeStyle = '#334155'
    ctx.beginPath()
    ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, h)
    ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5)
    ctx.stroke()
}

function renderTechnology(pawn) {
    const skills = Object.entries(pawn?.skills ?? {})
        .filter(([, value]) => Number.isFinite(value) && value > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)

    const recipes = Array.from(pawn?.unlocked?.recipes ?? []).slice(0, 12)

    const skillsHtml = skills.map(([name, value]) =>
        `<div class="panel-tech-row"><span class="panel-tech-name">${esc(name)}</span><span class="panel-tech-value">${value.toFixed(2)}</span></div>`
    ).join('')

    const recipesHtml = recipes.map(r =>
        `<div class="panel-tech-recipe">${esc(r)}</div>`
    ).join('')

    return `
        <div class="panel-section">
            <div class="panel-section-header">
                <span>Known Skills</span>
                <span class="panel-section-meta">${skills.length}</span>
            </div>
            ${skillsHtml || '<div class="panel-empty">No active skills yet</div>'}
        </div>
        ${recipes.length ? `
        <div class="panel-section">
            <div class="panel-section-header">Recipes</div>
            ${recipesHtml}
        </div>` : ''}
    `
}

function renderRelationships(pawn) {
    const memberships = Object.entries(pawn?.reputation?.membership ?? {})
        .map(([group, value]) => `<div class="panel-rel-row"><span>${esc(group)}</span><span>${Number(value).toFixed(2)}</span></div>`)
        .slice(0, 12)

    const trust = Object.entries(pawn?.groupTrust ?? {})
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .slice(0, 8)
        .map(([id, value]) => `<div class="panel-rel-row"><span>${esc(id)}</span><span>${Number(value).toFixed(2)}</span></div>`)

    return `
        <div class="panel-section">
            <div class="panel-section-header">Group</div>
            <div class="panel-rel-info">
                <span>${esc(pawn?.groupState?.id ?? 'none')}</span>
                <span class="panel-rel-role">${esc(pawn?.groupState?.role ?? 'none')}</span>
            </div>
        </div>
        ${memberships.length ? `
        <div class="panel-section">
            <div class="panel-section-header">Membership</div>
            ${memberships.join('')}
        </div>` : ''}
        ${trust.length ? `
        <div class="panel-section">
            <div class="panel-section-header">Trust</div>
            ${trust.join('')}
        </div>` : ''}
    `
}

function renderCharacter(pawn) {
    const needs = getPawnNeeds(pawn)
    const currentGoal = pawn?.goals?.currentGoal
    const queue = Array.isArray(pawn?.goals?.goalQueue) ? pawn.goals.goalQueue.slice(0, 8) : []
    const recentSkills = Object.entries(pawn?.skills ?? {})
        .filter(([, value]) => Number.isFinite(value) && value > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)

    const name = pawn?.name ?? 'Wanderer'

    const nowMs = Date.now()
    const pawnKey = pawn?.id ?? pawn?.name ?? 'pawn'
    const needsHtml = needs.map(([needName, value]) => {
        const rounded = Math.round(value)
        const state = rounded >= 75 ? 'critical' : rounded >= 50 ? 'high' : rounded >= 25 ? 'medium' : 'low'
        const trend = computeTrend(`${pawnKey}:${needName}`, rounded, nowMs, needTrendSamples)
        return `
            <div class="panel-need-row">
                <span class="panel-need-label">${esc(needName)}</span>
                <div class="panel-need-bar-bg"><div class="panel-need-bar panel-need-${state}" style="width: ${rounded}%"></div></div>
                <span class="panel-need-value">${rounded}</span>
                ${trendGlyph(trend)}
            </div>
        `
    }).join('')

    const goalHtml = currentGoal
        ? `<div class="panel-char-goal-current"><span class="panel-char-goal-icon">▶</span><span>${esc(currentGoal.description ?? currentGoal.type ?? 'unknown')}</span></div>`
        : '<div class="panel-empty">No active goal</div>'

    const queueHtml = queue.map((goal, i) =>
        `<div class="panel-char-queue-item"><span class="panel-char-queue-index">${i + 1}.</span><span>${esc(goal.description ?? goal.type ?? 'goal')}</span></div>`
    ).join('')

    const skillsHtml = recentSkills.map(([skillName, value]) => {
        const meta = SKILL_META[skillName]
        const color = meta?.categoryColor ?? '#94a3b8'
        return `<div class="panel-char-skill-row"><span class="panel-char-skill-name" style="color: ${color}">${esc(skillName)}</span><span class="panel-char-skill-value">${value.toFixed(1)}</span></div>`
    }).join('')

    const behavior = pawn?.behaviorState ?? 'idle'
    const action = pawn?.recentAction ?? 'Idle'

    return `
        <div class="panel-section">
            <div class="panel-section-header">Identity</div>
            <div class="panel-char-name">${esc(name)}</div>
        </div>
        <div class="panel-section">
            <div class="panel-section-header">Status</div>
            <div class="panel-char-status"><span class="panel-char-behavior">${esc(behavior)}</span><span class="panel-char-action">${esc(action)}</span></div>
        </div>
        <div class="panel-section">
            <div class="panel-section-header">
                <span>Needs</span>
                <span class="panel-section-meta">urgency · ▲ worsening</span>
            </div>
            ${needsHtml || '<div class="panel-empty">Needs unavailable</div>'}
        </div>
        <div class="panel-section">
            <div class="panel-section-header">Goals</div>
            ${goalHtml}
            ${queueHtml ? `<div class="panel-char-queue-label">Queue</div>${queueHtml}` : ''}
        </div>
        <div class="panel-section">
            <div class="panel-section-header">Recent Skills</div>
            ${skillsHtml || '<div class="panel-empty">No skills developed yet</div>'}
        </div>
    `
}

function renderSkillsTree(pawn) {
    const pawnSkills = pawn?.skills ?? {}
    const desiredSkills = new Set()

    for (const [skillName] of Object.entries(pawnSkills)) {
        const meta = SKILL_META[skillName]
        if (meta?.children) {
            for (const childId of meta.children) {
                if (!(childId in pawnSkills) || (pawnSkills[childId] ?? 0) <= 0) {
                    desiredSkills.add(childId)
                }
            }
        }
    }

    let html = ''
    for (const [catId, cat] of Object.entries(SKILL_TREE)) {
        const catSkills = cat.skills.filter(s => {
            const value = pawnSkills[s.id] ?? 0
            return value > 0 || desiredSkills.has(s.id)
        })

        if (!catSkills.length) continue

        html += `<div class="panel-skill-category"><div class="panel-skill-category-header" style="color: ${cat.color}">${cat.label}</div><div class="panel-skill-grid">`

        for (const skill of catSkills) {
            const value = pawnSkills[skill.id] ?? 0
            const hasValue = value > 0
            const children = skill.children ?? []

            const childrenHtml = children.map(childId => {
                const childValue = pawnSkills[childId] ?? 0
                const childHasValue = childValue > 0
                const childMeta = SKILL_META[childId]
                const lineColor = hasValue && childHasValue ? cat.color : 'rgba(100, 116, 139, 0.3)'
                const childColor = childHasValue ? cat.color : 'rgba(148, 163, 184, 0.5)'
                return `
                    <div class="panel-skill-connector" style="border-color: ${lineColor}"></div>
                    <div class="panel-skill-node panel-skill-child" style="color: ${childColor}">
                        <span class="panel-skill-label">${childMeta?.label ?? childId}</span>
                        ${childHasValue ? `<span class="panel-skill-value">${childValue.toFixed(1)}</span>` : ''}
                    </div>
                `
            }).join('')

            html += `
                <div class="panel-skill-node ${hasValue ? 'panel-skill-active' : 'panel-skill-desired'}">
                    <span class="panel-skill-label">${skill.label}</span>
                    ${hasValue ? `<span class="panel-skill-value">${value.toFixed(1)}</span>` : '<span class="panel-skill-lock">🔒</span>'}
                    ${childrenHtml}
                </div>
            `
        }

        html += '</div></div>'
    }

    return html || '<div class="panel-empty">No skills developed or desired yet</div>'
}

// --- Panel Management ---

export function setupUiPanels(world, renderer, playerMode, getTrackedPawn, onPanelOpen) {
    // Create backdrop
    const backdrop = document.createElement('div')
    backdrop.className = 'panel-backdrop'
    backdrop.id = 'panel-backdrop'

    // Create container for panels
    const container = document.createElement('div')
    container.className = 'panel-container'
    container.id = 'panel-container'

    // Create each panel
    const panels = new Map()
    for (const def of PANEL_DEFS) {
        const panel = document.createElement('div')
        panel.className = 'panel'
        panel.id = `panel-${def.id}`
        panel.dataset.panelId = def.id
        panel.style.display = 'none' // All panels hidden by default

        panel.innerHTML = `
            <header class="panel-header">
                <h2 class="panel-title">${def.icon} ${def.title}</h2>
                <button class="panel-close" aria-label="Close panel">✕</button>
            </header>
            <div class="panel-body"></div>
            <footer class="panel-footer">
                <span class="panel-key-hint">[${def.key.toUpperCase()}]</span>
            </footer>
        `

        container.appendChild(panel)
        panels.set(def.id, {
            def,
            panel,
            body: panel.querySelector('.panel-body'),
            header: panel.querySelector('.panel-header'),
        })

        panel.querySelector('.panel-close').addEventListener('click', () => closeAll())
    }

    backdrop.appendChild(container)
    document.body.appendChild(backdrop)

    // Ensure backdrop is hidden initially (CSS should handle this, but be explicit)
    backdrop.style.display = 'none'
    backdrop.style.opacity = '0'
    backdrop.style.pointerEvents = 'none'

    let activePanelId = null
    let mapCanvas = null
    let closeTimerId = null

    // Panels used to rebuild innerHTML every animation frame, which reset scroll
    // position, defeated CSS transitions, and burned CPU. Instead: repaint at a
    // fixed cadence and only touch the DOM when the rendered content changed.
    const RENDER_INTERVAL_MS = 125
    const lastRenderedHtml = new Map()
    let lastRenderAt = 0

    function trackedPawn() {
        return getTrackedPawn?.() ?? playerMode?.trackedPawn ?? null
    }

    function applyHtml(id, body, html, force) {
        if (!force && lastRenderedHtml.get(id) === html) return
        lastRenderedHtml.set(id, html)
        body.innerHTML = html
    }

    function renderPanel(id, force = false) {
        const entry = panels.get(id)
        if (!entry) return
        const { body } = entry
        const pawn = trackedPawn()

        if (id === 'map') {
            if (!mapCanvas) {
                body.innerHTML = renderMap(pawn, world, renderer)
                mapCanvas = body.querySelector('.panel-map-canvas')
            }
            if (mapCanvas) drawMap(mapCanvas, pawn, world)
            return
        }

        if (!pawn) {
            applyHtml(id, body, '<div class="panel-empty">No tracked pawn</div>', force)
            return
        }

        let html
        switch (id) {
            case 'inventory':
                html = renderInventory(pawn, world)
                break
            case 'journal':
                html = renderJournal(pawn)
                break
            case 'quest':
                html = renderQuest(pawn)
                break
            case 'technology':
                html = renderTechnology(pawn)
                break
            case 'relationships':
                html = renderRelationships(pawn)
                break
            case 'character':
                html = renderCharacter(pawn)
                break
            case 'skills':
                html = renderSkillsTree(pawn)
                break
            default:
                html = '<div class="panel-empty">Unknown panel</div>'
        }
        applyHtml(id, body, html, force)
    }

    function openPanel(id) {
        if (activePanelId === id) {
            closeAll()
            return
        }
        // Hide previous panel immediately without animation/timer
        if (closeTimerId) {
            clearTimeout(closeTimerId)
            closeTimerId = null
        }
        if (activePanelId) {
            const prev = panels.get(activePanelId)
            if (prev) prev.panel.style.display = 'none'
        }

        const entry = panels.get(id)
        if (!entry) return

        activePanelId = id
        entry.panel.style.display = 'flex'
        backdrop.style.display = 'flex'
        backdrop.style.opacity = '0'
        backdrop.style.pointerEvents = 'none'
        requestAnimationFrame(() => {
            backdrop.style.opacity = '1'
            backdrop.style.pointerEvents = 'auto'
        })
        renderPanel(id, true)
        onPanelOpen?.(id)
    }

    function closeAll(updateActive = true) {
        if (closeTimerId) {
            clearTimeout(closeTimerId)
            closeTimerId = null
        }

        backdrop.style.opacity = '0'
        backdrop.style.pointerEvents = 'none'
        closeTimerId = setTimeout(() => {
            closeTimerId = null
            backdrop.style.display = 'none'
            backdrop.style.opacity = '0'
            backdrop.style.pointerEvents = 'none'
            for (const [, entry] of panels) {
                entry.panel.style.display = 'none'
            }
        }, 200)
        if (updateActive) activePanelId = null
    }

    function toggleByKey(key) {
        const def = PANEL_MAP.get(key)
        if (!def) return false
        if (activePanelId === def.id) {
            closeAll()
        } else {
            openPanel(def.id)
        }
        return true
    }

    function updateActivePanel(now) {
        if (activePanelId && now - lastRenderAt >= RENDER_INTERVAL_MS) {
            lastRenderAt = now
            renderPanel(activePanelId)
        }
        requestAnimationFrame(updateActivePanel)
    }

    requestAnimationFrame(updateActivePanel)

    return {
        toggleByKey,
        openPanel,
        closeAll,
        get activePanelId() { return activePanelId },
        labels: PANEL_DEFS.map(d => `${d.key.toUpperCase()}: ${d.title}`).join(' | '),
    }
}
