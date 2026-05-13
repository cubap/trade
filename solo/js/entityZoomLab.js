import World from './core/World.js'
import { createRenderer } from './rendering/rendererFactory.js'
import Pawn from './models/entities/mobile/Pawn.js'
import Animal from './models/entities/mobile/Animal.js'
import Structure from './models/entities/immobile/Structure.js'
import School from './models/entities/immobile/School.js'
import ResourceCache from './models/entities/immobile/ResourceCache.js'
import FoodSource from './models/entities/resources/FoodSource.js'
import WaterSource from './models/entities/resources/WaterSource.js'
import Cover from './models/entities/resources/Cover.js'
import Rock from './models/entities/resources/Rock.js'
import Stick from './models/entities/resources/Stick.js'
import FiberPlant from './models/entities/resources/FiberPlant.js'
import { Tree, Bush, Grass } from './models/entities/plants/Flora.js'

const world = new World(2200, 1800, {
    chunkSize: 220,
    mapSeed: 4321,
    mapStyle: 'temperate_frontier'
})
world.renderChunkRadius = 20

const { instance: renderer } = createRenderer(world, 'game-canvas', 'three')

const labelLayer = document.getElementById('model-label-layer')
const focusSelect = document.getElementById('entity-focus')
const selectedNameEl = document.getElementById('selected-name')
const selectedTypeEl = document.getElementById('selected-type')
const selectedSubtypeEl = document.getElementById('selected-subtype')
const selectedTagsEl = document.getElementById('selected-tags')
const resetCameraButton = document.getElementById('reset-camera')
const spinButton = document.getElementById('toggle-spin')
const followButton = document.getElementById('toggle-follow')

const ENTITY_SPACING = 180
const GRID_COLUMNS = 5
const GRID_START_X = 320
const GRID_START_Y = 320

const center = {
    x: GRID_START_X + ENTITY_SPACING * 1.8,
    y: GRID_START_Y + ENTITY_SPACING * 1.8
}

const labEntities = []
const labelById = new Map()

let selectedEntity = null
let spinCamera = false
let followSelected = false
let spinAngle = 0

function registerEntity(entity, label) {
    world.addEntity(entity)
    labEntities.push(entity)

    const entry = document.createElement('option')
    entry.value = entity.id
    entry.textContent = label
    focusSelect.appendChild(entry)

    const labelNode = document.createElement('div')
    labelNode.className = 'entity-label'
    labelNode.textContent = label
    labelLayer.appendChild(labelNode)
    labelById.set(entity.id, labelNode)
}

function placeEntity(factory, label, idx) {
    const col = idx % GRID_COLUMNS
    const row = Math.floor(idx / GRID_COLUMNS)
    const x = GRID_START_X + col * ENTITY_SPACING
    const y = GRID_START_Y + row * ENTITY_SPACING
    const entity = factory(x, y, idx)
    registerEntity(entity, label)
}

function seedGrid() {
    const specs = [
        {
            label: 'Pawn - Base',
            factory: (x, y, idx) => {
                const pawn = new Pawn(`lab_pawn_${idx}`, 'Lab Pawn', x, y)
                pawn.color = '#5fa8ff'
                return pawn
            }
        },
        {
            label: 'Pawn - Warm Palette',
            factory: (x, y, idx) => {
                const pawn = new Pawn(`lab_pawn_${idx}`, 'Lab Pawn Warm', x, y)
                pawn.color = '#f4a261'
                return pawn
            }
        },
        {
            label: 'Animal - Deer',
            factory: (x, y, idx) => {
                const animal = new Animal(`lab_animal_${idx}`, 'Deer', x, y)
                animal.species = 'deer'
                animal.color = '#caa671'
                return animal
            }
        },
        {
            label: 'Animal - Fox',
            factory: (x, y, idx) => {
                const animal = new Animal(`lab_animal_${idx}`, 'Fox', x, y)
                animal.species = 'fox'
                animal.color = '#d37d3f'
                return animal
            }
        },
        {
            label: 'Tree - Adult',
            factory: (x, y, idx) => new Tree({ id: `lab_tree_${idx}`, name: 'Lab Tree Adult', x, y, stage: 'adult', variety: 'oak', size: 12 })
        },
        {
            label: 'Tree - Sapling',
            factory: (x, y, idx) => new Tree({ id: `lab_tree_${idx}`, name: 'Lab Tree Sapling', x, y, stage: 'sapling', variety: 'pine', size: 7 })
        },
        {
            label: 'Bush',
            factory: (x, y, idx) => new Bush({ id: `lab_bush_${idx}`, name: 'Lab Bush', x, y, stage: 'mature' })
        },
        {
            label: 'Grass',
            factory: (x, y, idx) => new Grass({ id: `lab_grass_${idx}`, name: 'Lab Grass', x, y, population: 75 })
        },
        {
            label: 'Rock',
            factory: (x, y, idx) => new Rock(`lab_rock_${idx}`, x, y)
        },
        {
            label: 'Stick',
            factory: (x, y, idx) => new Stick(`lab_stick_${idx}`, x, y)
        },
        {
            label: 'Fiber Plant',
            factory: (x, y, idx) => new FiberPlant(`lab_fiber_${idx}`, x, y)
        },
        {
            label: 'Food Source',
            factory: (x, y, idx) => new FoodSource(`lab_food_${idx}`, 'Lab Food', x, y)
        },
        {
            label: 'Water Source',
            factory: (x, y, idx) => new WaterSource(`lab_water_${idx}`, 'Lab Water', x, y)
        },
        {
            label: 'Cover',
            factory: (x, y, idx) => new Cover(`lab_cover_${idx}`, 'Lab Cover', x, y)
        },
        {
            label: 'Structure',
            factory: (x, y, idx) => new Structure(`lab_structure_${idx}`, 'Lab Structure', x, y)
        },
        {
            label: 'School',
            factory: (x, y, idx) => new School(`lab_school_${idx}`, 'Lab School', x, y)
        },
        {
            label: 'Resource Cache',
            factory: (x, y, idx) => new ResourceCache(`lab_cache_${idx}`, 'Lab Cache', x, y)
        }
    ]

    for (let i = 0; i < specs.length; i++) {
        placeEntity(specs[i].factory, specs[i].label, i)
    }
}

function getTags(entity) {
    if (!entity) return '-'
    if (Array.isArray(entity.tags)) return entity.tags.join(', ')
    if (typeof entity.tags?.values === 'function') return [...entity.tags.values()].join(', ')
    return '-'
}

function selectEntity(entity) {
    selectedEntity = entity
    if (!entity) {
        selectedNameEl.textContent = 'Selected: none'
        selectedTypeEl.textContent = 'Type: -'
        selectedSubtypeEl.textContent = 'Subtype: -'
        selectedTagsEl.textContent = 'Tags: -'
        return
    }

    selectedNameEl.textContent = `Selected: ${entity.name ?? entity.id}`
    selectedTypeEl.textContent = `Type: ${entity.type ?? '-'}`
    selectedSubtypeEl.textContent = `Subtype: ${entity.subtype ?? '-'}`
    selectedTagsEl.textContent = `Tags: ${getTags(entity) || '-'}`

    focusSelect.value = entity.id
    renderer.highlightEntity?.(entity, 5000)

    if (followSelected) {
        renderer.setFollowEntity?.(entity)
    }
}

function updateLabelPositions() {
    for (const entity of labEntities) {
        const label = labelById.get(entity.id)
        if (!label) continue

        const worldX = entity.x
        const worldY = entity.y
        const screen = renderer.worldToScreen?.(worldX, worldY)

        if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
            label.style.display = 'none'
            continue
        }

        const outside = screen.x < -200 || screen.x > window.innerWidth + 200 || screen.y < -120 || screen.y > window.innerHeight + 120
        label.style.display = outside ? 'none' : 'block'

        if (!outside) {
            label.style.left = `${screen.x}px`
            label.style.top = `${screen.y - 14}px`
            label.style.opacity = selectedEntity?.id === entity.id ? '1' : '0.86'
            label.style.borderColor = selectedEntity?.id === entity.id
                ? 'rgba(126, 191, 255, 0.95)'
                : 'rgba(193, 214, 245, 0.34)'
        }
    }
}

function resetCamera() {
    renderer.setFollowEntity?.(null)
    renderer.viewX = center.x
    renderer.viewY = center.y
    renderer.cameraDistance = 420
    renderer.zoomLevel = 1
}

function animate() {
    if (spinCamera && !followSelected) {
        spinAngle += 0.0034
        renderer.viewX = center.x + Math.cos(spinAngle) * 120
        renderer.viewY = center.y + Math.sin(spinAngle) * 120
    }

    renderer.render()
    updateLabelPositions()
    requestAnimationFrame(animate)
}

focusSelect.addEventListener('change', () => {
    const entity = world.entitiesMap.get(focusSelect.value) ?? null
    selectEntity(entity)
})

resetCameraButton.addEventListener('click', () => {
    spinCamera = false
    spinButton.textContent = 'Spin Camera'
    resetCamera()
})

spinButton.addEventListener('click', () => {
    spinCamera = !spinCamera
    spinButton.textContent = spinCamera ? 'Stop Spin' : 'Spin Camera'
})

followButton.addEventListener('click', () => {
    followSelected = !followSelected
    followButton.textContent = followSelected ? 'Unfollow' : 'Follow Selected'

    if (followSelected && selectedEntity) {
        renderer.setFollowEntity?.(selectedEntity)
        return
    }

    renderer.setFollowEntity?.(null)
})

const canvas = document.getElementById('game-canvas')
canvas.addEventListener('click', event => {
    const entity = renderer.getEntityAtScreen?.(event.clientX, event.clientY)
    if (!entity) return
    selectEntity(entity)
})

seedGrid()
resetCamera()
selectEntity(labEntities[0] ?? null)
animate()

window.modelLab = {
    world,
    renderer,
    entities: labEntities,
    selectEntity
}
