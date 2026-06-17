// Camera tuning panel — sliders to adjust over-the-shoulder camera position
export function setupCameraTuning(rendererGetter, controlsGetter) {
    const panel = document.createElement('div')
    panel.id = 'camera-tuning-panel'
    panel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(20, 18, 28, 0.9);
        border: 1px solid rgba(90, 75, 85, 0.5);
        border-radius: 8px;
        padding: 12px 16px;
        z-index: 200;
        font-family: Georgia, serif;
        font-size: 12px;
        color: #c8c0cc;
        min-width: 260px;
        display: none;
        max-height: 90vh;
        overflow-y: auto;
    `

    // --- Pause button ---
    const pauseRow = document.createElement('div')
    pauseRow.style.cssText = 'margin: 6px 0; display: flex; align-items: center; gap: 8px;'

    const pauseBtn = document.createElement('button')
    pauseBtn.textContent = '⏸ Pause'
    pauseBtn.style.cssText = `
        background: rgba(94, 196, 192, 0.2);
        border: 1px solid rgba(94, 196, 192, 0.5);
        border-radius: 4px;
        padding: 4px 12px;
        color: #5ec4c0;
        font-family: Georgia, serif;
        font-size: 12px;
        cursor: pointer;
    `
    pauseBtn.addEventListener('click', () => {
        const c = controlsGetter?.()
        if (c?.setPaused) {
            const isPaused = c.isPaused?.()
            c.setPaused(!isPaused)
            pauseBtn.textContent = isPaused ? '⏸ Pause' : '▶ Play'
            pauseBtn.style.borderColor = isPaused ? 'rgba(94, 196, 192, 0.5)' : 'rgba(192, 94, 94, 0.5)'
            pauseBtn.style.color = isPaused ? '#5ec4c0' : '#c46060'
        }
    })

    const pauseLabel = document.createElement('span')
    pauseLabel.textContent = '(freezes game loop)'
    pauseLabel.style.fontSize = '10px'
    pauseLabel.style.color = '#888'

    pauseRow.appendChild(pauseBtn)
    pauseRow.appendChild(pauseLabel)
    panel.appendChild(pauseRow)

    // Section divider
    panel.appendChild(createDivider('Camera'))

    // --- Camera sliders ---
    // Heights are relative to pawn model top (head level), not ground
    const cameraSliders = [
        { key: 'behindDistance', label: 'Behind', min: 0.5, max: 20, step: 0.1, default: 1.7 },
        { key: 'cameraHeight', label: 'Cam Height', min: -5, max: 10, step: 0.1, default: -0.1 },
        { key: 'lookDistance', label: 'Look Dist', min: 1, max: 100, step: 1, default: 9.0 },
        { key: 'lookHeight', label: 'Look Height', min: -2, max: 10, step: 0.1, default: 1.5 }
    ]

    for (const s of cameraSliders) {
        panel.appendChild(createSlider(s, rendererGetter))
    }

    panel.appendChild(createDivider('Pawn'))

    // --- Pawn sliders ---
    const pawnSliders = [
        { key: 'pawnScale', label: 'Scale', min: 0.1, max: 50, step: 0.5, default: 3.1 },
        { key: 'pawnYOffset', label: 'Y Offset', min: -5, max: 20, step: 0.1, default: -0.1 }
    ]

    for (const s of pawnSliders) {
        panel.appendChild(createSlider(s, rendererGetter))
    }

    // --- Reset button ---
    const resetBtn = document.createElement('button')
    resetBtn.textContent = '↺ Reset All'
    resetBtn.style.cssText = `
        display: block;
        width: 100%;
        margin-top: 10px;
        background: rgba(192, 94, 94, 0.15);
        border: 1px solid rgba(192, 94, 94, 0.4);
        border-radius: 4px;
        padding: 5px 12px;
        color: #c46060;
        font-family: Georgia, serif;
        font-size: 11px;
        cursor: pointer;
    `
    resetBtn.addEventListener('click', () => {
        const r = rendererGetter?.()
        if (!r) return
        r.cameraTuning.behindDistance = 1.7
        r.cameraTuning.cameraHeight = -0.1
        r.cameraTuning.lookDistance = 9.0
        r.cameraTuning.lookHeight = 1.5
        r.pawnTuning = r.pawnTuning || {}
        r.pawnTuning.pawnScale = 3.1
        r.pawnTuning.pawnYOffset = -0.1
        panel.querySelectorAll('input[type="range"]').forEach(input => {
            const key = input.dataset.key
            const defaults = {
                behindDistance: 1.7, cameraHeight: -0.1, lookDistance: 9.0, lookHeight: 1.5,
                pawnScale: 3.1, pawnYOffset: -0.1
            }
            if (defaults[key] !== undefined) {
                input.value = defaults[key]
                const valSpan = input.parentElement.querySelector('.slider-value')
                if (valSpan) valSpan.textContent = defaults[key].toFixed(1)
            }
        })
    })
    panel.appendChild(resetBtn)

    // --- Toggle button ---
    const toggle = document.createElement('button')
    toggle.textContent = '[C] Camera'
    toggle.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(20, 18, 28, 0.7);
        border: 1px solid rgba(90, 75, 85, 0.5);
        border-radius: 4px;
        padding: 4px 8px;
        color: #c8c0cc;
        font-family: Georgia, serif;
        font-size: 11px;
        cursor: pointer;
        z-index: 199;
    `

    let visible = false
    toggle.addEventListener('click', () => {
        visible = !visible
        panel.style.display = visible ? 'block' : 'none'
        toggle.style.display = visible ? 'none' : 'block'
    })

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 'c' || e.key === 'C') {
            if (e.target.tagName === 'INPUT') return
            toggle.click()
        }
        if (e.key === ' ' && e.target.tagName !== 'INPUT') {
            e.preventDefault()
            pauseBtn.click()
        }
    })

    document.body.appendChild(toggle)
    document.body.appendChild(panel)
}

function createDivider(label) {
    const div = document.createElement('div')
    div.style.cssText = 'border-top: 1px solid rgba(90, 75, 85, 0.3); margin: 10px 0 6px 0;'
    if (label) {
        const span = document.createElement('span')
        span.textContent = label
        span.style.cssText = 'display: block; margin-bottom: 4px; font-weight: bold; color: #a89aaa; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;'
        div.appendChild(span)
    }
    return div
}

function createSlider(s, rendererGetter) {
    const row = document.createElement('div')
    row.style.cssText = 'margin: 6px 0; display: flex; align-items: center; justify-content: space-between;'

    const label = document.createElement('span')
    label.textContent = s.label
    label.style.width = '70px'

    const input = document.createElement('input')
    input.type = 'range'
    input.min = s.min
    input.max = s.max
    input.step = s.step
    input.value = s.default
    input.dataset.key = s.key
    input.style.flex = '1'
    input.style.margin = '0 8px'

    const value = document.createElement('span')
    value.className = 'slider-value'
    value.textContent = s.default.toFixed(1)
    value.style.width = '45px'
    value.style.textAlign = 'right'

    input.addEventListener('input', () => {
        const v = parseFloat(input.value)
        value.textContent = v.toFixed(1)
        const r = rendererGetter?.()
        if (!r) return

        const key = s.key
        if (key === 'pawnScale' || key === 'pawnYOffset') {
            r.pawnTuning = r.pawnTuning || {}
            r.pawnTuning[key] = v
            if (key === 'pawnScale' && r._headMesh) {
                r._headMesh.scale.setScalar(v)
            }
        } else {
            r.cameraTuning[key] = v
        }
    })

    row.appendChild(label)
    row.appendChild(input)
    row.appendChild(value)
    return row
}
