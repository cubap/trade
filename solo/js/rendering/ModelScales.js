/**
 * Canonical model scale reference (issue #76).
 *
 * Convention:
 *   - 1 world unit ~= 0.24 meters.
 *   - The pawn is the reference figure: 7.5 units tall (~1.8 m).
 *   - Every 3D model (loaded asset or procedural fallback) is normalized to
 *     the target height for its category, so proportions stay consistent
 *     regardless of the source file's units or future asset swaps.
 *
 * Source asset heights (measured from the OBJ/GLB bounding boxes):
 *   - tree_obj.obj:        ~16.7 units
 *   - pawn.glb:            ~1.74 units (exported in meters)
 *   - AssortedRocks.obj:   ~9 units tall (merged field, ~171 wide)
 *   - animal pack obj:     0.4-7.3 units per variant (median ~1.6)
 *   - PartsForSale.obj:    10-196 units per object (bushes small, trees tall)
 *   - grassDarkGreen.fbx:  measured at load time (_grassModelMeta)
 */

export const UNIT_METERS = 0.24
export const PAWN_HEIGHT_UNITS = 7.5

/**
 * targetHeight: final rendered height in world units before per-entity jitter.
 * jitter:       +/- fraction applied per entity (0.04 = 4%).
 * stages:       optional growth-stage multipliers applied to targetHeight.
 * referenceSize: size value at which a variable-size category hits targetHeight.
 */
export const MODEL_SCALES = {
    pawn: {
        targetHeight: PAWN_HEIGHT_UNITS,
        jitter: 0.04
    },
    animal: {
        // Deer were already tuned to 6.8; apply the same canonical height to
        // every animal so variants stop rendering at wildly different sizes.
        targetHeight: 6.8,
        jitter: 0.1
    },
    tree: {
        // Adult tree ~8.6 m tall; growth stages scale the target so saplings
        // and sprouts actually render smaller (previously ignored by models).
        targetHeight: 36,
        jitter: 0.14,
        stages: { sprout: 0.05, sapling: 0.25, adult: 1 }
    },
    smallTree: {
        targetHeight: 18,
        jitter: 0.14
    },
    bush: {
        targetHeight: 4,
        jitter: 0.25
    },
    rock: {
        // Rocks scale with entity.size; referenceSize maps size -> height.
        targetHeight: 3.6,
        referenceSize: 3,
        jitter: 0.3
    },
    grass: {
        targetHeight: 1.6,
        jitter: 0.5
    }
}

/**
 * Growth-stage multiplier for a category ('adult' when unknown).
 */
export function stageScale(category, stage) {
    const entry = MODEL_SCALES[category]
    if (!entry || !entry.stages) return 1
    return entry.stages[stage] ?? entry.stages.adult ?? 1
}

/**
 * Canonical target height (world units) for a category.
 *   jitterUnit: per-entity hash in [0,1) producing +/- jitter (0.5 = no jitter).
 *   stage:      optional growth stage.
 *   size:       optional entity size (rocks scale relative to referenceSize).
 */
export function targetHeightFor(category, jitterUnit = 0.5, stage = null, size = null) {
    const entry = MODEL_SCALES[category]
    if (!entry) return null
    let height = entry.targetHeight
    if (entry.referenceSize && Number.isFinite(size) && size > 0) {
        height *= size / entry.referenceSize
    }
    height *= stageScale(category, stage)
    const jitter = entry.jitter ?? 0
    const factor = 1 + ((jitterUnit - 0.5) * 2) * jitter
    return Math.max(0.1, height * factor)
}

export default MODEL_SCALES
