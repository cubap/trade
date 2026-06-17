/**
 * Tip Callouts — dismissible tutorial tips that appear on the left side
 * as the player discovers game features.
 *
 * Each tip fires once, stacks on the left, and can be dismissed with
 * right-click or when the related panel is opened.
 */

const TIP_DEFS = [
    {
        id: 'inventory',
        key: 'i',
        text: 'You picked up a stick! Use <kbd>I</kbd> to see what you are carrying.',
        trigger: (pawn) => (pawn?.inventory?.length ?? 0) > 0,
    },
    {
        id: 'journal',
        key: 'j',
        text: 'You have a lot to think about. Press <kbd>J</kbd> to reflect.',
        trigger: (pawn) => (pawn?.thoughtLog?.length ?? 0) >= 3,
    },
    {
        id: 'quest',
        key: 'q',
        text: 'Planning for success includes setting clear goals. See your current quest with <kbd>Q</kbd>.',
        trigger: (pawn) => (pawn?.goals?.completedGoals?.length ?? 0) > 0,
    },
    {
        id: 'map',
        key: 'm',
        text: 'Exploring has made the world feel smaller. Press <kbd>M</kbd> to get an idea.',
        trigger: (pawn) => {
            const landmarks = pawn?.memoryMap?.length ?? 0
            const distance = getTraveledDistance(pawn)
            return landmarks >= 2 || distance > 60
        },
    },
    {
        id: 'technology',
        key: 't',
        text: 'You crafted something! Press <kbd>T</kbd> to see what you know.',
        trigger: (pawn) => (pawn?.craftingHistory?.length ?? 0) > 0,
    },
    {
        id: 'relationships',
        key: 'r',
        text: 'You formed a bond with another. Press <kbd>R</kbd> to see your relationships.',
        trigger: (pawn) => {
            const trust = pawn?.trust ?? {}
            const bonds = Object.values(trust).filter(v => (v ?? 0) > 30).length
            const socialThoughts = (pawn?.thoughtLog ?? []).filter(t => t?.tag === 'social').length
            return bonds > 0 || socialThoughts >= 2
        },
    },
    {
        id: 'character',
        key: 'c',
        text: 'You have a name now. Press <kbd>C</kbd> to see who you are.',
        trigger: (pawn) => {
            const name = pawn?.name ?? ''
            return name && name !== 'Wanderer' && name !== 'Player'
        },
    },
    {
        id: 'skills',
        key: 's',
        text: 'You are learning fast. Press <kbd>S</kbd> to see your skills tree.',
        trigger: (pawn) => {
            const skills = pawn?.skills ?? {}
            const learned = Object.values(skills).filter(v => (v ?? 0) > 0).length
            return learned >= 3
        },
    },
]

function getTraveledDistance(pawn) {
    const spawnX = pawn?.spawnX ?? pawn?.x ?? 0
    const spawnY = pawn?.spawnY ?? pawn?.y ?? 0
    return Math.hypot((pawn?.x ?? 0) - spawnX, (pawn?.y ?? 0) - spawnY)
}

const TIP_CONTAINER_STYLE = `
    position: fixed;
    top: 80px;
    left: 16px;
    z-index: 1300;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    max-width: 300px;
`

const TIP_CARD_STYLE = `
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(94, 196, 192, 0.25);
    border-radius: 8px;
    padding: 12px 16px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13px;
    line-height: 1.5;
    color: #c8c0cc;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    opacity: 0;
    transform: translateX(-20px);
    transition: opacity 0.4s ease, transform 0.4s ease;
    pointer-events: auto;
    cursor: default;
    user-select: none;
`

const TIP_KBD_STYLE = `
    background: rgba(94, 196, 192, 0.15);
    border: 1px solid rgba(94, 196, 192, 0.3);
    border-radius: 3px;
    padding: 1px 5px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12px;
    color: #5ec4c0;
`

export function setupTipCallouts(pawnGetter, onPanelOpen) {
    const container = document.createElement('div')
    container.id = 'tip-callouts'
    container.style.cssText = TIP_CONTAINER_STYLE
    document.body.appendChild(container)

    const shownTips = new Set()
    const activeTips = [] // { el, def, birthTime }

    function addTip(def) {
        if (shownTips.has(def.id)) return
        shownTips.add(def.id)

        const el = document.createElement('div')
        el.className = 'tip-card'
        el.style.cssText = TIP_CARD_STYLE
        el.innerHTML = def.text.replace(/<kbd>/g, `<span class="tip-kbd" style="${TIP_KBD_STYLE}">`).replace(/<\/kbd>/g, '</span>')

        // Right-click to dismiss
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            dismissTip(el)
        })

        container.appendChild(el)
        activeTips.push({ el, def, birthTime: performance.now() })

        // Fade in
        requestAnimationFrame(() => {
            el.style.opacity = '1'
            el.style.transform = 'translateX(0)'
        })

        // Auto-dismiss after 15 seconds
        setTimeout(() => dismissTip(el), 15000)
    }

    function dismissTip(el) {
        const idx = activeTips.findIndex(t => t.el === el)
        if (idx === -1) return

        el.style.opacity = '0'
        el.style.transform = 'translateX(-20px)'

        setTimeout(() => {
            el.remove()
            const removed = activeTips.splice(idx, 1)[0]
            if (removed) {
                // Mark as shown so it won't reappear
                shownTips.add(removed.def.id)
            }
        }, 400)
    }

    function dismissByPanelId(panelId) {
        const idx = activeTips.findIndex(t => t.def.id === panelId)
        if (idx !== -1) {
            dismissTip(activeTips[idx].el)
        }
    }

    function update() {
        const pawn = pawnGetter?.()
        if (!pawn) return

        for (const def of TIP_DEFS) {
            if (shownTips.has(def.id)) continue
            if (def.trigger(pawn)) {
                addTip(def)
            }
        }
    }

    return { update, dismissByPanelId, container }
}
