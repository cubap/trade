import { Pawn } from '../models/entities/index.js'

export function setupStatsDisplay(world, renderer) {
    const statsDisplay = document.createElement('div')
    statsDisplay.id = 'stats-display'
    document.body.appendChild(statsDisplay)

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
        statsDisplay.innerHTML = `
            <div>Tick: ${world.clock.currentTick}</div>
            <div>Time: ${gameHour}:${gameMinute.toString().padStart(2, '0')} (${dayNight})</div>
            <div>Zoom: ${renderer.zoomLevel.toFixed(2)}x</div>
            <div>Entities: ${world.entitiesMap.size}</div>
            <div>View: (${Math.round(renderer.viewX)}, ${Math.round(renderer.viewY)})</div>
            <div>Grid: ${renderer.showGrid ? 'On' : 'Off'}</div>
            ${renderer.followMode ? `<div>Following: ${renderer.followedEntity?.name || 'Unknown'}</div>` : ''}
            ${renderer.perceptionMode ? '<div>Perception Mode: ON</div>' : ''}
            ${renderer.isPanning ? '<div>Panning</div>' : ''}
            <div style="font-size: 10px; margin-top: 5px;">Press H for camera help</div>
        `
        requestAnimationFrame(updateStats)
    }
    updateStats()
}
