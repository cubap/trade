/**
 * Line of sight (#80).
 *
 * Pure helpers that decide whether an observer can see a target, and *what*
 * blocked the view first. Terrain ridges, unbroken dense cover, and the range
 * that cover leaves you are all modelled here so the simulation, the UI hints
 * and the tests share one explanation of "why is that hidden?".
 *
 * Deliberately import-free (like MovementTerrain.js) so it runs on the server,
 * in the browser, and under `node --test` without a DOM.
 *
 * Coordinates are the world's planar pair (x, y); `sampleElevation` returns the
 * ground height on the third axis.
 */

export const EYE_HEIGHT = 2.5              // world units above the ground a pawn looks from
export const TARGET_HEIGHT = 1.0           // ...and how much of a resource pokes up
export const SAMPLE_STEP = 2               // world units between probes
export const MAX_SAMPLES = 48              // bounded cost: step grows on long rays
// The generated map wobbles 2-4 units over short spans (p90 ~2.3, p99 ~4.1), so a
// crest has to beat that much before it counts as hiding something. Anything
// tighter and every pawn is blind in a gully.
export const RIDGE_TOLERANCE = 3.5
// Chunk coverDensity on the current map is 24 (plains/hills) to 60 (forest). Only
// ground denser than this hides a specific spot outright; today nothing qualifies,
// which is deliberate — forest dims your view instead of walling it off.
export const COVER_BLOCK_DENSITY = 0.7     // normalised (0-1) cover that counts as thick
// Above this, each extra unit of thickness starts eating into range.
export const COVER_SOFT_THRESHOLD = 0.35
export const COVER_PENETRATION = 18        // unbroken dense units you can see into
export const SAME_CHUNK_PENETRATION = 36   // ...when both ends share the chunk
export const COVER_RANGE_PENALTY = 0.6     // fraction of thick ground removed from range
export const MIN_RANGE_FACTOR = 0.45       // never shrink vision below this share
export const COORD_QUANTUM = 1             // cache key rounding (world units)

export const BLOCKERS = {
    ridge: 'a ridge is in the way',
    cover: 'the vegetation is too thick',
    range: 'it is farther than I can see from here',
    water: 'the water bends my view'
}

function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value))
}

function dist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay)
}

/**
 * Build the { sampleElevation, coverAt, chunkOf } trio a ray march needs out of
 * a chunk manager. Returns null when there is no terrain to consult, so callers
 * can fail open instead of blinding every pawn during early boot or in tests
 * that use a bare World.
 */
export function createTerrainLosContext(chunkManager) {
    const cm = chunkManager
    if (!cm || typeof cm.getElevationAt !== 'function') return null

    return {
        sampleElevation: (x, y) => cm.getElevationAt(x, y) ?? 0,
        coverAt: (x, y) => {
            const chunk = cm.getChunkAtPosition?.(x, y)
            if (!chunk) return 0
            const raw = chunk.coverDensity ?? 0
            // coverDensity is 0-100 on Chunk; stay tolerant of normalised input.
            return raw > 1 ? clamp(raw / 100, 0, 1) : clamp(raw, 0, 1)
        },
        chunkOf: (x, y) => cm.getChunkCoordsAtPosition?.(x, y) ?? null
    }
}

/**
 * March from -> to and report the first thing that gets in the way.
 *
 * @returns {{visible: boolean, reason: string|null, blocker: object|null,
 *            distance: number, rangeUsed: number, samples: number}}
 */
export function analyzeLineOfSight(context, from, to, options = {}) {
    const baseRange = options.baseRange ?? Infinity
    const distance = dist(from.x, from.y, to.x, to.y)

    // No terrain data (bare World, missing sampler): never block, but say why.
    if (!context || typeof context.sampleElevation !== 'function') {
        return { visible: true, reason: null, blocker: null, distance, rangeUsed: baseRange, samples: 0, degraded: true }
    }

    const eyeHeight = options.eyeHeight ?? EYE_HEIGHT
    const targetHeight = options.targetHeight ?? TARGET_HEIGHT
    const tolerance = options.ridgeTolerance ?? RIDGE_TOLERANCE
    const coverThreshold = options.coverDensityThreshold ?? COVER_BLOCK_DENSITY
    const softThreshold = options.coverSoftThreshold ?? COVER_SOFT_THRESHOLD
    const maxSamples = options.maxSamples ?? MAX_SAMPLES

    const fromElev = context.sampleElevation(from.x, from.y)
    const toElev = context.sampleElevation(to.x, to.y)
    const eyeZ = fromElev + eyeHeight
    const targetZ = toElev + targetHeight

    // Same chunk: the pawn knows this patch of brush, so it can see further into it.
    const sameChunk = sameChunkId(context, from, to)
    const penetration = sameChunk ? (options.sameChunkPenetration ?? SAME_CHUNK_PENETRATION) : (options.coverPenetration ?? COVER_PENETRATION)

    const step = distance > maxSamples * SAMPLE_STEP ? distance / maxSamples : SAMPLE_STEP
    const steps = Math.max(1, Math.floor(distance / step))

    let denseRun = 0
    let denseSamples = 0
    let thickSum = 0
    let firstCoverBlock = null
    let firstRidgeBlock = null

    for (let i = 1; i < steps; i++) {
        const t = i / steps
        const x = from.x + (to.x - from.x) * t
        const y = from.y + (to.y - from.y) * t
        const travelled = distance * t
        const rayZ = eyeZ + (targetZ - eyeZ) * t

        const ground = context.sampleElevation(x, y)
        if (ground - tolerance > rayZ) {
            firstRidgeBlock = {
                kind: 'ridge',
                x, y,
                distanceFromObserver: travelled,
                clearance: round(ground - rayZ)
            }
            break
        }

        const cover = typeof context.coverAt === 'function' ? context.coverAt(x, y) : 0
        // Graded dimming: anything past the soft threshold chips away at range,
        // so today's forest (0.6) halves nothing but does shorten the horizon.
        thickSum += clamp((cover - softThreshold) / (1 - softThreshold), 0, 1)
        if (cover >= coverThreshold) {
            denseSamples++
            denseRun += step
            if (!firstCoverBlock && denseRun > penetration) {
                firstCoverBlock = {
                    kind: 'cover',
                    x, y,
                    distanceFromObserver: travelled,
                    cover: round(cover)
                }
                break
            }
        } else {
            denseRun = 0
        }
    }

    // Thick ground along the ray shortens how far the pawn can see at all. A ray
    // that broke early on a real blocker only counts what it actually walked.
    const denseFraction = steps > 1 ? thickSum / (steps - 1) : 0
    const rangeFactor = clamp(1 - denseFraction * COVER_RANGE_PENALTY, MIN_RANGE_FACTOR, 1)
    const rangeUsed = Number.isFinite(baseRange) ? baseRange * rangeFactor : Infinity

    if (Number.isFinite(baseRange) && distance > rangeUsed) {
        const t = rangeUsed / distance
        return {
            visible: false,
            reason: 'range',
            blocker: {
                kind: 'range',
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t,
                distanceFromObserver: round(rangeUsed),
                rangeUsed: round(rangeUsed)
            },
            distance, rangeUsed, samples: steps, denseFraction: round(denseFraction)
        }
    }

    if (firstRidgeBlock) {
        return { visible: false, reason: 'ridge', blocker: firstRidgeBlock, distance, rangeUsed, samples: steps, denseFraction: round(denseFraction) }
    }
    if (firstCoverBlock) {
        return { visible: false, reason: 'cover', blocker: firstCoverBlock, distance, rangeUsed, samples: steps, denseFraction: round(denseFraction) }
    }

    return { visible: true, reason: null, blocker: null, distance, rangeUsed, samples: steps, denseFraction: round(denseFraction) }
}

function sameChunkId(context, from, to) {
    if (typeof context.chunkOf !== 'function') return false
    const a = context.chunkOf(from.x, from.y)
    const b = context.chunkOf(to.x, to.y)
    if (!a || !b) return false
    return a.chunkX === b.chunkX && a.chunkY === b.chunkY
}

export function hasLineOfSight(context, from, to, options = {}) {
    return analyzeLineOfSight(context, from, to, options).visible
}

/** Human-readable "why can't I see it", used by pawn thoughts and UI hints. */
export function describeBlocker(result) {
    if (!result || result.visible) return ''
    const text = BLOCKERS[result.reason] ?? 'something is in the way'
    const blocker = result.blocker
    const at = blocker?.distanceFromObserver != null ? ` about ${Math.round(blocker.distanceFromObserver)}m out` : ''
    return `${text}${at}`
}

function quant(value, quantum) {
    return Math.round(value / quantum) * quantum
}

/**
 * Per-tick memo of ray marches. A pawn probes dozens of resources every tick and
 * the answers only change when the world does, so results are cached against a
 * tick stamp and dropped when it advances.
 */
export function createLineOfSightCache(context, options = {}) {
    const quantum = options.quantum ?? COORD_QUANTUM
    const entries = new Map()
    let stamp = options.tick ?? 0

    const keyFor = (from, to, baseRange) => {
        const a = [quant(from.x, quantum), quant(from.y, quantum)]
        const b = [quant(to.x, quantum), quant(to.y, quantum)]
        // Symmetric: a->b and b->a share the march (both ends use the same ray).
        const [p, q] = (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? [a, b] : [b, a]
        return `${stamp}|${p[0]},${p[1]}|${q[0]},${q[1]}|${baseRange ?? 'inf'}`
    }

    return {
        beginTick(nextStamp) {
            if (nextStamp === stamp) return
            stamp = nextStamp
            entries.clear()
        },
        get size() {
            return entries.size
        },
        check(from, to, opts = {}) {
            if (!context) return analyzeLineOfSight(null, from, to, opts)
            const key = keyFor(from, to, opts.baseRange)
            const hit = entries.get(key)
            if (hit) return hit
            const result = analyzeLineOfSight(context, from, to, opts)
            entries.set(key, result)
            return result
        }
    }
}

function round(value) {
    return Math.round(value * 1000) / 1000
}

export default { analyzeLineOfSight, hasLineOfSight, createTerrainLosContext, createLineOfSightCache, describeBlocker }
