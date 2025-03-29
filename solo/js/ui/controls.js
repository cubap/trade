import Entity from '../models/Entity.js'

function setupControls(world, renderer) {
    const controlPanel = document.createElement('div')
    controlPanel.style.margin = '10px 0'
    
    // Add entity button
    const addButton = document.createElement('button')
    addButton.textContent = 'Add Entity'
    addButton.onclick = () => {
        const entityCount = world.entitiesMap.size + 1
        const entity = new Entity(
            `Entity${entityCount}`,
            Math.random() * world.width,
            Math.random() * world.height,
            1 + Math.random() * 30
        )
        world.addEntity(entity)
    }
    
    // Add pause button
    const pauseButton = document.createElement('button')
    pauseButton.textContent = 'Pause'
    pauseButton.style.marginLeft = '10px'
    
    // Return the isPaused state and setter function
    let isPaused = false
    pauseButton.onclick = () => {
        isPaused = !isPaused
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause'
    }
    
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
    
    controlPanel.appendChild(addButton)
    controlPanel.appendChild(pauseButton)
    controlPanel.appendChild(paletteSelect)
    
    // Insert into DOM
    const container = document.getElementById('canvas-container')
    if (container) {
        document.body.insertBefore(controlPanel, container)
    } else {
        document.body.appendChild(controlPanel)
    }
    
    return { isPaused: () => isPaused }
}

export default setupControls
