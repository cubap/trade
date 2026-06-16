// Journal overlay — shows historic thoughts and messages
// Press J to toggle

export function setupJournal(pawnGetter) {
    const overlay = document.createElement('div')
    overlay.id = 'journal-overlay'
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(5, 5, 15, 0.85);
        z-index: 1600;
        display: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    `

    const panel = document.createElement('div')
    panel.id = 'journal-panel'
    panel.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 600px;
        height: 80%;
        background: rgba(15, 15, 30, 0.95);
        border: 1px solid rgba(94, 196, 192, 0.3);
        border-radius: 12px;
        padding: 24px;
        font-family: Georgia, serif;
        color: #c8c0cc;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    `

    // Header
    const header = document.createElement('div')
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;'

    const title = document.createElement('h2')
    title.textContent = '📖 Thought Journal'
    title.style.cssText = 'margin: 0; font-weight: normal; font-size: 18px; letter-spacing: 1px; color: #94a3b8;'

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = `
        background: rgba(192, 94, 94, 0.15);
        border: 1px solid rgba(192, 94, 94, 0.4);
        border-radius: 4px;
        padding: 4px 10px;
        color: #c46060;
        font-family: Georgia, serif;
        font-size: 14px;
        cursor: pointer;
    `
    closeBtn.addEventListener('click', toggle)

    header.appendChild(title)
    header.appendChild(closeBtn)
    panel.appendChild(header)

    // Scrollable thought list
    const list = document.createElement('div')
    list.id = 'journal-list'
    list.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding-right: 8px;
        scrollbar-width: thin;
    `
    panel.appendChild(list)

    // Footer with hint
    const footer = document.createElement('div')
    footer.style.cssText = 'margin-top: 12px; font-size: 11px; color: #64748b; text-align: center; font-style: italic;'
    footer.textContent = 'Press J to close • Thoughts are recorded as your pawn experiences the world'
    panel.appendChild(footer)

    overlay.appendChild(panel)
    document.body.appendChild(overlay)

    let visible = false

    function renderThoughts() {
        const pawn = pawnGetter?.()
        if (!pawn) return

        const thoughts = pawn.thoughtLog || []
        list.innerHTML = ''

        if (thoughts.length === 0) {
            const empty = document.createElement('p')
            empty.style.cssText = 'text-align: center; color: #64748b; font-style: italic; margin-top: 40px;'
            empty.textContent = 'No thoughts recorded yet.'
            list.appendChild(empty)
            return
        }

        // Render in reverse order (newest first)
        for (let i = thoughts.length - 1; i >= 0; i--) {
            const thought = thoughts[i]
            if (!thought) continue

            const entry = document.createElement('div')
            entry.style.cssText = `
                padding: 8px 12px;
                margin-bottom: 6px;
                background: rgba(30, 41, 59, 0.5);
                border-left: 2px solid rgba(94, 196, 192, 0.3);
                border-radius: 0 4px 4px 0;
                font-size: 13px;
                line-height: 1.4;
            `

            // Tag-based color accent
            const tag = thought.tag || 'general'
            const tagColors = {
                quiz: 'rgba(196, 192, 94, 0.5)',
                spawn: 'rgba(94, 196, 192, 0.5)',
                hardship: 'rgba(192, 94, 94, 0.5)',
                insight: 'rgba(94, 160, 196, 0.5)',
                social: 'rgba(196, 94, 160, 0.5)',
                epiphany: 'rgba(196, 160, 94, 0.5)',
                loss: 'rgba(120, 120, 120, 0.5)',
            }
            if (tagColors[tag]) {
                entry.style.borderLeftColor = tagColors[tag]
            }

            const text = document.createElement('p')
            text.style.cssText = 'margin: 0 0 4px 0; color: #cbd5e1;'
            text.textContent = thought.text

            const meta = document.createElement('span')
            meta.style.cssText = 'font-size: 10px; color: #64748b;'
            meta.textContent = `[tick ${thought.tick}] ${tag}`

            entry.appendChild(text)
            entry.appendChild(meta)
            list.appendChild(entry)
        }

        // Scroll to top (newest thoughts)
        list.scrollTop = 0
    }

    function toggle() {
        visible = !visible
        if (visible) {
            renderThoughts()
            overlay.style.display = 'block'
            requestAnimationFrame(() => {
                overlay.style.opacity = '1'
                overlay.style.pointerEvents = 'auto'
            })
        } else {
            overlay.style.opacity = '0'
            overlay.style.pointerEvents = 'none'
            setTimeout(() => {
                overlay.style.display = 'none'
            }, 300)
        }
    }

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 'j' || e.key === 'J') {
            if (e.target.tagName === 'INPUT') return
            toggle()
        }
        if (e.key === 'Escape' && visible) {
            toggle()
        }
    })

    return { toggle, element: overlay }
}
