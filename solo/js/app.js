import World from './core/World.js'
import { createRenderer, getRendererKeyFromHash } from './rendering/rendererFactory.js'
import setupControls from './ui/controls.js'
import { Animal, Pawn } from './models/entities/index.js'
import { School } from './models/entities/immobile/index.js'
import { FoodSource, Cover, Rock, Stick, FiberPlant } from './models/entities/resources/index.js'
// Focus on world simulation (no pawns, animals OK)
import FloraGenerator from './core/FloraGenerator.js'
import ResourceGenerator from './core/ResourceGenerator.js'
import WaterGenerator from './core/WaterGenerator.js'
import RECIPES from './models/crafting/Recipes.js'
import { injectRecipes } from './models/entities/mobile/GoalPlanner.js'
import PlayerMode from './core/PlayerMode.js'
import ProgressionController from './core/ProgressionController.js'
import { setupInteractionPanel } from './ui/interactionPanel.js'
import { setupFeedbackChannelUI } from './ui/feedbackChannelUI.js'
import { setupThoughtDome } from './ui/thoughtDome.js'
import { setupSlowStartQuiz } from './ui/slowStartQuiz.js'
import { setupCameraTuning } from './ui/cameraTuning.js'
import { setupJournal } from './ui/journalOverlay.js'
import { setupInventory } from './ui/inventoryOverlay.js'

// Initialize goal planner with recipes
injectRecipes(RECIPES)

// Expose recipes for testing hooks
try {
    window.RECIPES = RECIPES
} catch (e) {
    // ignore when not in browser
}

// Create a larger world
const runtimeParams = new URLSearchParams(location.search)
const worldSize = Math.max(6000, Number(runtimeParams.get('worldSize')) || 12000)
const chunkSize = Math.max(260, Number(runtimeParams.get('chunkSize')) || 420)
const mapSeedParam = Number(runtimeParams.get('mapSeed'))
const mapSeed = Number.isFinite(mapSeedParam) && mapSeedParam > 0 ? mapSeedParam : undefined
const activeChunkRadius = Math.max(2, Number(runtimeParams.get('activeChunks')) || 2)
const renderChunkRadius = Math.max(2, Number(runtimeParams.get('renderChunks')) || 2)
const isStreamingWorld = true

// Create a large procedural world tuned for broad livable biome patches.
const world = new World(worldSize, worldSize, {
    chunkSize,
    mapSeed,
    mapStyle: 'temperate_frontier'
})
world.renderChunkRadius = renderChunkRadius
let activeRendererKey = getRendererKeyFromHash()
let { key: resolvedRendererKey, instance: activeRenderer } = createRenderer(world, 'game-canvas', activeRendererKey)
activeRendererKey = resolvedRendererKey

const renderer = new Proxy({}, {
    get(_target, prop) {
        const value = activeRenderer?.[prop]
        if (typeof value === 'function') return value.bind(activeRenderer)
        return value
    },
    set(_target, prop, value) {
        activeRenderer[prop] = value
        return true
    }
})

const playerMode = new PlayerMode(world, renderer)
const progression = new ProgressionController()
let trackedPlayerPawn = null
let thoughtDome = null

// Expose runtime objects for debugging in DevTools
try {
    window.world = world
    window.mapProfile = world.chunkManager.getMapProfile?.()
    window.renderer = renderer
    window.activeRenderer = activeRenderer
    window.activeRendererKey = activeRendererKey
    window.playerMode = playerMode
    window.progression = progression
} catch (e) {
    // Not running in browser context (e.g., tests) - ignore
}

function hotSwapRendererFromHash() {
    const requestedKey = getRendererKeyFromHash()
    if (requestedKey === activeRendererKey) return

    const { key: nextKey, instance: nextRenderer } = createRenderer(world, 'game-canvas', requestedKey)
    if (nextKey === activeRendererKey) {
        nextRenderer.destroy?.()
        return
    }

    const followedEntity = activeRenderer.followedEntity
    const perceptionEnabled = !!activeRenderer.perceptionMode

    activeRenderer.destroy?.()
    activeRenderer = nextRenderer
    activeRendererKey = nextKey

    if (perceptionEnabled && !activeRenderer.perceptionMode) {
        activeRenderer.togglePerceptionMode?.()
    }

    if (followedEntity) {
        activeRenderer.setFollowEntity?.(followedEntity)
    }

    if (playerMode.trackedPawn) {
        playerMode.setTrackedPawn(playerMode.trackedPawn)
    }

    try {
        window.activeRenderer = activeRenderer
        window.activeRendererKey = activeRendererKey
    } catch (e) {
        // ignore when not in browser
    }

    _modeSwitcherUpdate?.()
    console.log(`[renderer] switched to ${activeRendererKey}`)
}

window.addEventListener('hashchange', hotSwapRendererFromHash)

// Add water features: a river, a couple lakes, and scattered puddles
function hasTag(entity, tag) {
    if (Array.isArray(entity?.tags)) return entity.tags.includes(tag)
    if (typeof entity?.tags?.has === 'function') return entity.tags.has(tag)
    return false
}

function chunkKey(x, y) {
    return `${x},${y}`
}

const generatedChunks = new Set()
const floraGenerator = new FloraGenerator(world)
const resourceGenerator = new ResourceGenerator(world)
const waterGen = new WaterGenerator(world)

function populateChunk(chunk) {
    if (!chunk) return

    const key = chunkKey(chunk.x, chunk.y)
    if (generatedChunks.has(key)) return
    generatedChunks.add(key)

    floraGenerator.generateForChunk(chunk)
    resourceGenerator.generateResourcesForChunk(chunk)

    if (chunk.biome === 'forest' || chunk.biome === 'hills') {
        const shouldCluster = chunk.biome === 'forest' ? Math.random() < 0.7 : Math.random() < 0.45
        if (shouldCluster) {
            const centerX = chunk.worldX + chunk.size * (0.3 + Math.random() * 0.4)
            const centerY = chunk.worldY + chunk.size * (0.3 + Math.random() * 0.4)
            floraGenerator.placeForestClump(centerX, centerY, Math.max(50, chunk.size * 0.38))
        }
    }

    if (chunk.settlementSuitability >= 0.7 && Math.random() < 0.3) {
        const x = chunk.worldX + chunk.size * (0.35 + Math.random() * 0.3)
        const y = chunk.worldY + chunk.size * (0.35 + Math.random() * 0.3)
        waterGen.addWater(x, y, {
            size: 6 + Math.random() * 5,
            quantity: 240,
            maxQuantity: 240,
            replenishRate: 0.55,
            name: 'Spring'
        })
    }
}

function populateChunksAroundWorldPoint(x, y, radiusChunks = activeChunkRadius) {
    const { chunkX, chunkY } = world.chunkManager.getChunkCoordsAtPosition(x, y)
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
        for (let dy = -radiusChunks; dy <= radiusChunks; dy++) {
            populateChunk(world.chunkManager.getChunk(chunkX + dx, chunkY + dy))
        }
    }
}

function streamChunksAroundTrackedPawn(pawn, radiusChunks = activeChunkRadius) {
    if (!pawn) return
    world.setActiveChunkWindow?.(pawn.x, pawn.y, radiusChunks)
    populateChunksAroundWorldPoint(pawn.x, pawn.y, radiusChunks)
}

function randomPointNear(x, y, radius) {
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * radius
    return {
        x: Math.max(10, Math.min(world.width - 10, Math.round(x + Math.cos(angle) * distance))),
        y: Math.max(10, Math.min(world.height - 10, Math.round(y + Math.sin(angle) * distance)))
    }
}

function ensureStarterViability(x, y, waterGen, radius = 170) {
    const nearby = world.getNearbyEntities(x, y, radius)
    const foodCount = nearby.filter(entity => hasTag(entity, 'food')).length
    const waterCount = nearby.filter(entity => hasTag(entity, 'water')).length
    const coverCount = nearby.filter(entity => hasTag(entity, 'cover')).length
    const rockCount = nearby.filter(entity => entity?.subtype === 'rock').length
    const stickCount = nearby.filter(entity => entity?.subtype === 'stick').length
    const fiberCount = nearby.filter(entity => hasTag(entity, 'fiber') || entity?.subtype === 'fiber_plant').length

    const missingWater = Math.max(0, 2 - waterCount)
    const missingFood = Math.max(0, 8 - foodCount)
    const missingCover = Math.max(0, 4 - coverCount)
    const missingRock = Math.max(0, 4 - rockCount)
    const missingStick = Math.max(0, 6 - stickCount)
    const missingFiber = Math.max(0, 4 - fiberCount)

    for (let i = 0; i < missingWater; i++) {
        const point = randomPointNear(x, y, radius * 0.7)
        waterGen.addWater(point.x, point.y, {
            size: 10 + Math.random() * 5,
            quantity: 260,
            maxQuantity: 260,
            replenishRate: 0.6,
            name: 'Starter Spring'
        })
    }

    for (let i = 0; i < missingFood; i++) {
        const point = randomPointNear(x, y, radius)
        world.addEntity(new FoodSource(`starter_food_${x}_${y}_${i}`, 'Forage Patch', point.x, point.y))
    }

    for (let i = 0; i < missingCover; i++) {
        const point = randomPointNear(x, y, radius)
        world.addEntity(new Cover(`starter_cover_${x}_${y}_${i}`, 'Starter Cover', point.x, point.y))
    }

    for (let i = 0; i < missingRock; i++) {
        const point = randomPointNear(x, y, radius)
        world.addEntity(new Rock(`starter_rock_${x}_${y}_${i}`, point.x, point.y))
    }

    for (let i = 0; i < missingStick; i++) {
        const point = randomPointNear(x, y, radius)
        world.addEntity(new Stick(`starter_stick_${x}_${y}_${i}`, point.x, point.y))
    }

    for (let i = 0; i < missingFiber; i++) {
        const point = randomPointNear(x, y, radius)
        world.addEntity(new FiberPlant(`starter_fiber_${x}_${y}_${i}`, point.x, point.y))
    }
}

function pickPlayerSpawnPoint() {
    const basins = world.chunkManager.getSettlementBasins?.(6) ?? []
    if (basins.length === 0) {
        return {
            x: Math.round(world.width * 0.5),
            y: Math.round(world.height * 0.5)
        }
    }

    const basin = basins[Math.floor(Math.random() * Math.min(3, basins.length))]
    return {
        x: Math.round(basin.x),
        y: Math.round(basin.y)
    }
}

// Populate only the nearby world bubble instead of the whole map.
const settlementBasins = world.chunkManager.getSettlementBasins?.(10) ?? []

// No whole-world initialization now; population is streamed from the pawn outward.
function seedAnimalsNearPawn(pawn, radiusChunks = 2) {
    if (!pawn) return

    const { chunkX, chunkY } = world.chunkManager.getChunkCoordsAtPosition(pawn.x, pawn.y)
    const candidateChunks = []

    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
        for (let dy = -radiusChunks; dy <= radiusChunks; dy++) {
            const chunk = world.chunkManager.getChunk(chunkX + dx, chunkY + dy)
            if (chunk) candidateChunks.push(chunk)
        }
    }

    const spawnAnimal = (id, name, species, x, y, diet, predator = false) => {
        const animal = new Animal(id, name, x, y)
        animal.species = species
        animal.diet = diet
        animal.predator = predator
        animal.traits.speed = predator ? 28 : 25
        world.addEntity(animal)
    }

    for (const chunk of candidateChunks.slice(0, 6)) {
        const x = chunk.worldX + chunk.size * (0.2 + Math.random() * 0.6)
        const y = chunk.worldY + chunk.size * (0.2 + Math.random() * 0.6)
        spawnAnimal(`rabbit_${chunk.x}_${chunk.y}`, 'Rabbit', 'rabbit', Math.round(x), Math.round(y), 'herbivore')
    }

    const predatorChunk = candidateChunks[Math.floor(Math.random() * candidateChunks.length)]
    if (predatorChunk) {
        const x = predatorChunk.worldX + predatorChunk.size * (0.25 + Math.random() * 0.5)
        const y = predatorChunk.worldY + predatorChunk.size * (0.25 + Math.random() * 0.5)
        spawnAnimal(`fox_${predatorChunk.x}_${predatorChunk.y}`, 'Fox', 'fox', Math.round(x), Math.round(y), 'carnivore', true)
    }
}

async function seedCraftingResourcesNearPawn(pawn) {
    if (!pawn) return
    populateChunksAroundWorldPoint(pawn.x, pawn.y, activeChunkRadius)
    seedAnimalsNearPawn(pawn, 2)
}

// Shared: create pawn and start the game
// @param {boolean} skipSlowStart - If true, skip the in-game quiz (test mode)
async function spawnPlayerPawnAndStart(name, biases, skipSlowStart = false) {
    const spawnPoint = pickPlayerSpawnPoint()
    const spawnX = spawnPoint.x
    const spawnY = spawnPoint.y
    ensureStarterViability(spawnX, spawnY, waterGen)
    const player = new Pawn('player_1', name, spawnX, spawnY)
    player.spawnX = spawnX
    player.spawnY = spawnY

    // Apply quiz biases to goal weights (if from pre-game quiz; slow-start applies later)
    if (biases && typeof biases === 'object' && !skipSlowStart) {
        applyQuizBiases(player, biases)
    }

    world.addEntity(player)
    world.setActiveChunkWindow?.(player.x, player.y, activeChunkRadius)
    trackedPlayerPawn = player
    playerMode.setTrackedPawn(player)
    renderer.setFollowEntity?.(player)
    try { window.player = player } catch (e) {}

    populateChunksAroundWorldPoint(player.x, player.y, activeChunkRadius)
    seedAnimalsNearPawn(player, activeChunkRadius)
    await seedCraftingResourcesNearPawn(player)

    const perception = player.traits?.detection ?? 100
    renderer.camera.setZoomToShowRadius?.(perception, 0.85)
    const school = new School('school_1', 'School', spawnX + 60, spawnY + 40)
    world.addEntity(school)

    // Setup thought dome — reads from pawn's thoughtLog, gets renderer for FPS camera bob
    thoughtDome = setupThoughtDome(() => trackedPlayerPawn, () => activeRenderer)

    // Setup camera tuning panel (press C to toggle)
    setupCameraTuning(() => activeRenderer, () => controls)

    // Setup journal overlay (press J to toggle)
    const journal = setupJournal(() => trackedPlayerPawn)

    // Setup inventory overlay (press I to toggle)
    const inventory = setupInventory(() => trackedPlayerPawn, () => world)

    // Notify server
    try {
        fetch('/_dev/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag: 'client-ready', message: `player:${player.name}` })
        }).catch(() => {})
    } catch (e) {}

    // Setup slow-start quiz (in-game callouts instead of pre-game quiz)
    if (!skipSlowStart) {
        slowStartQuiz = setupSlowStartQuiz(
            () => trackedPlayerPawn,
            (chosenName, quizBiases) => {
                // Quiz complete — update pawn name and apply biases
                if (trackedPlayerPawn) {
                    trackedPlayerPawn.name = chosenName
                    applyQuizBiases(trackedPlayerPawn, quizBiases)
                    console.log(`[slow-start] Pawn renamed to ${chosenName}, biases applied`)
                }
            }
        )
    }

    startMainLoop()
}

// Apply quiz biases to pawn goal weights
function applyQuizBiases(pawn, biases) {
    // Map quiz bias keys to goal planner weight multipliers
    const biasMap = {
        explore: { explore: 1.4, gather: 0.9 },
        survive: { gather: 1.3, consume: 1.3 },
        ponder: { ponder: 1.4, study: 1.3 },
        craft: { craft: 1.4, build: 1.2 },
        social: { social: 1.4, teach: 1.2 },
        build: { build: 1.4, craft: 1.1 },
    }

    // Accumulate multipliers per goal type
    const multipliers = {}
    for (const answer of Object.values(biases)) {
        const bias = answer?.bias
        if (!bias || !biasMap[bias]) continue
        for (const [goalType, weight] of Object.entries(biasMap[bias])) {
            multipliers[goalType] = (multipliers[goalType] ?? 1) * weight
        }
    }

    // Apply to pawn's goal weights if the goals system supports it
    if (pawn.goals?.goalWeights) {
        for (const [type, mult] of Object.entries(multipliers)) {
            pawn.goals.goalWeights[type] = mult
        }
    }

    // Store for runtime access
    pawn.quizBiases = multipliers
    console.log(`[opening] Applied quiz biases for ${pawn.name}:`, multipliers)
}

// No pre-game quiz — pawn wakes up and quiz questions surface as in-game callouts.
// Start immediately with a temporary name; slow-start quiz will set the real name.
async function startWithSlowStart() {
    const params = new URLSearchParams(location.search)
    if (params.get('testMode') === '1') {
        await spawnPlayerPawnAndStart('Player', {}, true)
    } else {
        // Start with temp name; slow-start quiz will update it
        await spawnPlayerPawnAndStart('Wanderer', {}, false)
    }
}

// World is streamed around the pawn at runtime.
startWithSlowStart()

// Controls are initialized after opening screen completes
let controls
let _modeSwitcherUpdate = null
let _interactionPanel = null
let _feedbackUI = null
let slowStartQuiz = null

function buildRouteTraceSegments() {
    if (!trackedPlayerPawn) return []

    const points = []
    const origin = {
        x: trackedPlayerPawn.x,
        y: trackedPlayerPawn.y
    }
    points.push(origin)

    const memoryLandmarks = Array.isArray(trackedPlayerPawn.memoryMap)
        ? trackedPlayerPawn.memoryMap
            .filter(item => Number.isFinite(item?.x) && Number.isFinite(item?.y))
            .slice(0, 6)
        : []
    for (const item of memoryLandmarks) {
        points.push({ x: item.x, y: item.y })
    }

    const rememberedResources = Array.isArray(trackedPlayerPawn.resourceMemory)
        ? trackedPlayerPawn.resourceMemory
            .filter(item => Number.isFinite(item?.x) && Number.isFinite(item?.y) && (item.confidence ?? 0) >= 0.45)
            .slice(0, 8)
        : []
    for (const item of rememberedResources) {
        points.push({ x: item.x, y: item.y })
    }

    if (points.length < 2) return []
    return [{ points }]
}

function syncProgressionState() {
    if (!trackedPlayerPawn) return
    renderer.setWaypointProvider(() => playerMode.mapWaypoints)
    renderer.setRouteTraceProvider(() => buildRouteTraceSegments())
    const payload = progression.evaluate(trackedPlayerPawn, world)
    playerMode.setCapabilities(payload)
    renderer.setCapabilities(payload)
    controls?.setProgressionDebug?.(payload)
    _interactionPanel?.update(trackedPlayerPawn, payload.modules?.interactionControls ?? [])
    _feedbackUI?.onProgressionPayload(payload, trackedPlayerPawn)
}

function streamAroundTrackedPawn() {
    if (!trackedPlayerPawn) return
    populateChunksAroundWorldPoint(trackedPlayerPawn.x, trackedPlayerPawn.y, activeChunkRadius)
}

function startMainLoop() {
    // Setup UI controls
    controls = setupControls(world, renderer, playerMode, {
        onOverridePhaseChange: phase => {
            if (phase) progression.setOverridePhase(phase)
            else progression.clearOverridePhase()
            syncProgressionState()
        },
        onWorldAdvanced: () => {
            syncProgressionState()
            _modeSwitcherUpdate?.()
        }
    })
    _modeSwitcherUpdate = controls?.modeSwitcher?.update ?? null

    // Interaction panel — actionable controls gated by interactionControls capability
    _interactionPanel = setupInteractionPanel(playerMode)

    // Feedback channel UI — passive notifications driven by progression events
    _feedbackUI = setupFeedbackChannelUI(progression)

    progression.onEvent(event => {
        if (event.type === 'phase_entered' || event.type === 'mode_unlocked') {
            console.log('[progression]', event)
        }
    })

    syncProgressionState()

    // Pause/resume simulation on tab blur/focus
    let pausedByTab = false
    window.addEventListener('blur', () => {
        if (!controls.isPaused()) {
            controls.setPaused(true)
            pausedByTab = true
        }
    })
    window.addEventListener('focus', () => {
        if (pausedByTab) {
            controls.setPaused(false)
            pausedByTab = false
        }
    })

    // Start the simulation
    requestAnimationFrame(simulationLoop)
}

// Animation loop
function simulationLoop(timestamp) {
    try {
        // Only update the world if not paused
    if (!controls?.isPaused?.()) {
            streamChunksAroundTrackedPawn(trackedPlayerPawn, activeChunkRadius)
            world.update(timestamp)
            syncProgressionState()
            // Slow-start quiz trigger checks
            slowStartQuiz?.update(trackedPlayerPawn)
            // Refresh mode-switcher unlock state every 60 ticks (~30 s at 2 ticks/s)
            if (world.clock.currentTick % 60 === 0) _modeSwitcherUpdate?.()
        } else {
            // When paused, ensure the clock doesn't accumulate time
            world.clock.lastTimestamp = timestamp
        }
        
        // Always render to show current state
        renderer.render()

        // Update thought dome display
        thoughtDome?.update?.(trackedPlayerPawn)

        // Continue the animation loop
        requestAnimationFrame(simulationLoop)
    } catch (error) {
        console.error('Error in simulation loop:', error)
        // Try to continue despite errors
        setTimeout(() => requestAnimationFrame(simulationLoop), 100)
    }
}

// Loop starts in startMainLoop() after opening screen
