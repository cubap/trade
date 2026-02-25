import { MODES, OVERSEER_SKILL_THRESHOLD, GOD_SKILL_THRESHOLD } from '../core/PlayerMode.js'

const MODE_LABELS = {
    [MODES.PAWN]: '🧍 Pawn',
    [MODES.OVERSEER]: '👁 Overseer',
    [MODES.GOD]: '🌐 God'
}

const MODE_DESCRIPTIONS = {
    [MODES.PAWN]: `Follow your pawn. Personal HUD only.\nUnlocked by default.`,
    [MODES.OVERSEER]: `Wider view + map waypoints.\nUnlocks at ${OVERSEER_SKILL_THRESHOLD} total skill.`,
    [MODES.GOD]: `Full world view + trade overlay.\nUnlocks at ${GOD_SKILL_THRESHOLD} total skill with group membership.`
}

/**
 * Build and mount the mode-switcher toolbar strip.
 *
 * @param {PlayerMode} playerMode
 * @param {HTMLElement} container  Element to append buttons into.
 * @returns {{ update: () => void }}  Call update() after mode or skill changes.
 */
export function setupModeSwitcher(playerMode, container) {
    const wrapper = document.createElement('span')
    wrapper.id = 'mode-switcher'
    wrapper.style.cssText = 'display:inline-flex;gap:4px;align-items:center;margin-left:12px;'

    const label = document.createElement('span')
    label.style.cssText = 'color:#94a3b8;font-size:12px;font-family:monospace;'
    label.textContent = 'Mode:'
    wrapper.appendChild(label)

    const buttons = {}

    for (const mode of Object.values(MODES)) {
        const btn = document.createElement('button')
        btn.textContent = MODE_LABELS[mode]
        btn.title = MODE_DESCRIPTIONS[mode]
        btn.dataset.mode = mode
        btn.style.cssText = `
            padding: 3px 8px;
            font-size: 12px;
            border-radius: 4px;
            border: 1px solid #4b5563;
            background: #1f2937;
            color: #cbd5e1;
            cursor: pointer;
            opacity: 0.5;
        `
        btn.onclick = () => {
            const switched = playerMode.switchMode(mode)
            if (!switched) {
                // Flash to indicate locked
                btn.style.outline = '2px solid #ef4444'
                setTimeout(() => { btn.style.outline = '' }, 600)
            }
        }
        buttons[mode] = btn
        wrapper.appendChild(btn)
    }

    container.appendChild(wrapper)

    // Badge showing next unlock hint
    const hint = document.createElement('div')
    hint.id = 'mode-unlock-hint'
    hint.style.cssText = `
        position: fixed;
        bottom: 50px;
        right: 10px;
        background: rgba(30,30,40,0.85);
        color: #94a3b8;
        padding: 5px 10px;
        border-left: 3px solid #3b82f6;
        font-size: 11px;
        font-family: monospace;
        border-radius: 4px;
        display: none;
        z-index: 1100;
    `
    document.body.appendChild(hint)

    function update() {
        const unlocked = playerMode.getUnlockedModes()
        const current = playerMode.currentMode

        for (const [mode, btn] of Object.entries(buttons)) {
            const isUnlocked = unlocked.has(mode)
            const isActive = mode === current
            btn.style.opacity = isUnlocked ? '1' : '0.35'
            btn.style.background = isActive ? '#1e40af' : '#1f2937'
            btn.style.color = isActive ? '#fff' : '#cbd5e1'
            btn.style.borderColor = isActive ? '#3b82f6' : '#4b5563'
            btn.title = MODE_DESCRIPTIONS[mode] + (isUnlocked ? '' : ' [LOCKED]')
        }

        // Show next-unlock hint if not everything is unlocked
        if (!unlocked.has(MODES.GOD)) {
            const pawn = playerMode.trackedPawn
            const total = pawn ? Object.values(pawn.skills || {}).reduce((s, v) => s + (v || 0), 0) : 0
            if (!unlocked.has(MODES.OVERSEER)) {
                hint.textContent = `Overseer unlocks at ${OVERSEER_SKILL_THRESHOLD} total skill (now ${total})`
                hint.style.display = 'block'
            } else {
                const hasMembership = pawn?.reputation?.membership &&
                    Object.keys(pawn.reputation.membership).length > 0
                if (!hasMembership) {
                    hint.textContent = `God mode unlocks at ${GOD_SKILL_THRESHOLD} skill + group membership (now ${total})`
                } else {
                    hint.textContent = `God mode unlocks at ${GOD_SKILL_THRESHOLD} total skill (now ${total})`
                }
                hint.style.display = 'block'
            }
        } else {
            hint.style.display = 'none'
        }
    }

    // Keep buttons in sync whenever the mode changes
    playerMode.onModeChange(update)

    // Initial render
    update()

    return { update }
}
