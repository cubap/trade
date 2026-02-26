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

    const primaryRow = document.createElement('div')
    primaryRow.style.display = 'flex'
    primaryRow.style.alignItems = 'center'
    primaryRow.style.flexWrap = 'wrap'
    primaryRow.style.gap = '6px'

    const devRow = document.createElement('div')
    devRow.style.display = 'none'
    devRow.style.marginTop = '6px'
    devRow.style.paddingTop = '6px'
    devRow.style.borderTop = '1px solid rgba(0,0,0,0.15)'
    devRow.style.display = 'none'
    devRow.style.alignItems = 'center'
    devRow.style.flexWrap = 'wrap'
    devRow.style.gap = '6px'
    
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

    const devToggleButton = document.createElement('button')
    devToggleButton.textContent = 'Dev Tools ▸'
    devToggleButton.style.marginLeft = '6px'
    devToggleButton.onclick = () => {
        const open = devRow.style.display !== 'none'
        devRow.style.display = open ? 'none' : 'flex'
        devToggleButton.textContent = open ? 'Dev Tools ▸' : 'Dev Tools ▾'
    }

    // Group command controls (minimal live testing for follow/obey)
    const leaderSelect = document.createElement('select')
    leaderSelect.style.marginLeft = '10px'
    const targetSelect = document.createElement('select')
    targetSelect.style.marginLeft = '6px'
    const commandSelect = document.createElement('select')
    commandSelect.style.marginLeft = '6px'
    const followOption = document.createElement('option')
    followOption.value = 'follow'
    followOption.textContent = 'follow'
    const obeyOption = document.createElement('option')
    obeyOption.value = 'obey'
    obeyOption.textContent = 'obey'
    commandSelect.appendChild(followOption)
    commandSelect.appendChild(obeyOption)

    const issueCommandButton = document.createElement('button')
    issueCommandButton.textContent = 'Issue Cmd'
    issueCommandButton.style.marginLeft = '6px'

    const refreshPawnsButton = document.createElement('button')
    refreshPawnsButton.textContent = '↻ Pawns'
    refreshPawnsButton.style.marginLeft = '6px'

    const commandStatus = document.createElement('span')
    commandStatus.style.marginLeft = '8px'
    commandStatus.style.fontSize = '12px'
    commandStatus.style.color = '#ddd'
    commandStatus.textContent = 'Cmd: ready'

    const refreshPawnSelectors = () => {
        const pawns = Array.from(world.entitiesMap.values()).filter(e => e.subtype === 'pawn')
        const previousLeader = leaderSelect.value
        const previousTarget = targetSelect.value

        leaderSelect.innerHTML = ''
        targetSelect.innerHTML = ''

        for (const pawn of pawns) {
            const leaderOption = document.createElement('option')
            leaderOption.value = pawn.id
            leaderOption.textContent = `L:${pawn.name}`
            leaderSelect.appendChild(leaderOption)

            const targetOption = document.createElement('option')
            targetOption.value = pawn.id
            targetOption.textContent = `T:${pawn.name}`
            targetSelect.appendChild(targetOption)
        }

        if (previousLeader && pawns.some(p => p.id === previousLeader)) {
            leaderSelect.value = previousLeader
        }
        if (previousTarget && pawns.some(p => p.id === previousTarget)) {
            targetSelect.value = previousTarget
        }
    }

    const ensureGroupLink = (leader, target) => {
        if (!leader || !target) return false
        if (!leader.groupState?.id) {
            leader.createGroup?.(`live-${leader.id}`)
        }
        if (!leader.groupState?.id) return false

        if (target.groupState?.id !== leader.groupState.id) {
            target.joinGroup?.(leader, leader.groupState.id)
        }
        // default trust for live control testing
        target.setGroupTrustIn?.(leader, Math.max(0.6, target.getGroupTrustIn?.(leader) ?? 0))
        return true
    }

    issueCommandButton.onclick = () => {
        refreshPawnSelectors()
        const leader = world.entitiesMap.get(leaderSelect.value)
        const target = world.entitiesMap.get(targetSelect.value)
        const type = commandSelect.value

        if (!leader || !target || leader.subtype !== 'pawn' || target.subtype !== 'pawn') {
            console.log('Select valid leader/target pawns first')
            commandStatus.textContent = 'Cmd: invalid leader/target'
            return
        }

        if (leader.id === target.id && type === 'obey') {
            console.log('Obey command requires a different target leader')
            commandStatus.textContent = 'Cmd: obey needs different target'
            return
        }

        if (!ensureGroupLink(leader, target)) {
            console.log('Could not establish group linkage for command')
            commandStatus.textContent = 'Cmd: group link failed'
            return
        }

        const accepted = leader.issueGroupCommand?.({
            type,
            target,
            duration: type === 'follow' ? 140 : 80,
            priority: type === 'follow' ? 8 : 9
        }) ?? 0

        console.log(`Issued ${type} from ${leader.name} to ${target.name}; accepted by ${accepted} member(s)`)
        commandStatus.textContent = `Cmd: ${type} ${leader.name}→${target.name} (accepted ${accepted})`
    }

    refreshPawnsButton.onclick = () => {
        refreshPawnSelectors()
        commandStatus.textContent = `Cmd: refreshed (${leaderSelect.options.length} pawns)`
    }
    refreshPawnSelectors()
    
    // Add controls to panel (primary + collapsible dev tools)
    primaryRow.appendChild(pauseButton)
    primaryRow.appendChild(followButton)
    primaryRow.appendChild(perceptionButton)
    primaryRow.appendChild(recenterButton)
    primaryRow.appendChild(devToggleButton)

    devRow.appendChild(typeSelect)
    devRow.appendChild(addButton)
    devRow.appendChild(paletteSelect)
    devRow.appendChild(gridButton)
    devRow.appendChild(chunkButton)
    devRow.appendChild(leaderSelect)
    devRow.appendChild(targetSelect)
    devRow.appendChild(commandSelect)
    devRow.appendChild(issueCommandButton)
    devRow.appendChild(refreshPawnsButton)
    devRow.appendChild(commandStatus)

    // Mode switcher (pawn / overseer / god) — only mount if playerMode is provided
    let modeSwitcher = null
    if (playerMode) {
        modeSwitcher = setupModeSwitcher(playerMode, primaryRow)
    }

    controlPanel.appendChild(primaryRow)
    controlPanel.appendChild(devRow)
    
    // Insert into DOM
    document.body.appendChild(controlPanel)
    // Stats display
    setupStatsDisplay(world, renderer, playerMode)
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
