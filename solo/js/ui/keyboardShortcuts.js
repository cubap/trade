export function setupKeyboardShortcuts(world, renderer, followButton, perceptionButton, updateFollowSelect, followSelect) {
    document.addEventListener('keydown', event => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return
        switch (event.key.toLowerCase()) {
            case 'f':
                followButton.click()
                break
            case 'p':
                if (renderer.followMode) perceptionButton.click()
                break
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                const entityIndex = parseInt(event.key) - 1
                const allEntities = Array.from(world.entitiesMap.values())
                    .filter(e => e.subtype === 'pawn' || e.subtype === 'animal')
                if (entityIndex < allEntities.length) {
                    const entity = allEntities[entityIndex]
                    renderer.setFollowEntity(entity)
                    followButton.textContent = `Following: ${entity.name}`
                    updateFollowSelect()
                    followSelect.value = entity.id
                    followSelect.style.display = 'inline'
                }
                break
            case 'escape':
                if (renderer.followMode) {
                    renderer.setFollowEntity(null)
                    followButton.textContent = 'Follow Mode: OFF'
                    followSelect.style.display = 'none'
                }
                break
        }
    })
}
