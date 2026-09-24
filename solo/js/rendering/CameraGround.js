/**
 * Camera ground-clearance helpers (#79).
 *
 * Kept free of THREE imports so the math is unit-testable in Node
 * (CameraController3D.js itself imports from an absolute browser path).
 */

export const CAMERA_GROUND_CLEARANCE = 1.2
export const CAMERA_FLOOR_SAMPLES = 3
export const CAMERA_LOOK_Y_SMOOTHING = 0.05

/**
 * Highest ground along the segment from camera to pawn, plus clearance.
 * Returns the minimum safe camera Y, or null when no sample is finite.
 */
export function cameraFloorY(sampleHeight, camX, camZ, pawnX, pawnZ, steps = CAMERA_FLOOR_SAMPLES) {
    let floor = -Infinity
    const n = Math.max(1, steps | 0)
    for (let s = 0; s <= n; s++) {
        const t = s / n
        const h = sampleHeight(camX + (pawnX - camX) * t, camZ + (pawnZ - camZ) * t)
        if (Number.isFinite(h) && h > floor) floor = h
    }
    return Number.isFinite(floor) ? floor + CAMERA_GROUND_CLEARANCE : null
}

/**
 * Exponential smoothing for the look-target height so the horizon stays
 * stable while the camera position still tracks elevation.
 */
export function smoothLookY(prev, target, factor = CAMERA_LOOK_Y_SMOOTHING) {
    if (!Number.isFinite(prev)) return target
    if (!Number.isFinite(target)) return prev
    return prev + (target - prev) * factor
}
