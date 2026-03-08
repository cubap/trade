/**
 * Interaction Panel — surfaces phase-gated pawn interaction controls.
 *
 * Controls shown depend on the active `interactionControls` capability module:
 *   nudge_need_focus   (phase1+): buttons to boost a need so the pawn prioritises it
 *   goal_pin_local     (phase2+): pin the pawn's current position as a local waypoint
 *   goal_pin_route     (phase2+): save a snapshot label for the current route trace
 *   waypoint_place     (phase3/overseer): place a named waypoint at pawn position
 *   waypoint_edit      (overseer): inline-edit an existing waypoint label
 *   waypoint_remove    (overseer): remove an existing waypoint from the list
 *
 * The panel is invisible when no pawn is tracked or no controls are applicable.
 */

// Needs that can be nudged from the HUD; ordered by display priority.
// Only needs present in pawn.needs.needs are shown — missing keys are silently skipped.
const NUDGEABLE_NEEDS = ['hunger', 'thirst', 'energy', 'safety', 'purpose']

// Amount added to a need urgency when the player nudges it.
const NUDGE_BOOST = 30

// Maximum number of local pins stored before the oldest is evicted.
const MAX_LOCAL_PINS = 20

const PANEL_STYLE = `
    position: fixed;
    bottom: 120px;
    left: 10px;
    background: rgba(15, 23, 42, 0.82);
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 5px;
    padding: 8px 10px;
    font-family: monospace;
    font-size: 12px;
    color: #e2e8f0;
    z-index: 900;
    min-width: 190px;
    max-width: 270px;
    display: none;
`

const BTN_BASE = `
    display: block;
    width: 100%;
    margin-top: 3px;
    padding: 3px 6px;
    font-size: 11px;
    cursor: pointer;
    background: rgba(30, 41, 59, 0.85);
    color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 3px;
    text-align: left;
`

const INPUT_BASE = `
    width: 100%;
    box-sizing: border-box;
    padding: 3px 5px;
    font-size: 11px;
    background: rgba(30, 41, 59, 0.85);
    color: #e2e8f0;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 3px;
    margin-top: 3px;
`

function sectionHeader(text) {
    const el = document.createElement('div')
    el.style.cssText = 'font-size: 10px; color: #94a3b8; letter-spacing: 0.05em; margin-top: 6px; margin-bottom: 2px;'
    el.textContent = text
    return el
}

/**
 * Create and mount the interaction panel.
 *
 * @param {object} playerMode  PlayerMode instance (for pinLocation / waypoint APIs).
 * @returns {{ update(pawn, interactionControls): void }}
 */
export function setupInteractionPanel(playerMode) {
    const container = document.createElement('div')
    container.id = 'interaction-panel'
    container.style.cssText = PANEL_STYLE
    document.body.appendChild(container)

    // Counter for human-readable route pin labels (route-1, route-2, …)
    let _routePinCounter = 0

    // ── Rendering ──────────────────────────────────────────────────────────────

    function renderPanel(pawn, controls) {
        container.innerHTML = ''

        if (!pawn || !Array.isArray(controls) || controls.length === 0) {
            container.style.display = 'none'
            return
        }

        container.style.display = 'block'

        const header = document.createElement('div')
        header.style.cssText = 'font-weight: bold; font-size: 11px; color: #94a3b8; margin-bottom: 5px; letter-spacing: 0.06em;'
        header.textContent = 'INTERACTION'
        container.appendChild(header)

        // ── nudge_need_focus ──────────────────────────────────────────────────

        if (controls.includes('nudge_need_focus')) {
            container.appendChild(sectionHeader('Nudge need ▾'))
            const needs = pawn.needs?.needs ?? {}
            for (const need of NUDGEABLE_NEEDS) {
                if (!(need in needs)) continue
                const urgency = Math.round(needs[need] ?? 0)
                const btn = document.createElement('button')
                btn.style.cssText = BTN_BASE
                btn.textContent = `${need} (${urgency})`
                btn.title = `Boost ${need} urgency by ${NUDGE_BOOST} pts`
                btn.onclick = () => {
                    if (pawn.needs?.needs && need in pawn.needs.needs) {
                        pawn.needs.needs[need] = Math.min(100, (pawn.needs.needs[need] ?? 0) + NUDGE_BOOST)
                    }
                }
                container.appendChild(btn)
            }
        }

        // ── goal_pin_local ────────────────────────────────────────────────────

        if (controls.includes('goal_pin_local')) {
            container.appendChild(sectionHeader('Pin location'))
            const btn = document.createElement('button')
            btn.style.cssText = BTN_BASE
            btn.textContent = '📍 Pin current position'
            btn.title = 'Save pawn position as a local pin'
            btn.onclick = () => {
                if (!pawn) return
                playerMode.pinLocation(pawn.x, pawn.y, 'pin')
            }
            container.appendChild(btn)
        }

        // ── goal_pin_route ────────────────────────────────────────────────────

        if (controls.includes('goal_pin_route')) {
            container.appendChild(sectionHeader('Pin route'))
            const btn = document.createElement('button')
            btn.style.cssText = BTN_BASE
            btn.textContent = '🗺 Save current route'
            btn.title = 'Capture the current route trace as a saved route'
            btn.onclick = () => {
                if (!pawn) return
                _routePinCounter += 1
                const label = `route-${_routePinCounter}`
                playerMode.pinLocation(pawn.x, pawn.y, label)
            }
            container.appendChild(btn)
        }

        // ── waypoint_place ────────────────────────────────────────────────────

        if (controls.includes('waypoint_place')) {
            container.appendChild(sectionHeader('Place waypoint'))
            const labelInput = document.createElement('input')
            labelInput.type = 'text'
            labelInput.placeholder = 'Label…'
            labelInput.style.cssText = INPUT_BASE

            const placeBtn = document.createElement('button')
            placeBtn.style.cssText = BTN_BASE
            placeBtn.textContent = '＋ Place at pawn position'
            placeBtn.onclick = () => {
                if (!pawn) return
                const label = labelInput.value.trim() || 'waypoint'
                playerMode.addWaypoint(pawn.x, pawn.y, label)
                labelInput.value = ''
            }

            container.appendChild(labelInput)
            container.appendChild(placeBtn)
        }

        // ── waypoint_edit / waypoint_remove ───────────────────────────────────

        if (controls.includes('waypoint_remove') || controls.includes('waypoint_edit')) {
            const waypoints = playerMode.mapWaypoints ?? []
            if (waypoints.length > 0) {
                container.appendChild(sectionHeader('Waypoints'))

                for (const wp of waypoints.slice(0, 6)) {
                    const row = document.createElement('div')
                    row.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-top: 3px;'

                    if (controls.includes('waypoint_edit')) {
                        const editInput = document.createElement('input')
                        editInput.type = 'text'
                        editInput.value = wp.label || ''
                        editInput.style.cssText = 'flex: 1; padding: 2px 4px; font-size: 10px; background: rgba(30,41,59,0.85); color: #e2e8f0; border: 1px solid rgba(148,163,184,0.3); border-radius: 3px;'
                        editInput.onchange = () => {
                            wp.label = editInput.value.trim() || wp.label
                        }
                        row.appendChild(editInput)
                    } else {
                        const labelEl = document.createElement('span')
                        labelEl.textContent = wp.label || `wp-${wp.id}`
                        labelEl.style.cssText = 'flex: 1; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
                        row.appendChild(labelEl)
                    }

                    if (controls.includes('waypoint_remove')) {
                        const removeBtn = document.createElement('button')
                        removeBtn.textContent = '✕'
                        removeBtn.title = 'Remove waypoint'
                        removeBtn.style.cssText = 'padding: 1px 5px; font-size: 10px; cursor: pointer; background: rgba(127,29,29,0.65); color: #fca5a5; border: 1px solid #f87171; border-radius: 3px; flex-shrink: 0;'
                        removeBtn.onclick = () => playerMode.removeWaypoint(wp.id)
                        row.appendChild(removeBtn)
                    }

                    container.appendChild(row)
                }
            }
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Refresh the panel contents for the given pawn and active controls list.
     *
     * @param {object|null} pawn               Tracked pawn or null.
     * @param {string[]|null} interactionControls  Capability module list.
     */
    function update(pawn, interactionControls) {
        renderPanel(pawn, interactionControls ?? [])
    }

    return { container, update }
}
