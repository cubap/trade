import { Pawn } from '../models/entities/index.js'

export function setupStatsDisplay(world, renderer, playerMode = null) {
    const statsDisplay = document.createElement('div')
    statsDisplay.id = 'stats-display'

    const header = document.createElement('div')
    header.style.display = 'flex'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'
    header.style.marginBottom = '6px'

    const title = document.createElement('strong')
    title.textContent = 'Pawn HUD'

    const collapseButton = document.createElement('button')
    collapseButton.textContent = 'Hide'
    collapseButton.style.padding = '2px 6px'
    collapseButton.style.fontSize = '11px'

    const body = document.createElement('div')
    body.id = 'stats-display-body'

    let collapsed = false
    const setCollapsed = value => {
        collapsed = !!value
        body.style.display = collapsed ? 'none' : 'block'
        collapseButton.textContent = collapsed ? 'Show' : 'Hide'
    }

    collapseButton.onclick = () => {
        setCollapsed(!collapsed)
    }

    header.appendChild(title)
    header.appendChild(collapseButton)
    statsDisplay.appendChild(header)
    statsDisplay.appendChild(body)
    document.body.appendChild(statsDisplay)

    if (playerMode?.onModeChange) {
        playerMode.onModeChange(mode => {
            const shouldCollapse = mode !== 'pawn'
            setCollapsed(shouldCollapse)
        })
        setCollapsed(playerMode.currentMode !== 'pawn')
    }

    const formatInventory = pawn => {
        const inventory = pawn?.inventory ?? []
        if (!inventory.length) return 'empty'
        return inventory
            .slice(0, 6)
            .map(item => item?.name ?? item?.type ?? 'item')
            .join(', ')
    }

    const getPawnForHud = () => {
        if (playerMode?.trackedPawn) return playerMode.trackedPawn
        if (renderer?.followedEntity?.subtype === 'pawn') return renderer.followedEntity
        return null
    }

    const getNeed = (pawn, key) => {
        const value = pawn?.needs?.needs?.[key]
        return Number.isFinite(value) ? Math.round(value) : '—'
    }

    function updateStats() {
        // Use Pawn.TURN_GAME_SECONDS if available
        const turnSeconds = Pawn?.TURN_GAME_SECONDS ?? 48
        const secondsPerGameHour = 60 * turnSeconds
        const secondsPerGameDay = Pawn?.GAME_DAY_HOURS ? Pawn.GAME_DAY_HOURS * secondsPerGameHour : 6 * secondsPerGameHour
        const totalGameSeconds = world.clock.currentTick * turnSeconds
        // Calculate hour and minute in a 6-hour day
        const gameHour = Math.floor((totalGameSeconds % secondsPerGameDay) / secondsPerGameHour)
        const gameMinute = Math.floor((totalGameSeconds % secondsPerGameHour) / turnSeconds)
        const dayNight = (gameHour >= 1 && gameHour <= 5) ? 'Day' : 'Night'
        const pawn = getPawnForHud()
        const goal = pawn?.goals?.currentGoal
        const goalText = goal?.description ?? goal?.type ?? 'none'
        const actionText = pawn?.recentAction ?? pawn?.getStatus?.()?.recentAction ?? 'Idle'
        const knownCaches = pawn?.getStatus?.()?.knownCaches ?? 0
        const latestThought = pawn?.getLatestThought?.()?.text ?? '—'
        const stageProgress = goal?.type === 'stage_build_materials'
            ? `${goal.stagedCount ?? 0}/${goal.targetCount ?? '?'} staged`
            : null
        const buildProgress = goal?.type === 'build_structure'
            ? `${Math.round((goal.buildProgress ?? 0) * 100)}%`
            : null
        const modeText = playerMode?.currentMode ? String(playerMode.currentMode) : 'n/a'

        body.innerHTML = `
            ${pawn ? `
                <div>
                    <div><strong>Mode</strong>: ${modeText}</div>
                    <div><strong>Pawn</strong>: ${pawn.name ?? pawn.id ?? 'Unknown'}</div>
                    <div><strong>Goal</strong>: ${goalText}</div>
                    ${stageProgress ? `<div><strong>Build Staging</strong>: ${stageProgress}</div>` : ''}
                    ${buildProgress ? `<div><strong>Build Progress</strong>: ${buildProgress}</div>` : ''}
                    <div><strong>Action</strong>: ${actionText}</div>
                    <div><strong>Thought</strong>: ${latestThought}</div>
                    <div><strong>Inventory</strong>: ${formatInventory(pawn)}</div>
                    <div><strong>Caches</strong>: ${knownCaches}</div>
                    <div><strong>Status</strong>: ${pawn.behaviorState ?? 'idle'} | H:${getNeed(pawn, 'hunger')} T:${getNeed(pawn, 'thirst')} E:${getNeed(pawn, 'energy')}</div>
                </div>
            ` : '<div><strong>Pawn</strong>: none tracked</div>'}

            <details style="margin-top: 6px;">
                <summary style="cursor: pointer; font-size: 12px;">World/debug</summary>
                <div style="margin-top: 4px;">
                    <div>Tick: ${world.clock.currentTick}</div>
                    <div>Time: ${gameHour}:${gameMinute.toString().padStart(2, '0')} (${dayNight})</div>
                    <div>Zoom: ${renderer.zoomLevel.toFixed(2)}x</div>
                    <div>Entities: ${world.entitiesMap.size}</div>
                    <div>View: (${Math.round(renderer.viewX)}, ${Math.round(renderer.viewY)})</div>
                    <div>Grid: ${renderer.showGrid ? 'On' : 'Off'}</div>
                    ${renderer.followMode ? `<div>Following: ${renderer.followedEntity?.name || 'Unknown'}</div>` : ''}
                    ${renderer.perceptionMode ? '<div>Perception Mode: ON</div>' : ''}
                    ${renderer.isPanning ? '<div>Panning</div>' : ''}
                </div>
            </details>
            <div style="font-size: 10px; margin-top: 5px;">Press H for camera help</div>
        `
        requestAnimationFrame(updateStats)
    }
    updateStats()
}
