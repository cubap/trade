export function setupKeyboardShortcuts(world, renderer, followButton, perceptionButton, updateFollowSelect, followSelect, options = {}) {
    document.addEventListener('keydown', event => {
        const tagName = event.target?.tagName
        if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' || event.target?.isContentEditable) return

        const key = event.key.toLowerCase()
        if (options.onOverlayKey?.(key, event)) {
            event.preventDefault()
            return
        }

        switch (key) {
            case 'f':
                if (renderer.firstPersonLocked) break
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
                    if (followSelect) {
                        followSelect.value = entity.id
                        followSelect.style.display = 'inline'
                    }
                }
                break
            case 'escape':
                if (renderer.followMode) {
                    if (renderer.firstPersonLocked) break
                    renderer.setFollowEntity(null)
                    followButton.textContent = 'Follow Mode: OFF'
                    if (followSelect) followSelect.style.display = 'none'
                }
                break
        }
    })
}
