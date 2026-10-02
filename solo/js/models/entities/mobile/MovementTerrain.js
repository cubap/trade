/**
 * Terrain-aware movement (#84).
 *
 * Pure helpers that translate chunk data (water depth, slope, biome) into a
 * speed factor + reason, and clamp move targets out of impassable terrain.
 * Deliberately import-free so simulation and tests share the same code path.
 */

export const DEEP_WATER_DEPTH = 0.4        // matches ChunkManager.isPassable
export const SHALLOW_WATER_FACTOR = 0.6
export const DENSE_FOREST_FACTOR = 0.7
export const STEEP_SLOPE_FACTOR = 0.45
export const MODERATE_SLOPE_FACTOR = 0.8
// Elevation delta per horizontal unit. Measured on generated terrain the
// median is ~0.45 and p90 ~0.97, so thresholds sit in the upper tail:
// only genuinely rough ground (top ~25%) slows anything down.
export const STEEP_SLOPE = 1.1
export const MODERATE_SLOPE = 0.75
export const SLOPE_SAMPLE_OFFSET = 4
export const IMPASSABLE_FACTOR = 0

const IMPEDIMENT_TEXTS = {
    deep_water: 'Deep water blocks my way.',
    steep_slope: 'This slope is brutal — I need to pick a careful line.',
    shallow_water: 'Wading through shallow water slows me down.',
    dense_forest: 'The forest is thick here; moving is hard work.',
    blocked_path: 'I can\'t get through there — I\'ll stop at the edge.'
}

/**
 * Sample the terrain features that affect movement at a world position.
 * Returns null when the world has no chunk manager (e.g. early boot/tests).
 */
export function getTerrainMoveContext(world, x, y) {
    const cm = world?.chunkManager
    if (!cm?.getElevationAt || !cm?.getWaterDepthAt) return null

    const waterDepth = cm.getWaterDepthAt(x, y) ?? 0
    const elev = cm.getElevationAt(x, y) ?? 0
    const off = SLOPE_SAMPLE_OFFSET
    const gx = Math.abs(cm.getElevationAt(x + off, y) - elev) / off
    const gy = Math.abs(cm.getElevationAt(x, y + off) - elev) / off
    const slope = Math.max(gx, gy)

    const biome = cm.getChunkAtPosition?.(x, y)?.biome ?? null

    return { waterDepth, slope, biome }
}

/**
 * Speed multiplier for a movement context.
 * Returns { factor, reason } — factor 0 means impassable.
 */
export function terrainSpeedFactor(ctx) {
    if (!ctx) return { factor: 1, reason: null }

    if (ctx.waterDepth > DEEP_WATER_DEPTH) {
        return { factor: IMPASSABLE_FACTOR, reason: 'deep_water' }
    }
    if (ctx.slope >= STEEP_SLOPE) {
        return { factor: STEEP_SLOPE_FACTOR, reason: 'steep_slope' }
    }
    if (ctx.waterDepth > 0) {
        return { factor: SHALLOW_WATER_FACTOR, reason: 'shallow_water' }
    }
    if (ctx.slope >= MODERATE_SLOPE) {
        return { factor: MODERATE_SLOPE_FACTOR, reason: 'moderate_slope' }
    }
    if (ctx.biome === 'forest') {
        return { factor: DENSE_FOREST_FACTOR, reason: 'dense_forest' }
    }
    return { factor: 1, reason: null }
}

export function impedimentText(reason) {
    return IMPEDIMENT_TEXTS[reason] ?? null
}

/**
 * Walk from (fromX, fromY) toward (toX, toY) and stop at the last passable
 * point, so a straight-line move never ends (or starts) in deep water.
 * Returns { x, y, clamped }.
 */
export function clampTargetToPassable(world, fromX, fromY, toX, toY, stepSize = 2) {
    const cm = world?.chunkManager
    if (!cm?.isPassable) return { x: toX, y: toY, clamped: false }

    const dist = Math.hypot(toX - fromX, toY - fromY)
    if (dist <= stepSize) {
        return cm.isPassable(toX, toY)
            ? { x: toX, y: toY, clamped: false }
            : { x: fromX, y: fromY, clamped: true }
    }

    const steps = Math.floor(dist / stepSize)
    let lastX = fromX
    let lastY = fromY
    for (let s = 1; s <= steps; s++) {
        const t = (s * stepSize) / dist
        const px = fromX + (toX - fromX) * t
        const py = fromY + (toY - fromY) * t
        if (!cm.isPassable(px, py)) {
            return { x: lastX, y: lastY, clamped: true }
        }
        lastX = px
        lastY = py
    }
    // Whole segment passable (final partial step included)
    return { x: toX, y: toY, clamped: false }
}
