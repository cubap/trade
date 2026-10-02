/**
 * TrailField.js — pathways (#77).
 *
 * A sparse, decaying grid of *footfall*: every step a mobile entity takes wears
 * the ground a little, wear fades when nothing walks there, and enough wear in
 * a line is a trail. Nothing here knows about entities, terrain or rendering:
 * it is a scalar field plus a steering helper, which is what makes the
 * emergent part of the issue ("pawns create footpaths through repeated travel")
 * testable without a browser.
 *
 * The loop that produces footpaths:
 *
 *   deposit()      walking entities add wear to the cell under them
 *   fade()         unused wear decays exponentially (half-life in ticks)
 *   followBias()   an entity about to step asks "which way is more worn?" and
 *                  turns a little toward it, scaled by its own trail affinity
 *
 * Because the bias points at *existing* wear, the second walker makes the
 * corridor more attractive for the third: repeated travel between the same two
 * places narrows into a single path instead of a trampled band.
 *
 * Decay is lazy. A cell stores its intensity plus the tick it was last written,
 * and reads compute `intensity * 0.5 ** (age / halfLife)` without mutating
 * anything, so there is no per-tick sweep over the map. Memory is bounded by
 * the walkable area / cellSize² (a 2000×2000 map caps out near 62k cells, and
 * only ground that is actually walked allocates), with prune() available for a
 * host that wants the memory back after a long session.
 *
 * Import-free on purpose, like LineOfSight.js and MovementTerrain.js: this runs
 * under `node --test`, in the browser, and in a headless simulation.
 */

// World units per trail cell. Half a pawn's stride, small enough that a path
// reads as a line rather than a blob at the camera distances the solo game uses.
export const TRAIL_CELL_SIZE = 8

// Ticks for wear to halve. One in-game day is 120 ticks (500ms), so this is
// ~4 days: a deer run stays imprinted overnight, a one-off wander fades within
// a week of game time.
export const TRAIL_DECAY_HALF_LIFE = 480

// Worn ground saturates. Without a cap the busiest crossing would be
// infinitely attractive and no new corridor could ever compete with it.
export const TRAIL_MAX_INTENSITY = 48

// Wear added per unit travelled (before an entity's own trail weight).
export const TRAIL_FOOTFALL = 1

// A trail must beat the ground straight ahead by this much before it is worth
// turning for. Stops noise from the walker's own wake from bending its route.
export const TRAIL_FOLLOW_THRESHOLD = 0.5

// Units ahead of the entity where wear is sampled.
export const TRAIL_LOOKAHEAD = 24

// Total sweep (radians) searched either side of the current heading, and how
// many probes into it. ~115 degrees in 8 steps each way.
export const TRAIL_FOLLOW_ARC = Math.PI * 0.64
export const TRAIL_FOLLOW_SAMPLES = 8

// Largest heading change a single step will accept, at affinity 1. Small
// enough that following a trail is a gentle curve, not a snap onto it.
export const TRAIL_MAX_TURN = 0.16

// Below this, a cell is not worth reading.
export const TRAIL_EPSILON = 1 / 1024

/**
 * #94: how much of a leg's cost fully worn ground takes off. A road is not
 * free to walk, it is about a third less tiring than scrub. Any larger and
 * every planner on the map beelines for the single best corridor; the number
 * has to stay small enough that destination choice still depends on distance.
 */
export const TRAIL_COST_DISCOUNT = 0.35

/** Sample spacing for cost estimates, in world units. */
export const TRAIL_COST_SAMPLE = 8

/** Longest leg we will integrate. This ranks destinations; it does not trace them. */
export const TRAIL_COST_MAX_SAMPLES = 64

/**
 * #95: roads. There is no road *object* in this game, on purpose. A road is
 * ground worn enough that the rest of the sim already treats it as built:
 * `trailAwareDirection` steers walkers along it and `pathCost` prices it
 * cheaper. Promotion therefore has to write wear into the field, which is the
 * only channel both of those read - a route table entry would be obeyed by
 * nobody.
 */
export const TRAIL_ROAD_WEAR = 12

/**
 * How much of a line must already be trodden before it can be called a road.
 * Below this the "road" is a straight line through bush that no pawn walks,
 * which is exactly the thing #95 says not to build.
 */
export const TRAIL_ROAD_MIN_COVERAGE = 0.5

/** How far off the straight line a footpath may drift and still be the road. */
export const TRAIL_ROAD_REACH_CELLS = 2

/** Spacing, in world units, between the wear points written along a road. */
export const TRAIL_ROAD_SAMPLE = 4

const LN2 = Math.LN2

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback
}

function shortestAngle(from, to) {
    let d = (to - from) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    return d
}

class TrailField {
    /**
     * @param {{cellSize?: number, halfLife?: number, maxIntensity?: number, tick?: number}} options
     */
    constructor(options = {}) {
        this.cellSize = finite(options.cellSize, TRAIL_CELL_SIZE) || TRAIL_CELL_SIZE
        this.halfLife = finite(options.halfLife, TRAIL_DECAY_HALF_LIFE) || TRAIL_DECAY_HALF_LIFE
        this.maxIntensity = finite(options.maxIntensity, TRAIL_MAX_INTENSITY) || TRAIL_MAX_INTENSITY
        this.tick = Math.floor(finite(options.tick, 0))
        /** @type {Map<string, {x: number, y: number, intensity: number, last: number, born: number, kinds: Object|null}>} */
        this.cells = new Map()
        this.deposits = 0
        this.peak = 0
    }

    /** Cell coordinates for a world position. */
    cellOf(x, y) {
        return {
            cx: Math.floor(finite(x) / this.cellSize),
            cy: Math.floor(finite(y) / this.cellSize)
        }
    }

    keyFor(x, y) {
        const { cx, cy } = this.cellOf(x, y)
        // String key rather than cx * K + cy so negative coordinates and large
        // maps cannot collide.
        return `${cx}:${cy}`
    }

    /** Centre of the cell containing (x, y), in world units. */
    cellCenter(x, y) {
        const { cx, cy } = this.cellOf(x, y)
        return { x: (cx + 0.5) * this.cellSize, y: (cy + 0.5) * this.cellSize }
    }

    /** Exponential decay of `value` over `age` ticks. */
    fade(value, age) {
        if (!(value > 0) || !(age > 0)) return value
        return value * Math.exp(-(age * LN2) / this.halfLife)
    }

    /**
     * Wear at a world position, evaluated at `tick` (default: the field's
     * current tick). Non-destructive — nothing is written on read.
     */
    intensityAt(x, y, tick = this.tick) {
        const cell = this.cells.get(this.keyFor(x, y))
        if (!cell) return 0
        return Math.max(0, this.fade(cell.intensity, Math.floor(tick) - cell.last))
    }

    /**
     * Add footfall. `kind` (an entity subtype such as 'pawn' or 'predator')
     * optionally attributes part of the wear, which is what lets a tracker read
     * *whose* path this is later on.
     * @returns {number} the cell's wear after the deposit
     */
    deposit(x, y, amount = TRAIL_FOOTFALL, tick = this.tick, kind = null) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return 0
        const add = finite(amount)
        if (!(add > 0)) return 0

        const now = Math.floor(finite(tick, this.tick))
        const { cx, cy } = this.cellOf(x, y)
        const key = `${cx}:${cy}`
        let cell = this.cells.get(key)
        if (!cell) {
            cell = { cx, cy, x, y, intensity: 0, last: now, born: now, kinds: null }
            this.cells.set(key, cell)
        } else {
            const age = now - cell.last
            if (age > 0) {
                // Fold the cell forward before writing so every stored value
                // shares one timestamp (cell.last): reads and kind lookups then
                // decay together and stay consistent.
                cell.intensity = this.fade(cell.intensity, age)
                if (cell.kinds) {
                    for (const k of Object.keys(cell.kinds)) cell.kinds[k] = this.fade(cell.kinds[k], age)
                }
                cell.last = now
            }
        }

        cell.intensity = Math.min(this.maxIntensity, cell.intensity + add)
        if (kind) {
            if (!cell.kinds) cell.kinds = {}
            cell.kinds[kind] = Math.min(this.maxIntensity, finite(cell.kinds[kind]) + add)
        }
        if (cell.intensity > this.peak) this.peak = cell.intensity
        this.deposits++
        if (now > this.tick) this.tick = now
        return cell.intensity
    }

    /** Wear attributed to `kind` at a position (0 when untracked/unknown). */
    trackAt(x, y, kind, tick = this.tick) {
        const cell = this.cells.get(this.keyFor(x, y))
        const value = cell?.kinds?.[kind]
        if (!value) return 0
        return Math.max(0, this.fade(value, Math.floor(tick) - cell.last))
    }

    /** Attributed wear at a position, strongest first. */
    tracksAt(x, y, tick = this.tick) {
        const cell = this.cells.get(this.keyFor(x, y))
        if (!cell?.kinds) return []
        const age = Math.floor(tick) - cell.last
        return Object.keys(cell.kinds)
            .map(kind => ({ kind, intensity: Math.max(0, this.fade(cell.kinds[kind], age)) }))
            .filter(entry => entry.intensity > TRAIL_EPSILON)
            .sort((a, b) => b.intensity - a.intensity)
    }

    /** Share of a cell's wear left by one kind, 0..1 — "is this a deer path?" */
    trackShare(x, y, kind, tick = this.tick) {
        const total = this.intensityAt(x, y, tick)
        if (!(total > 0)) return 0
        return Math.min(1, this.trackAt(x, y, kind, tick) / total)
    }

    /**
     * How much of the current heading is explained by worn ground nearby — the
     * "I can see a path here" read used by perception, UI and tests.
     */
    corridorAt(x, y, options = {}) {
        const tick = finite(options.tick, this.tick)
        const lookahead = finite(options.lookahead, TRAIL_LOOKAHEAD)
        let best = this.intensityAt(x, y, tick)
        let along = best
        for (const sign of [-1, 1]) {
            const d = this.intensityAt(x + sign * lookahead, y, tick)
            const e = this.intensityAt(x, y + sign * lookahead, tick)
            best = Math.max(best, d, e)
        }
        along = this.intensityAt(x + (options.dirX || 0) * lookahead, y + (options.dirY || 0) * lookahead, tick)
        return { strength: best, ahead: along, worn: best > (options.threshold ?? TRAIL_FOLLOW_THRESHOLD) }
    }

    /**
     * Nudge a heading toward the most worn ground inside the lookahead arc.
     *
     * Returns the (possibly rotated) unit direction plus how much wear it bought
     * (`gain`) and the turn actually applied. `turn` is capped by TRAIL_MAX_TURN
     * times `affinity`, so an entity that has not learned to read the land is
     * barely pulled, and a turn is never bigger than one gentle step.
     *
     * @param {number} x @param {number} y current position
     * @param {number} dirX @param {number} dirY intended heading (need not be unit)
     * @param {{affinity?: number, tick?: number, lookahead?: number, arc?: number,
     *          samples?: number, threshold?: number, maxTurn?: number}} options
     */
    followBias(x, y, dirX, dirY, options = {}) {
        const rawX = finite(dirX, 0)
        const rawY = finite(dirY, 0)
        const len = Math.hypot(rawX, rawY)
        const ux = len > 0 ? rawX / len : 0
        const uy = len > 0 ? rawY / len : 0
        const straight = { dirX: ux, dirY: uy, turn: 0, gain: 0, intensity: 0 }
        const affinity = finite(options.affinity, 1)
        if (!(affinity > 0) || len === 0) return straight

        const tick = finite(options.tick, this.tick)
        const lookahead = finite(options.lookahead, TRAIL_LOOKAHEAD)
        const arc = finite(options.arc, TRAIL_FOLLOW_ARC)
        const samples = Math.max(1, Math.floor(finite(options.samples, TRAIL_FOLLOW_SAMPLES)))
        const threshold = finite(options.threshold, TRAIL_FOLLOW_THRESHOLD)
        const base = Math.atan2(uy, ux)
        // Two radii: a nearby trail should catch you even when it starts short
        // of the full lookahead, and a far one still wins if it is stronger.
        const radii = [lookahead, lookahead * 0.5]
        const score = angle => {
            const cx = Math.cos(angle)
            const sy = Math.sin(angle)
            let best = 0
            let at = null
            for (const r of radii) {
                const v = this.intensityAt(x + cx * r, y + sy * r, tick)
                if (v > best) {
                    best = v
                    at = { x: x + cx * r, y: y + sy * r }
                }
            }
            return { value: best, at }
        }

        const ahead = score(base)
        let bestAngle = base
        let best = ahead.value
        let bestAt = ahead.at
        for (let i = 1; i <= samples; i++) {
            const off = (i / (samples + 1)) * arc
            for (const sign of [-1, 1]) {
                const angle = base + sign * off
                const probe = score(angle)
                if (probe.value > best) {
                    best = probe.value
                    bestAngle = angle
                    bestAt = probe.at
                }
            }
        }

        const gain = best - ahead.value
        if (!(gain > threshold)) return { ...straight, intensity: best, at: bestAt }

        // Pull harder when the trail is obviously better, so a real footpath
        // captures a walker instead of merely tempting it.
        const pull = Math.min(1, gain / (threshold * 3))
        const cap = finite(options.maxTurn, TRAIL_MAX_TURN) * affinity * (0.4 + 0.6 * pull)
        const turn = Math.max(-cap, Math.min(cap, shortestAngle(base, bestAngle)))
        const angle = base + turn
        return {
            dirX: Math.cos(angle),
            dirY: Math.sin(angle),
            turn,
            gain,
            intensity: best,
            // Where the worn ground actually is, so a reader can identify it.
            at: bestAt
        }
    }

    /** Drop cells that have decayed into nothing. Returns how many went. */
    prune(tick = this.tick, epsilon = TRAIL_EPSILON) {
        let removed = 0
        for (const [key, cell] of this.cells) {
            if (this.fade(cell.intensity, Math.floor(tick) - cell.last) <= epsilon) {
                this.cells.delete(key)
                removed++
            }
        }
        return removed
    }

    /** Cells above a wear level, strongest first — used by rendering and tests. */
    activeCells(threshold = TRAIL_FOLLOW_THRESHOLD, tick = this.tick) {
        const out = []
        for (const cell of this.cells.values()) {
            const intensity = this.fade(cell.intensity, Math.floor(tick) - cell.last)
            if (intensity > threshold) out.push({ cx: cell.cx ?? cell.x, cy: cell.cy ?? cell.y, intensity })
        }
        return out.sort((a, b) => b.intensity - a.intensity)
    }

    /**
     * Worn cells whose centre falls inside a world-space rectangle, strongest
     * first. This is the render feed for #93: a view only ever needs the ground
     * it can see, and a 25000-unit world with a few hundred worn cells should
     * not have to be traversed whole to find them.
     *
     * Cost is proportional to *worn* ground (the cell map is sparse), not to the
     * rect, so a bare world allocates nothing. Callers on a hot path should
     * throttle: `paintSignature` in TrailPaint.js tells you whether anything
     * actually changed since the last read.
     *
     * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
     *   world units; corners may be given in either order
     * @param {{threshold?: number, tick?: number}} options wear floor and the
     *   tick to evaluate decay at
     * @returns {Array<{cx: number, cy: number, x: number, y: number, intensity: number, kind: string|null}>}
     *   `x`/`y` are the cell centre; `kind` is whichever walker's footfall
     *   dominates the cell, or null when the cell is unattributed
     */
    cellsInRect(x0, y0, x1, y1, options = {}) {
        const threshold = finite(options.threshold, TRAIL_EPSILON)
        const tick = Math.floor(finite(options.tick, this.tick))
        const size = this.cellSize

        let left = finite(x0)
        let right = finite(x1, left)
        let top = finite(y0)
        let bottom = finite(y1, top)
        if (right < left) { const swap = left; left = right; right = swap }
        if (bottom < top) { const swap = top; top = bottom; bottom = swap }

        const out = []
        for (const cell of this.cells.values()) {
            const cx = cell.cx ?? Math.floor(finite(cell.x) / size)
            const cy = cell.cy ?? Math.floor(finite(cell.y) / size)
            const x = (cx + 0.5) * size
            const y = (cy + 0.5) * size
            if (x < left || x > right || y < top || y > bottom) continue

            const age = tick - cell.last
            const intensity = this.fade(cell.intensity, age)
            if (!(intensity > threshold)) continue

            // Dominant attribution, decayed by the same age as the cell so the
            // colour and the wear cannot disagree.
            let kind = null
            if (cell.kinds) {
                let best = 0
                for (const k of Object.keys(cell.kinds)) {
                    const value = this.fade(finite(cell.kinds[k]), age)
                    if (value > best) { best = value; kind = k }
                }
            }
            out.push({ cx, cy, x, y, intensity, kind })
        }
        return out.sort((a, b) => b.intensity - a.intensity)
    }

    /**
     * Travel cost of a straight leg given the ground under it (#94). This is
     * the planner's question - "which destination is cheaper?" - as opposed to
     * followBias()'s reflex, "which way should this step turn?".
     *
     * Returns plain Euclidean distance whenever nothing worn lies along the
     * leg, so an untouched world costs exactly what it cost before this
     * existed and every existing distance comparison keeps its ordering.
     *
     * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
     * @param {{tick?: number, discount?: number, threshold?: number}} options
     *   `discount` is the fraction of the leg the walker is willing to save at
     *   full saturation (0 disables the estimate entirely); `threshold` is the
     *   wear floor below which ground is scrub, not path.
     * @returns {number} cost in units of walking, never greater than the distance
     */
    pathCost(x0, y0, x1, y1, options = {}) {
        const ax = finite(x0), ay = finite(y0)
        const bx = finite(x1), by = finite(y1)
        const distance = Math.hypot(bx - ax, by - ay)
        if (!(distance > 0)) return 0

        const discount = Math.min(0.9, Math.max(0, finite(options.discount, TRAIL_COST_DISCOUNT)))
        if (discount <= 0 || this.cells.size === 0) return distance

        const threshold = finite(options.threshold, TRAIL_FOLLOW_THRESHOLD)
        const tick = Math.floor(finite(options.tick, this.tick))
        const cap = this.maxIntensity > 0 ? this.maxIntensity : TRAIL_MAX_INTENSITY
        const samples = Math.min(
            TRAIL_COST_MAX_SAMPLES,
            Math.max(2, Math.round(distance / TRAIL_COST_SAMPLE))
        )

        let worn = 0
        for (let i = 0; i < samples; i++) {
            const t = (i + 0.5) / samples
            const intensity = this.intensityAt(ax + (bx - ax) * t, ay + (by - ay) * t, tick)
            if (intensity > threshold) worn += Math.min(1, intensity / cap)
        }
        return distance * (1 - discount * (worn / samples))
    }

    /**
     * What the ground under one foot costs (#98), as a multiplier on the step.
     * `pathCost` answers the planner's question - "how expensive is this leg" -
     * by resampling the whole line, which is far too much work to ask of every
     * step of every walker. This answers the walker's question, which is only
     * ever about the cell it is standing on, in a single lookup.
     *
     * Deliberately the same rule as `pathCost` (`1 - discount * wear/cap`, with
     * the same threshold floor) so the body cannot disagree with the plan about
     * what a road is worth.
     *
     * @param {number} x @param {number} y
     * @param {{tick?: number, discount?: number, threshold?: number}} options
     *   same meaning as in `pathCost`; `discount` 0 disables the relief.
     * @returns {number} multiplier in (0, 1]. 1 means "this is just ground".
     */
    stepCost(x, y, options = {}) {
        const discount = Math.min(0.9, Math.max(0, finite(options.discount, TRAIL_COST_DISCOUNT)))
        if (discount <= 0 || this.cells.size === 0) return 1

        const threshold = finite(options.threshold, TRAIL_FOLLOW_THRESHOLD)
        const tick = Math.floor(finite(options.tick, this.tick))
        const intensity = this.intensityAt(x, y, tick)
        if (!(intensity > threshold)) return 1

        const cap = this.maxIntensity > 0 ? this.maxIntensity : TRAIL_MAX_INTENSITY
        return 1 - discount * Math.min(1, intensity / cap)
    }

    /**
     * Cost of a whole polyline route (#94), leg by leg, plus the distance and
     * the units of walking the worn ground saved. `points` is the traveller's
     * position followed by its waypoints and destination; anything unparseable
     * is dropped rather than thrown, because this is called during planning.
     *
     * @param {Array<{x: number, y: number}>} points
     * @param {{tick?: number, discount?: number, threshold?: number}} options
     * @returns {{cost: number, distance: number, savings: number}}
     */
    routeCost(points, options = {}) {
        const list = Array.isArray(points)
            ? points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))
            : []
        let cost = 0
        let distance = 0
        for (let i = 1; i < list.length; i++) {
            const prev = list[i - 1]
            const next = list[i]
            distance += Math.hypot(next.x - prev.x, next.y - prev.y)
            cost += this.pathCost(prev.x, prev.y, next.x, next.y, options)
        }
        return { cost, distance, savings: Math.max(0, distance - cost) }
    }

    /**
     * The strongest worn ground within `radius` of a spot (#94). Answers with
     * the cell itself - its recorded position, which `cellCenter` can square up
     * to the grid - so a planner steers toward ground that actually exists
     * instead of a coordinate between cells. Null when the neighbourhood is
     * unworn, which is the common case and must stay cheap.
     */
    wearNear(x, y, options = {}) {
        const px = finite(x), py = finite(y)
        const radius = finite(options.radius, this.cellSize * 3)
        if (!(radius > 0)) return null
        const cells = this.cellsInRect(px - radius, py - radius, px + radius, py + radius, {
            threshold: finite(options.threshold, TRAIL_FOLLOW_THRESHOLD),
            tick: options.tick
        })
        // cellsInRect is strongest-first, so the first hit is the best hit.
        for (const cell of cells) {
            if (Math.hypot(cell.x - px, cell.y - py) <= radius) return cell
        }
        return null
    }

    /**
     * The corridor of worn ground between two points (#95). Walks the straight
     * line from A to B and, wherever a footpath is within reach, bends onto it.
     * `points` are the worn cells found - cell centres, so they are ground that
     * exists rather than a coordinate between cells - and `path` is the line a
     * walker would actually take, worn where it could be found and straight
     * across the gaps between. `coverage` is the share of the line already
     * trodden, which is what decides whether a road can be formalised here.
     * @returns {{points: Array, path: Array, length: number, coverage: number, gaps: number}}
     */
    corridorBetween(fromX, fromY, toX, toY, options = {}) {
        const px = finite(fromX), py = finite(fromY)
        const qx = finite(toX), qy = finite(toY)
        const length = Math.hypot(qx - px, qy - py)
        if (!(length > 0)) return { points: [], path: [], length: 0, coverage: 0, gaps: 0 }

        const reach = finite(options.reach, this.cellSize * TRAIL_ROAD_REACH_CELLS)
        const threshold = finite(options.threshold, TRAIL_FOLLOW_THRESHOLD)
        const sample = Math.max(1, finite(options.sample, TRAIL_ROAD_SAMPLE))
        // Same integration cap as cost estimation: this measures a corridor, it
        // does not trace a contour map.
        const steps = Math.min(Math.max(2, Math.ceil(length / sample)), TRAIL_COST_MAX_SAMPLES)
        const stride = length / steps

        const points = []
        const path = []
        let hits = 0
        let gaps = 0
        for (let i = 0; i <= steps; i++) {
            const t = (i * stride) / length
            const x = px + (qx - px) * t
            const y = py + (qy - py) * t
            const cell = reach > 0
                ? this.wearNear(x, y, { radius: reach, threshold, tick: options.tick })
                : null
            if (!cell) {
                gaps++
                path.push({ x, y })
                continue
            }
            hits++
            // Snap onto the cell centre rather than wherever the first walker
            // happened to put a foot down: a road is a line of ground, and the
            // grid is how the field remembers it.
            const centre = this.cellCenter(cell.x, cell.y)
            path.push(centre)
            const last = points[points.length - 1]
            if (!last || Math.hypot(last.x - centre.x, last.y - centre.y) >= this.cellSize * 0.5) {
                points.push(centre)
            }
        }

        return {
            points,
            path,
            length,
            coverage: hits / (steps + 1),
            gaps
        }
    }

    /**
     * Formalise the worn ground between two points as a road (#95). Traffic has
     * to have gone here already - coverage must clear `minCoverage` - unless the
     * caller is surveying, which is the cartography bypass the issue asks for:
     * a good enough surveyor lays the straight line that is best forever
     * instead of the bent one that is cheapest now.
     *
     * The only side effect is wear. That is what makes the road real: steering
     * and route cost both obey it from the next read onwards, and
     * TRAIL_DECAY_HALF_LIFE means an abandoned road fades unless someone keeps
     * walking it.
     * @returns {{ok: boolean, reason: string, points: Array, length: number, coverage: number}}
     */
    promoteCorridor(fromX, fromY, toX, toY, options = {}) {
        const corridor = this.corridorBetween(fromX, fromY, toX, toY, options)
        const surveyed = options.surveyed === true
        const minCoverage = finite(options.minCoverage, TRAIL_ROAD_MIN_COVERAGE)

        // A road has to go somewhere. Without this the surveyed bypass would
        // "pave" a dot under the feet of anyone asking, which the civic road
        // opening does for whoever is standing on the settlement already.
        if (!(corridor.length > 0)) {
            return { ok: false, reason: 'nowhere', ...corridor }
        }
        if (!surveyed && corridor.coverage < minCoverage) {
            return { ok: false, reason: 'unworn', ...corridor }
        }
        if (!corridor.points.length && !surveyed) {
            return { ok: false, reason: 'unworn', ...corridor }
        }

        const wear = finite(options.wear, TRAIL_ROAD_WEAR)
        const kind = options.kind ?? 'road'
        // A surveyed road is laid on the straight line. Everyone else paves
        // the corridor traffic actually wore - gaps and all, which is the whole
        // point of building it.
        const line = surveyed
            ? this.corridorBetween(fromX, fromY, toX, toY, { ...options, reach: 0 }).path
            : corridor.path

        if (!line.length) {
            return { ok: false, reason: 'nowhere', ...corridor }
        }

        for (const p of line) {
            this.deposit(p.x, p.y, wear, options.tick, kind)
        }

        return {
            ok: true,
            reason: surveyed ? 'surveyed' : 'worn',
            points: line,
            length: corridor.length,
            coverage: corridor.coverage
        }
    }

    stats(tick = this.tick) {
        let sum = 0
        let worn = 0
        let peak = 0
        for (const cell of this.cells.values()) {
            const intensity = this.fade(cell.intensity, Math.floor(tick) - cell.last)
            if (intensity <= TRAIL_EPSILON) continue
            sum += intensity
            if (intensity > TRAIL_FOLLOW_THRESHOLD) worn++
            if (intensity > peak) peak = intensity
        }
        return {
            cells: this.cells.size,
            wornCells: worn,
            totalWear: sum,
            meanWear: worn ? sum / Math.max(1, this.cells.size) : 0,
            peak,
            deposits: this.deposits
        }
    }

    /**
     * Total remaining wear attributed to each walker, strongest first. This is
     * what a tracking UI reads ("these paths are mostly deer"), and what
     * TrailPaint's readout shows.
     * @returns {Array<{kind: string, intensity: number, cells: number}>}
     */
    kindsInUse(tick = this.tick) {
        const now = Math.floor(finite(tick, this.tick))
        const totals = new Map()
        for (const cell of this.cells.values()) {
            if (!cell.kinds) continue
            const age = now - cell.last
            for (const k of Object.keys(cell.kinds)) {
                const value = this.fade(finite(cell.kinds[k]), age)
                if (!(value > TRAIL_EPSILON)) continue
                const entry = totals.get(k) || { kind: k, intensity: 0, cells: 0 }
                entry.intensity += value
                entry.cells++
                totals.set(k, entry)
            }
        }
        return [...totals.values()].sort((a, b) => b.intensity - a.intensity)
    }

    /** Plain-object snapshot; the shape is stable for save/load and debugging. */
    toJSON(tick = this.tick) {
        return {
            cellSize: this.cellSize,
            halfLife: this.halfLife,
            tick,
            stats: this.stats(tick),
            cells: [...this.cells.values()].map(cell => ({
                key: this.keyFor(cell.x, cell.y),
                intensity: this.fade(cell.intensity, Math.floor(tick) - cell.last),
                born: cell.born,
                kinds: cell.kinds ? { ...cell.kinds } : null
            }))
        }
    }
}

/**
 * The world's trail field, created on first use and attached to the world so
 * every walker shares one ground. Pass `create: false` to read without
 * allocating (perception, rendering, tests).
 */
export function trailFieldFor(world, options = {}) {
    if (!world || typeof world !== 'object') return null
    if (!world.trailField) {
        if (options.create === false) return null
        world.trailField = new TrailField({
            ...options,
            tick: world.tick ?? world.clock?.currentTick ?? 0
        })
    }
    return world.trailField
}

/** Replace a world's trail field (long sessions, tests, new maps). */
export function resetTrailField(world, options = {}) {
    if (!world || typeof world !== 'object') return null
    world.trailField = new TrailField(options)
    return world.trailField
}

export { TrailField }
export default TrailField
