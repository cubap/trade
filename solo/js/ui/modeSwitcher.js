import { MODES } from '../core/PlayerMode.js'

const MODE_LABELS = {
    [MODES.PAWN]: '🧍 Pawn',
    [MODES.OVERSEER]: '👁 Overseer',
    [MODES.GOD]: '🌐 God'
}

const MODE_DESCRIPTIONS = {
    [MODES.PAWN]: `Locked pawn-follow view (2D fallback).\nTrue first-person unlocks with 3D renderer backend.`,
    [MODES.OVERSEER]: `Wider view + map waypoints.`,
    [MODES.GOD]: `Full world view + trade overlay.`
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
        // (Removed — unlock hints were too dramatic)
    }

    // Keep buttons in sync whenever the mode changes
    playerMode.onModeChange(update)

    // Initial render
    update()

    return { update }
}
