// Thought Queue — thought entries rendered over the 3D pawn model
// The pawn model (GLB head) replaces the old skull outline.
// This module only manages: thought queue entries, camera bob.

export function setupThoughtDome(pawnGetter, rendererGetter) {
    const container = document.createElement('div')
    container.id = 'thought-dome'

    // Thought queue — stacked thoughts that fade up
    const thoughtQueue = document.createElement('div')
    thoughtQueue.id = 'thought-queue'

    container.appendChild(thoughtQueue)
    document.body.appendChild(container)

    let camBobPhase = 0
    let lastThoughtIndex = -1 // Track by log length, not tick (multiple thoughts can share a tick)

    // Thought queue entries
    const thoughtEntries = [] // { el, text, tick, age, y, opacity }
    const FADE_DURATION = 10 // seconds for a thought to fade out
    const MAX_VISIBLE = 3 // Max thoughts visible at once
    const THOUGHT_SPACING = 32 // px between stacked thoughts

    function addThoughtEntry(text, tick) {
        const el = document.createElement('p')
        el.className = 'thought-entry'
        el.textContent = text
        // Start at the bottom of the queue area
        el.style.bottom = '0px'
        el.style.opacity = '0'
        thoughtQueue.appendChild(el)

        thoughtEntries.push({
            el,
            text,
            tick,
            age: 0,
            birthTime: performance.now()
        })

        // Remove old entries beyond max
        while (thoughtEntries.length > MAX_VISIBLE + 1) {
            const old = thoughtEntries.shift()
            old.el.remove()
        }
    }

    function updateThoughtEntries(dt) {
        const now = performance.now()

        for (let i = thoughtEntries.length - 1; i >= 0; i--) {
            const entry = thoughtEntries[i]
            entry.age = (now - entry.birthTime) / 1000 // seconds

            // Fade in quickly (0.5s), then hold, then fade out over remaining time
            if (entry.age < 0.5) {
                // Fade in
                entry.el.style.opacity = String(entry.age / 0.5)
            } else if (entry.age > FADE_DURATION - 2) {
                // Fade out in last 2 seconds
                entry.el.style.opacity = String(Math.max(0, (FADE_DURATION - entry.age) / 2))
            } else {
                // Fully visible
                entry.el.style.opacity = '1'
            }

            // Move older thoughts up from the bottom
            const ageRatio = Math.min(1, entry.age / 3) // Move up over first 3 seconds
            entry.el.style.bottom = `${ageRatio * THOUGHT_SPACING}px`

            // Remove fully faded entries
            if (entry.age > FADE_DURATION) {
                entry.el.remove()
                thoughtEntries.splice(i, 1)
            }
        }
    }

    function update() {
        const pawn = pawnGetter?.()
        if (!pawn) return

        const dt = 1 / 60 // ~60fps tick
        const now = performance.now()

        // --- Read latest thought from pawn's thoughtLog ---
        const log = pawn.thoughtLog ?? []
        if (log.length > lastThoughtIndex) {
            // New thought(s) arrived — show the most recent one
            const latest = log[log.length - 1]
            if (latest) {
                const thoughtTextContent = typeof latest === 'string' ? latest : latest.text
                if (thoughtTextContent) {
                    addThoughtEntry(thoughtTextContent, latest.tick ?? 0)
                    lastThoughtIndex = log.length - 1
                }
            }
        }

        // --- Update thought queue ---
        updateThoughtEntries(dt)

        // --- Camera bob — slightly out of sync, only when moving ---
        const isMoving = pawn.moving === true
        const renderer = rendererGetter?.()
        if (isMoving && renderer) {
            camBobPhase += 0.055
            const camBobY = Math.sin(camBobPhase + 0.8) * 2 // ±2px, phase offset
            renderer.fpsBobY = camBobY
        } else if (renderer) {
            renderer.fpsBobY = 0
        }

    }

    // Expose API
    return {
        update,
        element: container,
    }
}
