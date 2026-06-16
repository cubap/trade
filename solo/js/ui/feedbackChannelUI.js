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

// ── Demoted to logging only — no visual toasts or panels ──────────────────────

function showToast({ text, accentColor = '#38bdf8' }) {
    console.log(`[feedback] ${text}`)
}

function showCapabilityReflection(payload) {
    const phase = payload?.phase ?? 'unknown'
    const modules = payload?.modules ?? {}
    console.log(`[feedback] Phase transition: ${phase.replace(/_/g, ' ')}`, {
        camera: modules.validCamera,
        minimap: modules.minimap,
        controls: Array.isArray(modules.interactionControls) ? modules.interactionControls : []
    })
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
