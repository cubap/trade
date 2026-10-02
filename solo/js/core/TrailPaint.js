/**
 * TrailPaint.js — making pathways visible (#93).
 *
 * #77 gave the world a decaying wear field that entities deposit on as they
 * walk and steer by when they choose a route. Nothing drew it, so the mechanic
 * was invisible: a player could not see the road their pawn had worn, tell a
 * deer run from a footpath, or get any feedback for the orienteering/tracking
 * progress the mechanic pays out.
 *
 * This module is the translation layer between the simulation's numbers and
 * something a human can read at a glance. It is deliberately pure: it takes a
 * TrailField and a world-space rect and returns quads with positions, sizes,
 * colours and alphas. No canvas, no three.js, no `window` - so the rules below
 * are testable under `node --test` and both views are guaranteed to agree.
 *
 * Why a paint list instead of tinting the terrain:
 *   TrailField cells are 8 world units, while the three.js ground mesh is built
 *   from clamp(worldWidth / 50, 100, 500) segments - a 25000-unit world gets 500
 *   segments, i.e. 50 units per vertex. Vertex colours are six times too coarse
 *   to show a path a cell wide, so blending into the ground mesh would smear the
 *   corridor into a stain. A paint list lets each view render the same cells at
 *   their true scale: filled quads in 2D, a terrain-hugging overlay mesh in 3D.
 *
 * Cost is bounded by three habits:
 *   1. views ask for a rect (what is on screen), never the whole world;
 *   2. paintSignature tells a view whether anything changed, so a field nobody
 *      is walking on costs one string compare per frame;
 *   3. maxCells truncates the feed (reported, not silently dropped) so a
 *      pathological map cannot stall a frame.
 *
 * Related constants live in TrailField.js, which stays import-free on purpose;
 * this module is where a renderer is allowed to know about trails.
 */

import { TRAIL_FOLLOW_THRESHOLD, TRAIL_EPSILON } from './TrailField.js'

/**
 * A cell has to be worn at least this much to be drawn. This is the same number
 * the steering code uses to decide a trail is worth turning for, so the ground
 * you can *see* is the ground a pawn can *feel* - the issue's constraint that
 * features finer than a cell should not be drawn as if they mattered.
 */
export const TRAIL_PAINT_THRESHOLD = TRAIL_FOLLOW_THRESHOLD

// Wear-to-opacity curve. Saturating well below full opacity keeps worn ground
// reading as dirt rather than as a painted stripe, and lets the busiest crossing
// still look busier than a barely-used one.
export const TRAIL_PAINT_MIN_ALPHA = 0.07
export const TRAIL_PAINT_MAX_ALPHA = 0.58
export const TRAIL_PAINT_ALPHA_EXPONENT = 0.7

// Cells per frame per view. A 2D viewport at zoom 0.1 is 19200 units wide, which
// is far more cells than this, so the feed is deliberately the *strongest*
// cells: faint background wear dropping out is the right failure mode.
export const TRAIL_PAINT_MAX_CELLS = 900

// Ticks between refreshes. The field only changes when something walks, and one
// game day is 120 ticks, so a few Hz is far more often than paths visibly form.
export const TRAIL_PAINT_REFRESH_TICKS = 4

// Sub-unit randomness so a straight corridor does not read as a row of tiles.
// Derived from the cell coordinates (never Math.random) so the ground cannot
// shimmer between frames.
export const TRAIL_PAINT_JITTER = 0.16
export const TRAIL_PAINT_GROWTH = 0.30

/** The colour of beaten earth when nothing is known about who beat it. */
export const TRAIL_DIRT_COLOR = '#8a6f4d'

/**
 * Per-kind tints, keyed by `entity.trailKind` ('pawn', 'forager', 'predator',
 * or an animal's subtype). Different by *tone*, not by saturation: these are
 * stains in dirt, and a bright animal-colour overlay would read as a debug view.
 * Anything unlisted falls back to plain dirt, so a new species cannot invent a
 * new colour mid-game.
 */
export const TRAIL_KIND_COLORS = {
    pawn: TRAIL_DIRT_COLOR,
    forager: '#a3906a',
    predator: '#7c5a4e'
}

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback
}

/** Deterministic 0..1 hash of a cell coordinate pair. */
export function hash2(cx, cy) {
    const h = (Math.trunc(finite(cx)) * 374761393 + Math.trunc(finite(cy)) * 668265263) >>> 0
    const mixed = (h ^ (h >>> 13)) >>> 0
    const spun = Math.imul(mixed, 1274126177) >>> 0
    return ((spun ^ (spun >>> 16)) >>> 0) / 4294967296
}

/** Hex colour for a trail attribution ('pawn' | 'forager' | 'predator' | …). */
export function trailColorFor(kind) {
    if (typeof kind !== 'string' || kind.length === 0) return TRAIL_DIRT_COLOR
    return TRAIL_KIND_COLORS[kind] ?? TRAIL_DIRT_COLOR
}

/** `#rgb` / `#rrggbb` to 0..1 channels. Junk reads white rather than black. */
export function hexRgb(hex) {
    const text = String(hex ?? '').trim().replace('#', '')
    const full = text.length === 3 ? text.split('').map(c => c + c).join('') : text
    if (full.length < 6) return [1, 1, 1]
    const value = Number.parseInt(full.slice(0, 6), 16)
    if (!Number.isFinite(value)) return [1, 1, 1]
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

// Quad corners, counter-clockwise seen from above. A 3D material draws both
// faces, so the winding is only there to keep the two triangles of a cell
// sharing an edge.
const CORNERS = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]

/**
 * Copies a paint feed into preallocated vertex attributes: four vertices and
 * two triangles per cell, colours with the cell's wear as vertex alpha.
 *
 * This is the 3D half of #93 kept out of ThreeRenderer for the same reason the
 * rest of the paint maths is: three.js cannot be imported under `node --test`
 * (the renderer pulls its loaders from the served /vendor copy), so anything
 * the tests are meant to trust has to live in a module that can.
 *
 * @param {Array<object>} cells cells from trailPaintFor, strongest first
 * @param {{count:number,setXYZ:Function}} position world-space XYZ attribute
 * @param {{count:number,setXYZ:Function,setXYZW?:Function}} color RGBA attribute
 * @param {{heightAt?: (x:number, y:number) => number, lift?: number, maxCells?: number}} options
 *   `heightAt` is the renderer's ground sampler (the overlay must hug the
 *   surface the player sees, not float over it); `lift` clears z-fighting.
 * @returns {number} cells written; the caller draws `count * 6` indices
 */
export function writeTrailQuads(cells, position, color, options = {}) {
    const list = Array.isArray(cells) ? cells : []
    const heightAt = typeof options.heightAt === 'function' ? options.heightAt : () => 0
    const lift = finite(options.lift, 0)
    const cap = Math.max(0, Math.floor(finite(options.maxCells, TRAIL_PAINT_MAX_CELLS)))
    // The attributes are sized once at the cap, so a feed can never overrun them.
    const capacity = Math.min(
        cap,
        Math.floor(finite(position?.count, 0) / 4),
        Math.floor(finite(color?.count, 0) / 4)
    )
    const count = Math.min(list.length, capacity)

    for (let i = 0; i < count; i++) {
        const cell = list[i]
        const [r, g, b] = hexRgb(cell.color)
        const alpha = finite(cell.alpha)
        const v = i * 4
        for (let k = 0; k < 4; k++) {
            const px = finite(cell.x) + CORNERS[k][0] * finite(cell.size)
            const py = finite(cell.y) + CORNERS[k][1] * finite(cell.size)
            const ground = finite(heightAt(px, py), 0)
            position.setXYZ(v + k, px, ground + lift, py)
            if (typeof color.setXYZW === 'function') color.setXYZW(v + k, r, g, b, alpha)
            else color.setXYZ(v + k, r, g, b)
        }
    }

    position.needsUpdate = true
    color.needsUpdate = true
    return count
}

/** Wear as a 0..1 fraction of the field's saturation point. */
export function trailNorm(intensity, maxIntensity) {
    const cap = finite(maxIntensity, 1) || 1
    const value = finite(intensity)
    if (value <= 0) return 0
    return Math.min(1, value / cap)
}

/** Opacity for a 0..1 wear fraction, clamped into the paint range. */
export function trailAlpha(norm) {
    const t = Math.min(1, Math.max(0, finite(norm)))
    if (t <= 0) return 0
    return TRAIL_PAINT_MIN_ALPHA
        + (TRAIL_PAINT_MAX_ALPHA - TRAIL_PAINT_MIN_ALPHA) * Math.pow(t, TRAIL_PAINT_ALPHA_EXPONENT)
}

/**
 * Cheap "did anything change" key for a view's cache. `deposits` only moves when
 * something walks, so an idle world rebuilds nothing; the tick bucket and the
 * quantised rect are in here because decay and panning *do* change the answer.
 */
export function paintSignature({ field, rect, tick = 0, threshold = TRAIL_PAINT_THRESHOLD, debug = false } = {}) {
    if (!field || !rect) return ''
    const bucket = Math.floor(finite(tick) / TRAIL_PAINT_REFRESH_TICKS)
    const q = 64
    return `${field.deposits}|${bucket}|${threshold}|${debug ? 1 : 0}`
        + `|${Math.round(finite(rect.x0) / q)},${Math.round(finite(rect.y0) / q)}`
        + `|${Math.round(finite(rect.x1) / q)},${Math.round(finite(rect.y1) / q)}`
}

/**
 * The paint feed for one view.
 *
 * @param {object} options
 * @param {import('./TrailField.js').TrailField|null} options.field world.trailField
 * @param {{x0:number,y0:number,x1:number,y1:number}} options rect world-space
 *   region the view can actually see
 * @param {number} [options.tick] current game tick (decay is evaluated at it)
 * @param {number} [options.threshold] wear floor, see TRAIL_PAINT_THRESHOLD
 * @param {number} [options.maxCells] cap on the feed, see TRAIL_PAINT_MAX_CELLS
 * @param {boolean} [options.debug] raw grid: exact cell bounds, one colour per
 *   kind, no jitter - what `?trails=1` draws, and what a tracking UI would use
 * @returns {{cells: Array<object>, worn: number, truncated: number, peak: number, debug: boolean}}
 *   `cells` are strongest-worn first and carry `{cx, cy, x, y, size, intensity,
 *   norm, alpha, color, kind, key}`. `worn` counts every drawable cell in the
 *   rect, `truncated` how many the cap left out.
 */
export function trailPaintFor({
    field,
    rect,
    tick = field?.tick ?? 0,
    threshold = TRAIL_PAINT_THRESHOLD,
    maxCells = TRAIL_PAINT_MAX_CELLS,
    debug = false
} = {}) {
    const empty = { cells: [], worn: 0, truncated: 0, peak: 0, debug }
    if (!field || typeof field.cellsInRect !== 'function' || !rect) return empty

    // TRAIL_EPSILON rather than the paint threshold for the lookup: `worn` should
    // see ground that is fading but still measurable, and the cap has to be spent
    // on the right cells rather than chosen from only the darkest ones.
    const found = field.cellsInRect(rect.x0, rect.y0, rect.x1, rect.y1, {
        threshold: TRAIL_EPSILON,
        tick
    })

    const floor = finite(threshold, TRAIL_PAINT_THRESHOLD)
    const cap = Math.max(0, Math.floor(finite(maxCells, TRAIL_PAINT_MAX_CELLS)))
    const cellSize = field.cellSize
    const capWear = field.maxIntensity

    let worn = 0
    let peak = 0
    const cells = []
    for (const cell of found) {
        if (!(cell.intensity > floor)) continue
        worn++
        if (cell.intensity > peak) peak = cell.intensity
        if (cells.length >= cap) continue

        const norm = trailNorm(cell.intensity, capWear)
        // `found` is sorted strongest-first, and the wobble is a pure function of
        // the cell, so the same ground cannot shimmer between frames.
        const jx = (hash2(cell.cx, cell.cy) - 0.5) * 2 * TRAIL_PAINT_JITTER * cellSize
        const jy = (hash2(cell.cy + 7919, cell.cx - 104729) - 0.5) * 2 * TRAIL_PAINT_JITTER * cellSize
        const key = `${cell.cx}:${cell.cy}`
        const color = trailColorFor(cell.kind)

        if (debug) {
            cells.push({
                cx: cell.cx, cy: cell.cy, x: cell.x, y: cell.y,
                size: cellSize, intensity: cell.intensity, norm,
                alpha: 0.22 + 0.55 * norm, color, kind: cell.kind, key
            })
            continue
        }

        // Growing the quad past one cell lets neighbours overlap into a band.
        // A path *is* a line of worn cells; drawing each one exactly its own size
        // draws a chessboard instead.
        cells.push({
            cx: cell.cx, cy: cell.cy,
            x: cell.x + jx, y: cell.y + jy,
            size: cellSize * (1 + TRAIL_PAINT_GROWTH * hash2(cell.cx - 31, cell.cy + 17)),
            intensity: cell.intensity, norm,
            alpha: trailAlpha(norm), color, kind: cell.kind, key
        })
    }

    return { cells, worn, truncated: Math.max(0, worn - cap), peak, debug }
}

/**
 * One-line readout of what the ground currently says, for a HUD panel. Kept
 * separate from the paint feed so a panel can show the truth without a rect.
 */
export function trailReadout(field, tick = field?.tick ?? 0) {
    if (!field || typeof field.stats !== 'function') return 'no ground worn yet'
    const stats = field.stats(tick)
    if (!stats.wornCells) return 'no ground worn yet'
    const kinds = typeof field.kindsInUse === 'function' ? field.kindsInUse(tick) : []
    const who = kinds.slice(0, 3)
        .map(entry => `${entry.kind} ${Math.round(entry.intensity)}`)
        .join(', ')
    return `paths ${stats.wornCells} cells · peak ${Math.round(stats.peak)}${who ? ` · ${who}` : ''}`
}

/** `?trails=1` draws the raw cell grid instead of dirt. Pure, so it is testable. */
export function trailDebugFromParams(params) {
    const raw = params?.get?.('trails')
    if (raw === null || raw === undefined) return false
    const value = String(raw).trim().toLowerCase()
    return value !== '0' && value !== 'false' && value !== 'off'
}

export default trailPaintFor
