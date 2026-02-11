import World from './core/World.js'
import CanvasRenderer from './rendering/CanvasRenderer.js'
import setupControls from './ui/controls.js'
import { Animal, Pawn } from './models/entities/index.js'
import { School } from './models/entities/immobile/index.js'
// Focus on world simulation (no pawns, animals OK)
import FloraGenerator from './core/FloraGenerator.js'
import WaterGenerator from './core/WaterGenerator.js'
import RECIPES from './models/crafting/Recipes.js'
import { injectRecipes } from './models/entities/mobile/GoalPlanner.js'

// Initialize goal planner with recipes
injectRecipes(RECIPES)

// Create a larger world
const world = new World(2000, 2000)
const renderer = new CanvasRenderer(world, 'game-canvas')

// Expose runtime objects for debugging in DevTools
try {
    window.world = world
    window.renderer = renderer
} catch (e) {
    // Not running in browser context (e.g., tests) - ignore
}

// Add water features: a river, a couple lakes, and scattered puddles
const waterGen = new WaterGenerator(world)
// Long meandering river from west to east
waterGen.placeRiver({
    start: { x: 40, y: world.height * 0.55 },
    end: { x: world.width - 40, y: world.height * 0.45 },
    width: 18,
    spacing: 24,
    meander: 0.45,
    name: 'River'
})
// Two lakes in different regions
waterGen.placeLake(world.width * 0.28, world.height * 0.78, 90, { name: 'Lake A' })
waterGen.placeLake(world.width * 0.78, world.height * 0.22, 70, { name: 'Lake B' })
// Scattered low-capacity puddles that deplete fast once animals drink
waterGen.placePuddles(18, { x: world.width * 0.1, y: world.height * 0.15, w: world.width * 0.8, h: world.height * 0.7 })

// Populate world with flora instead of abstract resources
const floraGenerator = new FloraGenerator(world)
floraGenerator.generateFlora()
// Add a few forest clumps
const centers = [
    { x: world.width * 0.25, y: world.height * 0.3, r: 140 },
    { x: world.width * 0.65, y: world.height * 0.6, r: 160 },
    { x: world.width * 0.5, y: world.height * 0.2, r: 110 }
]
for (const c of centers) floraGenerator.placeForestClump(c.x, c.y, c.r)

// No pawn/animal initialization – let flora simulate toward equilibrium
// Seed a small animal population for basic ecology (herbivores + one predator)
function seedAnimals() {
    const rabbits = 40
    for (let i = 0; i < rabbits; i++) {
        const x = Math.round(Math.random() * world.width)
        const y = Math.round(Math.random() * world.height)
        const a = new Animal(`rabbit_${i}`, 'Rabbit', x, y)
        a.species = 'rabbit'
        a.diet = 'herbivore'
        a.traits.speed = 25
        world.addEntity(a)
    }
    // One fox
    const fox = new Animal('fox_1', 'Fox', Math.round(Math.random() * world.width), Math.round(Math.random() * world.height))
    fox.species = 'fox'
    fox.diet = 'carnivore'
    fox.predator = true
    fox.traits.speed = 28
    world.addEntity(fox)
}

// Seed harvestable crafting resources (rocks, sticks, fiber plants)
async function seedCraftingResources() {
    const { Rock, Stick, FiberPlant } = await import('./models/entities/resources/index.js')
    
    // Scatter rocks (30-40)
    const rockCount = 30 + Math.floor(Math.random() * 10)
    for (let i = 0; i < rockCount; i++) {
        const x = Math.round(Math.random() * world.width)
        const y = Math.round(Math.random() * world.height)
        const rock = new Rock(`rock_${i}`, x, y)
        world.addEntity(rock)
    }
    
    // Scatter sticks (40-60, more common)
    const stickCount = 40 + Math.floor(Math.random() * 20)
    for (let i = 0; i < stickCount; i++) {
        const x = Math.round(Math.random() * world.width)
        const y = Math.round(Math.random() * world.height)
        const stick = new Stick(`stick_${i}`, x, y)
        world.addEntity(stick)
    }
    
    // Fiber plants in clusters (20-30)
    const fiberCount = 20 + Math.floor(Math.random() * 10)
    for (let i = 0; i < fiberCount; i++) {
        const x = Math.round(Math.random() * world.width)
        const y = Math.round(Math.random() * world.height)
        const fiber = new FiberPlant(`fiber_${i}`, x, y)
        world.addEntity(fiber)
    }
    
    console.log(`Seeded ${rockCount} rocks, ${stickCount} sticks, ${fiberCount} fiber plants`)
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
    const preSimDays = Number(params.get('preSimDays')) || 30
    const overrideTicks = Number(params.get('preSimTicks')) || null
    // 1 day = 6 game hours = 360 ticks
    const totalTicks = overrideTicks ?? preSimDays * 360
    const batch = Math.max(200, Math.floor(totalTicks / 100)) // ~100 steps max

    let processed = 0
    let lastPct = -1
    const start = performance.now()
    console.log(`Pre-simulating flora: ${preSimDays} days (${totalTicks} ticks) in batches of ${batch}…`)

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

            seedAnimals()
            await seedCraftingResources()
            // Add one player pawn and auto-follow
            const spawnX = Math.round(world.width * 0.5)
            const spawnY = Math.round(world.height * 0.5)
            const player = new Pawn('player_1', 'Player', spawnX, spawnY)
            world.addEntity(player)
            renderer.setFollowEntity?.(player)
            try {
                window.player = player
            } catch (e) {
                // Ignore when not in browser
            }
            // Zoom to pawn perception distance (use detection as proxy)
            const perception = player.traits?.detection ?? 100
            renderer.camera.setZoomToShowRadius?.(perception, 0.85)
            // Place a school structure nearby for midlevel skill development
            const school = new School('school_1', 'School', spawnX + 60, spawnY + 40)
            world.addEntity(school)
            console.log(`Pre-sim complete in ${(performance.now() - start).toFixed(0)} ms`)
            overlay.remove()
            startMainLoop()
        }
    }

    updateProgress()
    step()
}
preSimulateAndStart()

// Controls are initialized after presim completes
let controls
function startMainLoop() {
    // Setup UI controls
    controls = setupControls(world, renderer)

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
            world.update(timestamp)
            updateWorldStats()  // Update world stats display
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

// Update pawn status display
// World stats tracking for equilibrium observation
const statsHistory = []
const maxSamples = 60
const hasTag = (e, tag) => Array.isArray(e?.tags) ? e.tags.includes(tag) : e?.tags?.has?.(tag)

function updateWorldStats() {
    const statusPanel = document.getElementById('pawn-status')
    if (!statusPanel) return

    const entities = Array.from(world.entitiesMap.values())
    const isType = (e, t) => e.type === t
    const trees = entities.filter(e => isType(e, 'tree')).length
    const bushes = entities.filter(e => isType(e, 'bush')).length
    const grassPatches = entities.filter(e => isType(e, 'grass'))
    const grassCount = grassPatches.length
    const grassPopulation = grassPatches.reduce((sum, g) => sum + (g.population ?? 0), 0)

    const foodSources = entities.filter(e => hasTag(e, 'food')).length
    const coverSources = entities.filter(e => hasTag(e, 'cover')).length
    const waterSources = entities.filter(e => hasTag(e, 'water')).length

    const tick = world.clock.currentTick
    statsHistory.push({ tick, trees, bushes, grassCount, grassPopulation, foodSources, coverSources, waterSources })
    if (statsHistory.length > maxSamples) statsHistory.shift()

    const delta = (key, window = 10) => {
        const from = statsHistory[Math.max(0, statsHistory.length - 1 - window)]
        const to = statsHistory[statsHistory.length - 1]
        if (!from || !to) return 0
        const dv = (to[key] - from[key]) / Math.max(1, window)
        return Math.round(dv * 10) / 10
    }

    const html = `
        <div><strong>Tick:</strong> ${tick} <strong>Total:</strong> ${world.entitiesMap.size}</div>
        <div>
            Trees: ${trees} (Δ${delta('trees')}/10t) |
            Bushes: ${bushes} (Δ${delta('bushes')}/10t) |
            Grass patches: ${grassCount} (Δ${delta('grassCount')}/10t)
        </div>
        <div>
            Grass population: ${grassPopulation} (Δ${delta('grassPopulation')}/10t)
        </div>
        <div>
            Food sources: ${foodSources} (Δ${delta('foodSources')}/10t) |
            Cover sources: ${coverSources} (Δ${delta('coverSources')}/10t) |
            Water sources: ${waterSources}
        </div>
    `
    statusPanel.innerHTML = html
}

// Loop starts in startMainLoop() after presim
