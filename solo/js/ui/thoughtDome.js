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
    let lastThoughtSequence = -1 // Track by thoughtSequence counter, not log length

    // Thought queue entries
    const thoughtEntries = [] // { el, text, tick, age, y, opacity, priority }
    const FADE_DURATION = 10 // seconds for a thought to fade out
    const PRIORITY_FADE_DURATION = 18 // seconds for priority thoughts
    const MAX_VISIBLE = 3 // Max thoughts visible at once
    const THOUGHT_SPACING = 32 // px between stacked thoughts

    function removeEntry(entry) {
        entry.el.remove()
        const idx = thoughtEntries.indexOf(entry)
        if (idx !== -1) thoughtEntries.splice(idx, 1)
    }

    function addThoughtEntry(text, tick, isPriority) {
        // If this text is already displayed, don't add a duplicate entry
        const alreadyShown = thoughtEntries.find(e => e.text === text)
        if (alreadyShown) {
            // Refresh its timer so it stays visible
            alreadyShown.birthTime = performance.now()
            if (isPriority) alreadyShown.priority = true
            return
        }

        // If priority, dismiss any non-priority entries to make room
        if (isPriority) {
            for (let i = thoughtEntries.length - 1; i >= 0; i--) {
                if (!thoughtEntries[i].priority) {
                    removeEntry(thoughtEntries[i])
                    break // Remove one non-priority at a time per priority arrival
                }
            }
        }

        const el = document.createElement('p')
        el.className = 'thought-entry'
        if (isPriority) el.classList.add('thought-entry--priority')
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
            birthTime: performance.now(),
            priority: !!isPriority
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

            const duration = entry.priority ? PRIORITY_FADE_DURATION : FADE_DURATION

            // Fade in quickly (0.5s), then hold, then fade out over remaining time
            if (entry.age < 0.5) {
                // Fade in
                entry.el.style.opacity = String(entry.age / 0.5)
            } else if (entry.age > duration - 2) {
                // Fade out in last 2 seconds
                entry.el.style.opacity = String(Math.max(0, (duration - entry.age) / 2))
            } else {
                // Fully visible
                entry.el.style.opacity = '1'
            }

            // Position: newest at bottom, older entries stacked upward by index
            const stackIndex = thoughtEntries.length - 1 - i // 0 = newest (bottom)
            entry.el.style.bottom = `${stackIndex * THOUGHT_SPACING}px`

            // Remove fully faded entries
            if (entry.age > duration) {
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
        const seq = pawn.thoughtSequence ?? 0
        if (seq > lastThoughtSequence) {
            // New thought(s) arrived — show the most recent one
            const log = pawn.thoughtLog ?? []
            const latest = log[log.length - 1]
            if (latest) {
                const thoughtTextContent = typeof latest === 'string' ? latest : latest.text
                if (thoughtTextContent) {
                    const isPriority = latest.priority ?? false
                    addThoughtEntry(thoughtTextContent, latest.tick ?? 0, isPriority)
                    lastThoughtSequence = seq
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
