/**
 * Feedback Channel UI — lightweight notification layer wired to progression events.
 *
 * Supported channels (from capability `feedbackChannels`):
 *   intent_confirmation   — transient toast when the tracked pawn adopts a new goal.
 *   capability_reflection — summary panel shown briefly on phase transition.
 *   achievement_log       — enhanced achievement toasts for progression phase/unlock events.
 *
 * All notifications are passive: they show informational text and auto-dismiss.
 * No direct pawn commands are issued from here.
 */

const TOAST_DURATION_MS = 5000
const REFLECT_DURATION_MS = 8000

// ── Shared toast container ─────────────────────────────────────────────────────

function ensureToastContainer() {
    let c = document.getElementById('feedback-channel-toasts')
    if (c) return c

    c = document.createElement('div')
    c.id = 'feedback-channel-toasts'
    c.style.cssText = `
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        z-index: 1300;
        pointer-events: none;
        max-width: 420px;
    `
    document.body.appendChild(c)
    return c
}

function showToast({ text, accentColor = '#38bdf8', durationMs = TOAST_DURATION_MS }) {
    const container = ensureToastContainer()

    const el = document.createElement('div')
    el.style.cssText = `
        background: rgba(15, 23, 42, 0.88);
        color: #e2e8f0;
        padding: 7px 14px;
        border-left: 4px solid ${accentColor};
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        opacity: 0;
        transition: opacity 0.25s ease;
        pointer-events: auto;
        max-width: 400px;
        word-break: break-word;
    `
    el.textContent = text
    container.appendChild(el)

    requestAnimationFrame(() => { el.style.opacity = '1' })

    setTimeout(() => {
        el.style.opacity = '0'
        setTimeout(() => el.remove(), 300)
    }, durationMs)
}

// ── Capability reflection panel ────────────────────────────────────────────────

function showCapabilityReflection(payload) {
    const container = ensureToastContainer()

    const panel = document.createElement('div')
    panel.style.cssText = `
        background: rgba(15, 23, 42, 0.92);
        color: #e2e8f0;
        padding: 10px 14px;
        border: 1px solid rgba(99, 102, 241, 0.6);
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.6);
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: auto;
        max-width: 380px;
    `

    const phase = payload?.phase ?? 'unknown'
    const modules = payload?.modules ?? {}
    const camera = modules.validCamera ?? '—'
    const minimap = modules.minimap ?? 'none'
    const controls = Array.isArray(modules.interactionControls)
        ? modules.interactionControls.join(', ')
        : '—'

    panel.innerHTML = `
        <div style="font-weight:bold;color:#a5b4fc;margin-bottom:6px;">Phase transition: ${phase.replace(/_/g, ' ')}</div>
        <div>Camera: <span style="color:#7dd3fc;">${camera.replace(/_/g, ' ')}</span></div>
        <div>Minimap: <span style="color:#7dd3fc;">${minimap.replace(/_/g, ' ')}</span></div>
        <div style="margin-top:4px;color:#94a3b8;font-size:11px;">Controls: ${controls.replace(/_/g, ' ')}</div>
    `
    container.appendChild(panel)

    requestAnimationFrame(() => { panel.style.opacity = '1' })

    setTimeout(() => {
        panel.style.opacity = '0'
        setTimeout(() => panel.remove(), 400)
    }, REFLECT_DURATION_MS)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format a module value (string or string[]) for human-readable display. */
function formatModuleValue(value) {
    if (Array.isArray(value)) {
        return value.map(v => String(v).replace(/_/g, ' ')).join(', ')
    }
    return String(value).replace(/_/g, ' ')
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Set up the feedback channel UI.
 *
 * @param {object} progression  ProgressionController instance.
 * @returns {{ onProgressionPayload(payload, pawn): void }}
 *   Call `onProgressionPayload` each tick with the latest progression payload so
 *   intent_confirmation and other per-tick channels can update.
 */
export function setupFeedbackChannelUI(progression) {
    let lastGoalType = null
    let lastGoalDesc = null
    let lastPhase = null

    // ── Progression event listener ─────────────────────────────────────────────
    progression.onEvent(event => {
        if (event.type === 'capability_unlocked') {
            const changes = Array.isArray(event.changes) ? event.changes : []
            for (const change of changes) {
                showToast({
                    text: `Unlocked: ${String(change.module).replace(/_/g, ' ')} → ${formatModuleValue(change.to)}`,
                    accentColor: '#f59e0b',
                    durationMs: 6000
                })
            }
        }
    })

    /**
     * Called each tick with the latest progression payload and current tracked pawn.
     * Drives intent_confirmation and capability_reflection channels.
     *
     * @param {object|null} payload   Capability payload from ProgressionController.
     * @param {object|null} pawn      Currently tracked pawn.
     */
    function onProgressionPayload(payload, pawn) {
        if (!payload) return
        const channels = Array.isArray(payload.modules?.feedbackChannels)
            ? payload.modules.feedbackChannels
            : []

        // capability_reflection: show on phase transition
        if (channels.includes('capability_reflection') && payload.phase !== lastPhase) {
            if (lastPhase !== null) {
                showCapabilityReflection(payload)
            }
            lastPhase = payload.phase
        } else if (payload.phase !== lastPhase) {
            lastPhase = payload.phase
        }

        // intent_confirmation: notify when pawn starts a new goal
        if (channels.includes('intent_confirmation') && pawn) {
            const goal = pawn.goals?.currentGoal
            const goalType = goal?.type ?? null
            const goalDesc = goal?.description ?? null
            const changed = goalType !== lastGoalType || goalDesc !== lastGoalDesc

            if (changed && goalType) {
                const text = goalDesc ?? goalType.replace(/_/g, ' ')
                showToast({
                    text: `→ ${text}`,
                    accentColor: '#34d399',
                    durationMs: 4000
                })
            }
            lastGoalType = goalType
            lastGoalDesc = goalDesc
        }

        // achievement_log: surface via showToast on phase_entered (once stable)
        // (capability_unlocked path above handles per-module log entries)
    }

    return { onProgressionPayload }
}
