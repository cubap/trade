import { createEntity } from './entityFactory.js'
import { setupStatsDisplay } from './statsDisplay.js'
import { setupFollowControls } from './followControls.js'
import { setupCanvasInteractions } from './canvasInteractions.js'
import { createEntitySummary } from './entitySummary.js'
import { setupKeyboardShortcuts } from './keyboardShortcuts.js'
import { setUnlockListener } from '../models/skills/UnlockEvents.js'
import { setupModeSwitcher } from './modeSwitcher.js'

function setupControls(world, renderer, playerMode) {
    const controlPanel = document.createElement('div')
    controlPanel.id = 'control-panel'
    controlPanel.style.margin = '10px 0'
    
    // Add entity type selector
    const typeSelect = document.createElement('select')
    typeSelect.style.marginLeft = '10px'
    
    // Add options for different entity types
    const entityTypes = [
        { value: 'pawn', label: 'Pawn' },
        { value: 'animal', label: 'Animal' }
    ]
    
    for (const type of entityTypes) {
        const option = document.createElement('option')
        option.value = type.value
        option.textContent = type.label
        typeSelect.appendChild(option)
    }
    
    // Add entity button
    const addButton = document.createElement('button')
    addButton.textContent = 'Add Entity'
    addButton.onclick = () => {
        const selectedType = typeSelect.value
        const entity = createEntity(selectedType, world)
        if (entity) world.addEntity(entity)
    }
    
    // Add pause button
    const pauseButton = document.createElement('button')
    pauseButton.textContent = 'Pause'
    pauseButton.style.marginLeft = '10px'
    let isPaused = false
    const setPaused = (value) => {
        const next = !!value
        if (next === isPaused) return
        isPaused = next
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause'
        if (isPaused) world.clock.pause()
        else world.clock.resume()
    }
    pauseButton.onclick = () => setPaused(!isPaused)
    
    // Add palette selector
    const paletteSelect = document.createElement('select')
    paletteSelect.style.marginLeft = '10px'
    
    for (const paletteName in renderer.colorPalettes) {
        const option = document.createElement('option')
        option.value = paletteName
        option.textContent = paletteName.charAt(0).toUpperCase() + paletteName.slice(1)
        paletteSelect.appendChild(option)
    }
    
    paletteSelect.value = renderer.activePalette
    paletteSelect.onchange = () => {
        renderer.activePalette = paletteSelect.value
    }
    
    // Add grid toggle button
    const gridButton = document.createElement('button')
    gridButton.textContent = 'Toggle Grid'
    gridButton.style.marginLeft = '10px'
    gridButton.onclick = () => {
        renderer.showGrid = !renderer.showGrid
        gridButton.textContent = renderer.showGrid ? 'Hide Grid' : 'Show Grid'
    }
    
    // Add chunk toggle button
    const chunkButton = document.createElement('button')
    chunkButton.textContent = 'Show Chunks'
    chunkButton.style.marginLeft = '10px'
    chunkButton.onclick = () => {
        renderer.showChunks = !renderer.showChunks
        chunkButton.textContent = renderer.showChunks ? 'Hide Chunks' : 'Show Chunks'
    }
    
    // Follow and perception controls
    const { followButton, perceptionButton, recenterButton } = setupFollowControls(world, renderer)
    
    // Add controls to panel
    controlPanel.appendChild(typeSelect)
    controlPanel.appendChild(addButton)
    controlPanel.appendChild(pauseButton)
    controlPanel.appendChild(paletteSelect)
    controlPanel.appendChild(gridButton)
    controlPanel.appendChild(chunkButton)
    controlPanel.appendChild(followButton)
    controlPanel.appendChild(perceptionButton)
    controlPanel.appendChild(recenterButton)

    // Mode switcher (pawn / overseer / god) — only mount if playerMode is provided
    let modeSwitcher = null
    if (playerMode) {
        modeSwitcher = setupModeSwitcher(playerMode, controlPanel)
    }
    
    // Insert into DOM
    document.body.appendChild(controlPanel)
    // Stats display
    setupStatsDisplay(world, renderer)
    // Canvas interactions
    setupCanvasInteractions(world, renderer, createEntitySummary)
    // Keyboard shortcuts
    setupKeyboardShortcuts(world, renderer, followButton, perceptionButton, () => {}, null)
    
    // Create help text
    const helpText = document.createElement('div')
    helpText.id = 'camera-help'
    helpText.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-size: 12px;
        font-family: monospace;
        z-index: 1000;
        display: none;
    `
    helpText.innerHTML = `
        <strong>Camera Controls:</strong><br>
        F - Toggle Follow Mode<br>
        P - Toggle Perception Mode<br>
        1-5 - Quick Select Entity<br>
        ESC - Exit Follow Mode<br>
        Mouse Wheel - Zoom<br>
        Middle Mouse - Pan (when not following)
    `
    document.body.appendChild(helpText)
    
    // Toggle help with H key
    document.addEventListener('keydown', event => {
        if (event.key.toLowerCase() === 'h') {
            helpText.style.display = helpText.style.display === 'none' ? 'block' : 'none'
        }
    })

    // --- Unlock hint UI ---
    const unlockContainer = document.createElement('div')
    unlockContainer.id = 'unlock-hints'
    unlockContainer.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 1200;
        max-width: 240px;
    `
    document.body.appendChild(unlockContainer)

    function pushUnlockHint(type, name) {
        const el = document.createElement('div')
        el.style.cssText = `
            background: rgba(30,30,40,0.85);
            color: #fff;
            padding: 6px 10px;
            border-left: 4px solid ${type === 'skill' ? '#2ecc71' : type === 'goal' ? '#3498db' : '#f1c40f'};
            font-size: 12px;
            font-family: monospace;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            opacity: 0;
            transition: opacity 0.3s ease;
        `
        el.textContent = `${type.toUpperCase()} unlocked: ${name}`
        unlockContainer.appendChild(el)
        requestAnimationFrame(() => { el.style.opacity = '1' })
        // Auto-remove after 6s
        setTimeout(() => {
            el.style.opacity = '0'
            setTimeout(() => el.remove(), 500)
        }, 6000)
    }

    setUnlockListener(({ skills = [], goals = [], recipes = [], pawn }) => {
        for (const sk of skills) pushUnlockHint('skill', sk)
        for (const g of goals) pushUnlockHint('goal', g)
        for (const r of recipes) pushUnlockHint('recipe', r)
    })
    
    return { isPaused: () => isPaused, setPaused, modeSwitcher }
}

export default setupControls
