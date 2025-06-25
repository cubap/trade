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
    // Update the Add Entity button for more animal diversity
    addButton.onclick = () => {
        const entityCount = world.entitiesMap.size + 1
        const selectedType = typeSelect.value
        
        let entity
        
        if (selectedType === 'pawn') {
            // Create different types of pawns
            const pawnRoles = ['Explorer', 'Builder', 'Scout', 'Trader']
            const role = pawnRoles[Math.floor(Math.random() * pawnRoles.length)]
            
            entity = new Pawn(
                `pawn${entityCount}`,
                `${role} ${entityCount}`,
                Math.random() * world.width,
                Math.random() * world.height
            )
            
            // Assign the role
            entity.role = role.toLowerCase()
        } else if (selectedType === 'animal') {
            // Use a variety of animal species
            const animalSpecies = ['rabbit', 'fox', 'deer', 'wolf']
            const species = animalSpecies[Math.floor(Math.random() * animalSpecies.length)]
            
            entity = new Animal(
                `animal${entityCount}`,
                `${species.charAt(0).toUpperCase() + species.slice(1)} ${entityCount}`,
                Math.random() * world.width,
                Math.random() * world.height
            )
            
            // Set species-specific properties
            entity.species = species
            
            // Set up behaviors based on species
            if (species === 'rabbit' || species === 'deer') {
                entity.diet = 'herbivore'
                entity.predator = false
                entity.moveRange = 40 + Math.random() * 10
                entity.drives.security = 30  // Start a bit wary
            } else {
                entity.diet = 'carnivore'
                entity.predator = true
                entity.moveRange = 60 + Math.random() * 15
                entity.drives.hunger = 40    // Start hungry
            }
            
            // Initialize a random behavior state
            const states = ['idle', 'foraging', 'seeking_water', 'resting']
            entity.behaviorState = states[Math.floor(Math.random() * states.length)]
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
        
        // Properly pause/resume the world clock
        if (isPaused) {
            world.clock.pause()
        } else {
            world.clock.resume()
        }
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
    
    // Add chunk toggle button
    const chunkButton = document.createElement('button')
    chunkButton.textContent = 'Show Chunks'
    chunkButton.style.marginLeft = '10px'
    chunkButton.onclick = () => {
        renderer.showChunks = !renderer.showChunks
        chunkButton.textContent = renderer.showChunks ? 'Hide Chunks' : 'Show Chunks'
    }
    
    // Add follow camera controls
    const followButton = document.createElement('button')
    followButton.textContent = 'Follow Mode: OFF'
    followButton.style.marginLeft = '10px'
    followButton.onclick = () => {
        if (renderer.followMode) {
            // Disable follow mode
            renderer.setFollowEntity(null)
            followButton.textContent = 'Follow Mode: OFF'
        } else {
            // Enable follow mode - find a pawn to follow
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
    
    const perceptionButton = document.createElement('button')
    perceptionButton.textContent = 'Perception: OFF'
    perceptionButton.style.marginLeft = '10px'
    perceptionButton.onclick = () => {
        renderer.togglePerceptionMode()
        perceptionButton.textContent = `Perception: ${renderer.perceptionMode ? 'ON' : 'OFF'}`
    }
    
    // Add perception mode visualization indicator
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
    
    // Update perception indicator visibility
    const originalTogglePerception = perceptionButton.onclick
    perceptionButton.onclick = () => {
        originalTogglePerception()
        perceptionIndicator.style.display = renderer.perceptionMode && renderer.followMode ? 'block' : 'none'
    }
    
    // Add entity selector for follow mode
    const followSelect = document.createElement('select')
    followSelect.style.marginLeft = '10px'
    followSelect.style.display = 'none'  // Initially hidden
    
    const updateFollowSelect = () => {
        followSelect.innerHTML = '<option value="">Select Entity to Follow</option>'
        
        // Add pawns to the selector
        const pawns = Array.from(world.entitiesMap.values())
            .filter(e => e.subtype === 'pawn')
        
        for (const pawn of pawns) {
            const option = document.createElement('option')
            option.value = pawn.id
            option.textContent = `${pawn.name} (Pawn)`
            followSelect.appendChild(option)
        }
        
        // Add animals to the selector
        const animals = Array.from(world.entitiesMap.values())
            .filter(e => e.subtype === 'animal')
        
        for (const animal of animals) {
            const option = document.createElement('option')
            option.value = animal.id
            option.textContent = `${animal.name} (${animal.species || 'Animal'})`
            followSelect.appendChild(option)
        }
    }
    
    followSelect.onchange = () => {
        const selectedId = followSelect.value
        if (selectedId) {
            const entity = world.entitiesMap.get(selectedId)
            if (entity) {
                renderer.setFollowEntity(entity)
                followButton.textContent = `Following: ${entity.name}`
            }
        }
    }
    
    // Show/hide entity selector based on follow mode
    const originalFollowClick = followButton.onclick
    followButton.onclick = () => {
        originalFollowClick()
        
        if (renderer.followMode) {
            updateFollowSelect()
            followSelect.style.display = 'inline'
        } else {
            followSelect.style.display = 'none'
        }
    }
    
    // Add controls to panel
    controlPanel.appendChild(typeSelect)
    controlPanel.appendChild(addButton)
    controlPanel.appendChild(pauseButton)
    controlPanel.appendChild(paletteSelect)
    controlPanel.appendChild(gridButton)
    controlPanel.appendChild(chunkButton)
    controlPanel.appendChild(followButton)
    controlPanel.appendChild(perceptionButton)
    controlPanel.appendChild(followSelect)
    controlPanel.appendChild(followButton)
    controlPanel.appendChild(perceptionButton)
    controlPanel.appendChild(followSelect)
    
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
            ${renderer.followMode ? `<div>Following: ${renderer.followedEntity?.name || 'Unknown'}</div>` : ''}
            ${renderer.perceptionMode ? '<div>Perception Mode: ON</div>' : ''}
            ${renderer.isPanning ? '<div>Panning</div>' : ''}
            <div style="font-size: 10px; margin-top: 5px;">Press H for camera help</div>
        `
        requestAnimationFrame(updateStats)
    }
    
    updateStats()
    
    // Add canvas interactions
    setupCanvasInteractions(world, renderer)
    
    // Add keyboard shortcuts for follow camera
    document.addEventListener('keydown', event => {
        // Only handle keys if not typing in an input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return
        
        switch (event.key.toLowerCase()) {
            case 'f':
                // Toggle follow mode with 'F' key
                followButton.click()
                break
                
            case 'p':
                // Toggle perception mode with 'P' key
                if (renderer.followMode) {
                    perceptionButton.click()
                }
                break
                
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                // Quick-select entities with number keys
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
                // Disable follow mode with Escape
                if (renderer.followMode) {
                    renderer.setFollowEntity(null)
                    followButton.textContent = 'Follow Mode: OFF'
                    followSelect.style.display = 'none'
                }
                break
        }
    })
    
    // Create camera controls help text
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
    
    return { isPaused: () => isPaused }
}

// Update canvas interactions to properly access the canvas from renderer
function setupCanvasInteractions(world, renderer) {
    // Get canvas directly from the renderer
    const canvas = renderer.canvas
    
    if (!canvas) {
        console.warn("Canvas not available in renderer, can't setup entity inspection")
        return
    }
    
    // Add click handler for entity inspection
    canvas.addEventListener('click', event => {
        // Get click position relative to canvas
        const rect = canvas.getBoundingClientRect()
        const clickX = event.clientX - rect.left
        const clickY = event.clientY - rect.top
        
        // Convert to world coordinates using renderer's view and zoom
        const worldX = renderer.viewX + (clickX - canvas.width/2) / renderer.zoomLevel
        const worldY = renderer.viewY + (clickY - canvas.height/2) / renderer.zoomLevel
        
        // Find entity at click position
        const entity = findEntityAtPosition(world, worldX, worldY)
        
        if (entity) {
            // Log entity data to console
            console.log('Selected Entity:', entity)
            
            // Create a more readable summary
            const summary = createEntitySummary(entity)
            console.log('Entity Summary:', summary)
            
            // Visual feedback (highlight selected entity)
            renderer.highlightEntity(entity, 1000) // Highlight for 1 second
        }
    })
}

// Helper function to find entity at a position
function findEntityAtPosition(world, x, y, threshold = 15) {
    if (!world?.entitiesMap) return null
    
    // Get all entities
    const entities = Array.from(world.entitiesMap.values())
    
    // Filter entities that are close to the click position
    const nearbyEntities = entities.filter(entity => {
        const dx = entity.x - x
        const dy = entity.y - y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // Use entity size or default threshold
        const clickRadius = entity.size || threshold
        return distance <= clickRadius
    })
    
    // If multiple entities found, prioritize by z-index or size
    if (nearbyEntities.length > 1) {
        // Sort by z-index (higher first) or size (larger first) if z-index is not defined
        nearbyEntities.sort((a, b) => {
            // If both have z-index, use that
            if (a.zIndex !== undefined && b.zIndex !== undefined) {
                return b.zIndex - a.zIndex
            }
            
            // Otherwise use size
            const sizeA = a.size || 0
            const sizeB = b.size || 0
            return sizeB - sizeA
        })
    }
    
    // Return the top entity or null if none found
    return nearbyEntities[0] || null
}

// Create a readable summary of the entity's data
function createEntitySummary(entity) {
    if (!entity) return null
    
    // Base entity properties
    const summary = {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        subtype: entity.subtype,
        position: { x: Math.round(entity.x), y: Math.round(entity.y) }
    }
    
    // Add chunk information
    if (entity.world?.chunkManager) {
        const chunk = entity.currentChunk || entity.world.chunkManager.getChunkAtPosition(entity.x, entity.y)
        if (chunk) {
            summary.location = {
                chunk: { x: chunk.x, y: chunk.y },
                biome: chunk.biome,
                environment: {
                    temperature: chunk.temperature,
                    humidity: chunk.humidity,
                    fertility: chunk.fertility,
                    coverDensity: chunk.coverDensity
                },
                resourceDensities: {
                    food: chunk.foodDensity,
                    water: chunk.waterDensity,
                    shelter: chunk.shelterDensity
                }
            }
        }
    }
    
    // Add animal-specific properties
    if (entity.subtype === 'animal') {
        summary.species = entity.species
        summary.diet = entity.diet
        summary.predator = entity.predator
        summary.behaviorState = entity.behaviorState
        summary.drives = { ...entity.drives }
        
        // Add detailed knowledge of resources
        if (entity.memory) {
            summary.memory = {
                // Show the actual locations and details of known resources
                knownFood: entity.memory.knownFood?.map(food => {
                    const chunk = entity.world?.chunkManager?.getChunkAtPosition(food.x, food.y)
                    return {
                        id: food.id,
                        position: { x: Math.round(food.x), y: Math.round(food.y) },
                        chunk: chunk ? { x: chunk.x, y: chunk.y, biome: chunk.biome } : null,
                        lastVisited: food.lastVisited,
                        ticksSinceLastVisit: entity.world?.clock?.currentTick 
                            ? entity.world.clock.currentTick - food.lastVisited 
                            : 'unknown'
                    }
                }) || [],
                
                knownWater: entity.memory.knownWater?.map(water => {
                    const chunk = entity.world?.chunkManager?.getChunkAtPosition(water.x, water.y)
                    return {
                        id: water.id,
                        position: { x: Math.round(water.x), y: Math.round(water.y) },
                        chunk: chunk ? { x: chunk.x, y: chunk.y, biome: chunk.biome } : null,
                        lastVisited: water.lastVisited,
                        ticksSinceLastVisit: entity.world?.clock?.currentTick 
                            ? entity.world.clock.currentTick - water.lastVisited 
                            : 'unknown'
                    }
                }) || [],
                
                knownShelter: entity.memory.knownShelter?.map(shelter => {
                    const chunk = entity.world?.chunkManager?.getChunkAtPosition(shelter.x, shelter.y)
                    return {
                        id: shelter.id,
                        position: { x: Math.round(shelter.x), y: Math.round(shelter.y) },
                        chunk: chunk ? { x: chunk.x, y: chunk.y, biome: chunk.biome } : null,
                        securityValue: shelter.securityValue,
                        lastVisited: shelter.lastVisited,
                        ticksSinceLastVisit: entity.world?.clock?.currentTick 
                            ? entity.world.clock.currentTick - shelter.lastVisited 
                            : 'unknown'
                    }
                }) || []
            }
            
            // Add exploration memory if it exists
            if (entity.memory.exploredChunks) {
                summary.memory.exploredChunks = Array.from(entity.memory.exploredChunks)
            }
            if (entity.memory.visitedBiomes) {
                summary.memory.visitedBiomes = Array.from(entity.memory.visitedBiomes)
            }
        }
    }
    
    // Add resource-specific properties
    if (entity.type === 'resource') {
        summary.quantity = entity.quantity
        summary.maxQuantity = entity.maxQuantity
        summary.depleted = entity.depleted
        
        // Add resource subtype specific properties
        if (entity.subtype === 'food') {
            summary.nutritionalValue = entity.nutritionalValue || 'standard'
        } else if (entity.subtype === 'water') {
            summary.cleanness = entity.cleanness || 'standard'
        } else if (entity.subtype === 'cover') {
            summary.capacity = entity.capacity
            summary.currentOccupants = entity.currentOccupants
            summary.securityValue = entity.securityValue
        }
    }
    
    return summary
}

export default setupControls
