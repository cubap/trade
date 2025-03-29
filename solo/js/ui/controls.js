import { Pawn, Animal } from '../models/entities/index.js'

function setupControls(world, renderer) {
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
        const entityCount = world.entitiesMap.size + 1
        const selectedType = typeSelect.value
        
        let entity
        
        if (selectedType === 'pawn') {
            entity = new Pawn(
                `pawn${entityCount}`,
                `Pawn ${entityCount}`,
                Math.random() * world.width,
                Math.random() * world.height
            )
        } else if (selectedType === 'animal') {
            entity = new Animal(
                `animal${entityCount}`,
                `Animal ${entityCount}`,
                Math.random() * world.width,
                Math.random() * world.height
            )
            
            // Randomize animal properties
            entity.species = Math.random() > 0.5 ? 'rabbit' : 'fox'
            entity.diet = Math.random() > 0.3 ? 'herbivore' : 'carnivore'
            entity.predator = entity.diet === 'carnivore'
        }
        
        if (entity) {
            world.addEntity(entity)
        }
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
    
    // Add grid toggle button
    const gridButton = document.createElement('button')
    gridButton.textContent = 'Toggle Grid'
    gridButton.style.marginLeft = '10px'
    gridButton.onclick = () => {
        renderer.showGrid = !renderer.showGrid
        gridButton.textContent = renderer.showGrid ? 'Hide Grid' : 'Show Grid'
    }
    
    // Add controls to panel
    controlPanel.appendChild(typeSelect)
    controlPanel.appendChild(addButton)
    controlPanel.appendChild(pauseButton)
    controlPanel.appendChild(paletteSelect)
    controlPanel.appendChild(gridButton)
    
    // Insert into DOM
    document.body.appendChild(controlPanel)
    
    // Create stats display
    const statsDisplay = document.createElement('div')
    statsDisplay.id = 'stats-display'
    document.body.appendChild(statsDisplay)
    
    // Update stats in animation loop
    function updateStats() {
        statsDisplay.innerHTML = `
            <div>Tick: ${world.clock.currentTick}</div>
            <div>Zoom: ${renderer.zoomLevel.toFixed(2)}x</div>
            <div>Entities: ${world.entitiesMap.size}</div>
            <div>View: (${Math.round(renderer.viewX)}, ${Math.round(renderer.viewY)})</div>
            <div>Grid: ${renderer.showGrid ? 'On' : 'Off'}</div>
            ${renderer.isPanning ? '<div>Panning</div>' : ''}
        `
        requestAnimationFrame(updateStats)
    }
    
    updateStats()
    
    return { isPaused: () => isPaused }
}

export default setupControls
