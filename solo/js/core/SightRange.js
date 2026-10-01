/**
 * SightRange (#90).
 *
 * One answer to two questions the UI kept inventing its own versions of:
 * "how far can this entity actually see?" and "what is it not seeing?".
 *
 * #80 gave the simulation terrain-aware line of sight and published the result
 * on `pawn.vision`; the renderers still had their own radius (`traits.detection
 * || 100`) and no notion of hidden-vs-absent at all, so a player looking at a
 * map of every resource could not tell why a pawn walked past a rock it should
 * have spotted. Everything here reads the verdict the pawn already recorded
 * instead of re-marching rays per frame - call `Pawn.canSee()` on a click, never
 * in a draw loop.
 *
 * Imports only LineOfSight.js (itself import-free), so this runs under
 * `node --test`, in the browser, and headless like the rest of core/.
 */

import { BLOCKERS } from './LineOfSight.js'

/** Legacy perception radius used before an entity has run an observation pass. */
export const DEFAULT_SIGHT_RANGE = 100
/** Hidden pins kept per pass; a pawn behind a ridge can hide dozens of twigs. */
export const VISION_HIDDEN_CAP = 24
/** A remembered location counts as covering an entity this close to it. */
export const REMEMBER_RADIUS = 12
/** Segments used to approximate the sight ring. */
export const RING_SEGMENTS = 32
/** A vision report older than this many ticks is treated as no report. */
export const VISION_STALE_TICKS = 120

function finite(value, fallback = 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

/**
 * The radius this entity's sight actually reached on its last pass, falling
 * back to its nominal detection trait and then to the world default. Reads
 * `vision.rangeUsed` (which #80 already shrank for forest and ridges) so the
 * wedge on screen is the range the pawn really has, not a constant.
 */
export function sightRangeFor(entity, fallback = DEFAULT_SIGHT_RANGE) {
    const used = finite(entity?.vision?.rangeUsed, 0)
    if (used > 0) return used
    const detection = finite(entity?.traits?.detection, 0)
    if (detection > 0) return detection
    return finite(fallback, DEFAULT_SIGHT_RANGE)
}

/**
 * `{ range, nominal, dimmed, observed, blocked, fresh }` - what the pawn can see
 * right now, what it could see in the open, and whether the report is current.
 */
export function sightSummary(entity, options = {}) {
    const range = sightRangeFor(entity)
    const nominal = finite(entity?.vision?.baseRange, range)
    const tick = finite(options.tick, NaN)
    const reportedAt = finite(entity?.vision?.tick, NaN)
    const fresh = Number.isFinite(tick) && Number.isFinite(reportedAt)
        ? tick - reportedAt <= finite(options.maxAge, VISION_STALE_TICKS)
        : true
    return {
        range,
        nominal: nominal > 0 ? nominal : range,
        dimmed: range < (nominal > 0 ? nominal : range) - 0.5,
        observed: finite(entity?.vision?.observed, 0),
        blocked: finite(entity?.vision?.blocked, 0),
        hidden: fresh ? (Array.isArray(entity?.vision?.hidden) ? entity.vision.hidden : []) : [],
        fresh
    }
}

/** Hidden entries recorded for a specific spot, if the pawn logged one there. */
export function hiddenAt(pawn, x, y, radius = 4) {
    const hidden = pawn?.vision?.hidden
    if (!Array.isArray(hidden)) return null
    const r2 = radius * radius
    let best = null
    let bestDist = Infinity
    for (const entry of hidden) {
        const d = (entry.x - x) ** 2 + (entry.y - y) ** 2
        if (d <= r2 && d < bestDist) {
            best = entry
            bestDist = d
        }
    }
    return best
}

/**
 * The kind a memory is filed under - resources are `immobile` entities whose
 * useful type is their subtype, which is how `Pawn.rememberResource` files them.
 */
export function resourceKindOf(entity) {
    return entity?.subtype || entity?.type || null
}

/** True when the pawn has this kind of resource memorised near a spot. */
export function isRememberedNear(pawn, x, y, type, radius = REMEMBER_RADIUS) {
    const memory = pawn?.resourceMemory
    if (!Array.isArray(memory)) return false
    const r2 = radius * radius
    return memory.some(entry => {
        if (type && entry.type && entry.type !== type) return false
        return (finite(entry.x, x) - x) ** 2 + (finite(entry.y, y) - y) ** 2 <= r2
    })
}

/**
 * Which of the four things a map pin can mean, for one entity, according to the
 * pawn's last pass: seen now, remembered from before, hidden by something the
 * pawn ran into, or simply not known.
 */
export function classifyPin(pawn, entity, options = {}) {
    if (!pawn || !entity) return 'unknown'
    if (entity === pawn) return 'seen'
    const summary = sightSummary(pawn, options)
    const hidden = hiddenAt(pawn, entity.x, entity.y, options.radius ?? 4)
    if (hidden) return 'hidden'
    const distance = Math.hypot(finite(entity.x, 0) - finite(pawn.x, 0), finite(entity.y, 0) - finite(pawn.y, 0))
    if (Number.isFinite(distance) && distance <= summary.range) return 'seen'
    if (isRememberedNear(pawn, entity.x, entity.y, resourceKindOf(entity))) return 'remembered'
    return 'unknown'
}

/**
 * Points approximating a circle of sight, world -> screen space order left to
 * the caller. Always returns a closed loop (first point repeated) so a caller
 * can stroke or fill it without an extra move, and an empty array for a
 * non-finite centre or a radius that cannot be drawn.
 */
export function ringPoints(cx, cy, radius, segments = RING_SEGMENTS) {
    const x = finite(cx, NaN)
    const y = finite(cy, NaN)
    const r = finite(radius, 0)
    if (!Number.isFinite(x) || !Number.isFinite(y) || r <= 0) return []
    const count = Math.max(3, Math.floor(finite(segments, RING_SEGMENTS)))
    const points = []
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2
        points.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r })
    }
    // cos/sin of a full turn are not exactly 1/0, so close the loop by hand -
    // callers stroke it and must not get a sliver of floating-point seam.
    points.push({ ...points[0] })
    return points
}

/** Reason text for a hidden entry, phrased exactly as the pawn thinks it. */
export function describeHiddenEntry(entry) {
    if (!entry) return ''
    if (entry.why) return entry.why
    const text = BLOCKERS[entry.reason] ?? 'something is in the way'
    const at = Number.isFinite(entry.blockedAt) ? ` about ${Math.round(entry.blockedAt)}m out` : ''
    return `${text}${at}`
}

/**
 * One-line readout for the HUD: what the pawn's sight reaches today and how
 * much of the neighbourhood that leaves hidden. Empty string when there is no
 * observation to report so callers can skip the row entirely.
 */
export function describeSight(entity, options = {}) {
    if (!entity?.vision) return ''
    const summary = sightSummary(entity, options)
    const seen = Math.round(summary.range)
    const nominal = Math.round(summary.nominal)
    const range = summary.dimmed ? `${seen}/${nominal}` : `${seen}`
    const parts = [`sight ${range}m`]
    if (summary.blocked > 0) {
        const first = summary.hidden[0]
        const why = describeHiddenEntry(first)
        parts.push(`${summary.blocked} hidden${why ? ` (${why})` : ''}`)
    }
    if (summary.observed > 0) parts.push(`${summary.observed} in view`)
    return parts.join(' · ')
}

/** Pin colours keyed by classifyPin state; the UI must not invent others. */
export const PIN_STYLES = {
    seen: 'rgba(251, 191, 36, 0.95)',
    remembered: 'rgba(251, 191, 36, 0.3)',
    hidden: 'rgba(148, 163, 184, 0.9)',
    unknown: 'rgba(148, 163, 184, 0.18)'
}

export default {
    DEFAULT_SIGHT_RANGE,
    VISION_HIDDEN_CAP,
    REMEMBER_RADIUS,
    RING_SEGMENTS,
    VISION_STALE_TICKS,
    PIN_STYLES,
    sightRangeFor,
    sightSummary,
    hiddenAt,
    resourceKindOf,
    isRememberedNear,
    classifyPin,
    ringPoints,
    describeHiddenEntry,
    describeSight
}
