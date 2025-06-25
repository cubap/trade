export function setupFollowControls(world, renderer) {
    // Add follow camera controls
    const followButton = document.createElement('button')
    followButton.textContent = 'Follow Mode: OFF'
    followButton.style.marginLeft = '10px'
    followButton.onclick = () => {
        if (renderer.followMode) {
            renderer.setFollowEntity(null)
            followButton.textContent = 'Follow Mode: OFF'
        } else {
            const pawns = Array.from(world.entitiesMap.values())
                .filter(e => e.subtype === 'pawn')
            if (pawns.length > 0) {
                renderer.setFollowEntity(pawns[0])
                followButton.textContent = `Following: ${pawns[0].name}`
            } else {
                console.log('No pawns available to follow')
            }
        }
    }
    // Perception button
    const perceptionButton = document.createElement('button')
    perceptionButton.textContent = 'Perception: OFF'
    perceptionButton.style.marginLeft = '10px'
    perceptionButton.onclick = () => {
        renderer.togglePerceptionMode()
        perceptionButton.textContent = `Perception: ${renderer.perceptionMode ? 'ON' : 'OFF'}`
    }
    // Perception indicator
    const perceptionIndicator = document.createElement('div')
    perceptionIndicator.id = 'perception-indicator'
    perceptionIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #FFD700;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        pointer-events: none;
        display: none;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        z-index: 999;
    `
    perceptionIndicator.innerHTML = 'PERCEPTION MODE<br><small>Only showing what the followed entity can perceive</small>'
    document.body.appendChild(perceptionIndicator)
    const originalTogglePerception = perceptionButton.onclick
    perceptionButton.onclick = () => {
        originalTogglePerception()
        perceptionIndicator.style.display = renderer.perceptionMode && renderer.followMode ? 'block' : 'none'
    }
    return { followButton, perceptionButton, perceptionIndicator }
}
