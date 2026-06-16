// Thought Dome HUD — through-the-head view
// The back of the pawn's skull frames the bottom of the screen.
// Thoughts appear inside the skull cavity. The skull outline bobs gently.

export function setupThoughtDome(pawnGetter) {
    const container = document.createElement('div')
    container.id = 'thought-dome'

    // The skull outline — frames the bottom of the screen
    const skull = document.createElement('div')
    skull.id = 'thought-skull'

    // Thought text — lives inside the skull cavity
    const thoughtText = document.createElement('p')
    thoughtText.id = 'thought-text'
    thoughtText.textContent = ''

    container.appendChild(skull)
    container.appendChild(thoughtText)
    document.body.appendChild(container)

    let currentThought = ''
    let thoughtOpacity = 0
    let thoughtFadeDir = 0 // 0 = idle, 1 = fade in, -1 = fade out
    let bobPhase = 0

    function setThought(text) {
        if (text === currentThought) return
        currentThought = text
        thoughtText.textContent = text
        thoughtFadeDir = 1 // fade in
        thoughtOpacity = 0
    }

    function update() {
        // Thought fade in/out
        if (thoughtFadeDir !== 0) {
            if (thoughtFadeDir === 1) {
                thoughtOpacity = Math.min(1, thoughtOpacity + 0.025)
                if (thoughtOpacity >= 1) thoughtFadeDir = 0
            } else if (thoughtFadeDir === -1) {
                thoughtOpacity = Math.max(0, thoughtOpacity - 0.03)
                if (thoughtOpacity <= 0) {
                    thoughtFadeDir = 0
                    thoughtText.textContent = ''
                }
            }
            thoughtText.style.opacity = thoughtOpacity
        }

        // Skull bob — gentle sine wave on the outline
        bobPhase += 0.04
        const bobY = Math.sin(bobPhase) * 4 // ±4px bob
        const bobRotate = Math.sin(bobPhase * 0.7) * 1 // slight tilt
        skull.style.transform = `translateY(${bobY}px) rotate(${bobRotate}deg)`

        // Health-based color shift on the skull outline
        const pawn = pawnGetter?.()
        if (pawn) {
            const health = pawn.traits?.health ?? 100
            const healthPct = Math.max(0, Math.min(1, health / (pawn.traits?.healthMax ?? 100)))
            const r = Math.round(60 + (1 - healthPct) * 90)
            const g = Math.round(50 + healthPct * 20)
            const b = Math.round(65 + healthPct * 25)
            skull.style.borderColor = `rgba(${r + 30},${g + 25},${b + 20},0.6)`
            skull.style.boxShadow = `inset 0 0 30px rgba(${r},${g},${b},0.15), 0 0 15px rgba(${r},${g},${b},0.1)`
        }
    }

    // Expose API
    return {
        setThought,
        update,
        element: container,
    }
}
