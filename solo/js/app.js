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

// Simple overlay to show presimulation progress
function createPreSimOverlay() {
    const overlay = document.createElement('div')
    overlay.id = 'presim-overlay'
    Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(10,12,16,0.8)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    })
    overlay.innerHTML = `
        <div style="color:#cbd5e1;font-family:system-ui,Segoe UI,Roboto,Arial;font-size:16px;margin-bottom:12px;">
            Initializing world…
        </div>
        <div style="width:70%;max-width:680px;background:#1f2937;border-radius:6px;overflow:hidden;border:1px solid #374151;">
            <div id="presim-bar" style="width:0%;height:14px;background:#10b981;transition:width .1s ease;"></div>
        </div>
        <div id="presim-text" style="color:#94a3b8;margin-top:10px;font-family:system-ui,Segoe UI,Roboto,Arial;font-size:13px;"></div>
    `
    document.body.appendChild(overlay)
    return overlay
}

// Batched presimulation so the UI can update; then seed animals and align to 06:00
function preSimulateAndStart() {
    const overlay = createPreSimOverlay()
    const bar = overlay.querySelector('#presim-bar')
    const text = overlay.querySelector('#presim-text')

    const params = new URLSearchParams(location.search)
    const host = location.hostname
    const isDevHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    const defaultPreSimDays = isStreamingWorld ? 0 : (isDevHost ? 7 : 30)
    const preSimDays = Number(params.get('preSimDays')) || defaultPreSimDays
    const overrideTicks = Number(params.get('preSimTicks')) || null
    // 1 day = 6 game hours = 360 ticks
    const totalTicks = overrideTicks ?? preSimDays * 360
    const batch = Math.max(200, Math.floor(totalTicks / 100)) // ~100 steps max

    let processed = 0
    let lastPct = -1
    const start = performance.now()
    console.log(`Pre-simulating flora: ${preSimDays} days (${totalTicks} ticks) in batches of ${batch}…`)

    if (totalTicks <= 0) {
        setTimeout(async () => {
            const spawnPoint = pickPlayerSpawnPoint()
            const spawnX = spawnPoint.x
            const spawnY = spawnPoint.y
            const player = new Pawn('player_1', 'Player', spawnX, spawnY)
            world.addEntity(player)
            world.setActiveChunkWindow?.(player.x, player.y, activeChunkRadius)
            trackedPlayerPawn = player
            playerMode.setTrackedPawn(player)
            renderer.setFollowEntity?.(player)
            window.player = player

            populateChunksAroundWorldPoint(player.x, player.y, activeChunkRadius)
            seedAnimalsNearPawn(player, activeChunkRadius)
            await seedCraftingResourcesNearPawn(player)
            ensureStarterViability(spawnX, spawnY, waterGen)

            const perception = player.traits?.detection ?? 100
            renderer.camera.setZoomToShowRadius?.(perception, 0.85)
            const school = new School('school_1', 'School', spawnX + 60, spawnY + 40)
            world.addEntity(school)

            overlay.remove()
            startMainLoop()
        }, 0)
        return
    }

    function updateProgress() {
        const pct = Math.floor((processed / totalTicks) * 100)
        if (pct !== lastPct) {
            lastPct = pct
            if (bar) bar.style.width = `${pct}%`
            const elapsed = (performance.now() - start) / 1000
            const rate = processed > 0 ? processed / elapsed : 0
            const remaining = Math.max(0, totalTicks - processed)
            const eta = rate > 0 ? Math.ceil(remaining / rate) : '—'
            if (text) text.textContent = `Presim ${pct}% • ${processed}/${totalTicks} ticks • ${rate.toFixed(0)} t/s • ETA ${eta}s`
            if (pct % 10 === 0) console.log(`[presim] ${pct}% (${processed}/${totalTicks})`)
        }
    }

    async function step() {
        const n = Math.min(batch, totalTicks - processed)
        if (n > 0) {
            world.fastForwardTicks(n)
            processed += n
            updateProgress()
        }
        if (processed < totalTicks) {
            setTimeout(step, 0) // yield to browser
        } else {
            // Align to 06:00 (24h) exactly
            const daySeconds = world.clock.gameDayHours * world.clock.gameHourSeconds
            const targetHour24 = 6
            const targetSeconds = Math.floor((targetHour24 / 24) * daySeconds)
            const curSeconds = world.clock.getGameSeconds() % daySeconds
            const secondsPerTick = world.clock.gameSecondsPerTick
            const deltaSeconds = (targetSeconds - curSeconds + daySeconds) % daySeconds
            const deltaTicks = Math.round(deltaSeconds / secondsPerTick)
            if (deltaTicks > 0) world.fastForwardTicks(deltaTicks)

            // Add one player pawn in a high-suitability settlement basin.
            const spawnPoint = pickPlayerSpawnPoint()
            const spawnX = spawnPoint.x
            const spawnY = spawnPoint.y
            ensureStarterViability(spawnX, spawnY, waterGen)
            const player = new Pawn('player_1', 'Player', spawnX, spawnY)
            world.addEntity(player)
            world.setActiveChunkWindow?.(player.x, player.y, activeChunkRadius)
            trackedPlayerPawn = player
            populateChunksAroundWorldPoint(player.x, player.y, activeChunkRadius)
            seedAnimalsNearPawn(player, activeChunkRadius)
            await seedCraftingResourcesNearPawn(player)
            playerMode.setTrackedPawn(player)
            renderer.setFollowEntity?.(player)
            try {
                window.player = player
            } catch (e) {
                // Ignore when not in browser
            }
            // TEST MODE: inject synthetic materials immediately so crafting can proceed
            try {
                const params = new URLSearchParams(location.search)
                if (params.get('testMode') === '1') {
                    player.inventory = player.inventory || []
                    const synthetic = [ { type: 'stick', name: 'synthetic_stick' }, { type: 'fiber', name: 'synthetic_fiber' } ]
                    for (const item of synthetic) {
                        try {
                            let added = false
                            if (typeof player.addItemToInventory === 'function') {
                                try { added = !!player.addItemToInventory(item) } catch (e) { added = false }
                            }
                            if (!added && player.inventory.length < (player.inventorySlots || 2)) {
                                player.inventory.push(item)
                                added = true
                            }
                            fetch('/_dev/log', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tag: 'test-inject-material', message: { pawn: player.name || player.id, item: item.type, added } })
                            }).catch(() => {})
                        } catch (e) { /* ignore per-test errors */ }
                    }
                }
            } catch (e) { }
            // In test mode, unlock a nearby-gatherable recipe for the player
            try {
                const params = new URLSearchParams(location.search)
                if (params.get('testMode') === '1') {
                    const recipesList = Array.isArray(RECIPES) ? RECIPES : Object.values(RECIPES || {})
                    const recipe = recipesList[0]
                    if (recipe) {
                        if (!player.unlocked) player.unlocked = { recipes: new Set() }
                        if (!player.unlocked.recipes) player.unlocked.recipes = new Set()
                        const key = recipe.name || recipe.id || (recipe.output && recipe.output.name) || JSON.stringify(recipe)
                        player.unlocked.recipes.add(key)
                        // Inform server for visibility
                        try { fetch('/_dev/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: 'test-unlock', message: `unlocked recipe ${key} for ${player.name}` }) }).catch(()=>{}) } catch(e){}
                    }
                }
                // In test mode, also inject synthetic materials into inventory to enable crafting
                try {
                    const params2 = new URLSearchParams(location.search)
                    if (params2.get('testMode') === '1') {
                        const synthetic = [{ type: 'stick', name: 'synthetic_stick' }, { type: 'fiber', name: 'synthetic_fiber' }]
                        for (const s of synthetic) {
                            try {
                                let added = false
                                if (typeof player.addItemToInventory === 'function') {
                                    added = !!player.addItemToInventory(s)
                                } else {
                                    player.inventory = player.inventory || []
                                    if (player.inventory.length < (player.inventorySlots || 2)) {
                                        player.inventory.push(s)
                                        added = true
                                    }
                                }
                                fetch('/_dev/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: 'test-inject-material', message: { pawn: player.name||player.id, item: s.type, added } }) }).catch(()=>{})
                            } catch (e) {}
                        }
                    }
                } catch (e) {}
            } catch (e) {}
            // Zoom to pawn perception distance (use detection as proxy)
            const perception = player.traits?.detection ?? 100
            renderer.camera.setZoomToShowRadius?.(perception, 0.85)
            // Place a school structure nearby for midlevel skill development
            const school = new School('school_1', 'School', spawnX + 60, spawnY + 40)
            world.addEntity(school)
            console.log(`Pre-sim complete in ${(performance.now() - start).toFixed(0)} ms`)
            overlay.remove()
            // Notify server that client finished presim and created player
            try {
                fetch('/_dev/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tag: 'client-ready', message: `player:${player?.name || player?.id || 'unknown'}` })
                }).catch(() => {})

                // Also send a safe, minimal dump of the player's craft-related state
                const safeDump = {
                    pawn: player?.name || player?.id || null,
                    inventory: (player?.inventory || []).map(i => i?.name || i?.type || null),
                    inventorySlots: player?.inventorySlots || 0,
                    hasCraftMethod: typeof player?.craft === 'function',
                    hasAddItemMethod: typeof player?.addItemToInventory === 'function',
                    unlockedRecipesCount: player?.unlocked?.recipes ? (player.unlocked.recipes.size || Object.keys(player.unlocked.recipes || {}).length) : 0,
                    currentGoalType: player?.goals?.currentGoal?.type || player?.currentGoal?.type || null
                }
                fetch('/_dev/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tag: 'force-dump', message: safeDump })
                }).catch(() => {})
            } catch (e) {}
            // If running in test mode, attempt a deterministic craft shortly after
            try {
                const paramsCraft = new URLSearchParams(location.search)
                if (paramsCraft.get('testMode') === '1') {
                    setTimeout(() => {
                        try {
                            const recipesList = Array.isArray(RECIPES) ? RECIPES : Object.values(RECIPES || {})
                            const recipe = recipesList[0]
                            if (!recipe) {
                                fetch('/_dev/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: 'craft-fail', message: 'no-recipe-available' }) }).catch(()=>{})
                                return
                            }
                            let returned
                            try {
                                // Try invoking craft with the recipe object (implementations vary)
                                returned = player.craft(recipe)
                            } catch (err) {
                                try { returned = player.craft(recipe.name || recipe.id) } catch (err2) { returned = { error: String(err2 || err) } }
                            }
                            fetch('/_dev/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: 'craft-invoked', message: { pawn: player?.name || player?.id, recipe: recipe.name || recipe.id || null, returned } }) }).catch(()=>{})
                        } catch (e) {
                            fetch('/_dev/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: 'craft-error', message: String(e) }) }).catch(()=>{})
                        }
                    }, 2500)
                }
            } catch (e) {}
            startMainLoop()
        }
    }

    updateProgress()
    step()
}
preSimulateAndStart()

// Controls are initialized after presim completes
let controls
let _modeSwitcherUpdate = null
let _interactionPanel = null
let _feedbackUI = null

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
            // Refresh mode-switcher unlock state every 60 ticks (~30 s at 2 ticks/s)
            if (world.clock.currentTick % 60 === 0) _modeSwitcherUpdate?.()
        } else {
            // When paused, ensure the clock doesn't accumulate time
            world.clock.lastTimestamp = timestamp
        }
        
        // Always render to show current state
        renderer.render()
        
        // Continue the animation loop
        requestAnimationFrame(simulationLoop)
    } catch (error) {
        console.error('Error in simulation loop:', error)
        // Try to continue despite errors
        setTimeout(() => requestAnimationFrame(simulationLoop), 100)
    }
}

// Loop starts in startMainLoop() after presim
