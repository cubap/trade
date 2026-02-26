/**
 * PlayerMode — manages the player's current perspective and controls what they can see/do.
 *
 * Three progressive modes unlock as the tracked pawn develops skills and social standing:
 *
 *  pawn      — first-person follow: camera locks to the pawn, HUD shows personal stats only.
 *  overseer  — unlocks at OVERSEER_SKILL_THRESHOLD total skill: wider view, map waypoints,
 *               can pan away from pawn and return.
 *  god       — unlocks at GOD_SKILL_THRESHOLD total skill + group membership: full world view,
 *               trade-network overlay, policy controls.
 */

export const MODES = {
    PAWN: 'pawn',
    OVERSEER: 'overseer',
    GOD: 'god'
}

// Minimum summed skill value required to unlock each elevated mode
export const OVERSEER_SKILL_THRESHOLD = 15
export const GOD_SKILL_THRESHOLD = 50

class PlayerMode {
    constructor(world, renderer) {
        this.world = world
        this.renderer = renderer
        this.currentMode = MODES.PAWN
        this.trackedPawn = null
        this.mapWaypoints = []          // { id, x, y, label } — overseer mode map pins
        this._listeners = []            // mode-change callbacks
    }

    // ── Pawn tracking ──────────────────────────────────────────────────────────

    setTrackedPawn(pawn) {
        this.trackedPawn = pawn
        // In pawn or overseer mode always keep camera on the pawn
        if (this.currentMode === MODES.PAWN || this.currentMode === MODES.OVERSEER) {
            this.renderer.setFollowEntity(pawn)
        }
    }

    // ── Mode queries ───────────────────────────────────────────────────────────

    /** Returns the Set of mode keys the player currently has access to. */
    getUnlockedModes() {
        const unlocked = new Set([MODES.PAWN])
        if (!this.trackedPawn) return unlocked

        const total = this._totalSkill()

        if (total >= OVERSEER_SKILL_THRESHOLD) {
            unlocked.add(MODES.OVERSEER)
        }

        const hasMembership = this._hasMembership()
        if (total >= GOD_SKILL_THRESHOLD && hasMembership) {
            unlocked.add(MODES.GOD)
        }

        return unlocked
    }

    canSwitchTo(mode) {
        return this.getUnlockedModes().has(mode)
    }

    // ── Mode switching ─────────────────────────────────────────────────────────

    /**
     * Attempt to switch to the given mode.
     * Returns true on success, false if mode is not yet unlocked.
     */
    switchMode(mode) {
        if (!this.canSwitchTo(mode)) return false
        const prev = this.currentMode
        this.currentMode = mode
        this._applyModeToCamera(mode)
        this._listeners.forEach(fn => fn(mode, prev))
        return true
    }

    /** Register a callback fired whenever the mode changes: fn(newMode, prevMode) */
    onModeChange(fn) {
        this._listeners.push(fn)
    }

    // ── Waypoints (Overseer mode) ──────────────────────────────────────────────

    /** Add a world-space waypoint.  Only works in overseer mode. */
    addWaypoint(x, y, label = '') {
        if (this.currentMode !== MODES.OVERSEER) return null
        const waypoint = { id: Date.now(), x, y, label }
        this.mapWaypoints.push(waypoint)
        return waypoint
    }

    removeWaypoint(id) {
        this.mapWaypoints = this.mapWaypoints.filter(w => w.id !== id)
    }

    // ── Internals ──────────────────────────────────────────────────────────────

    _applyModeToCamera(mode) {
        const cam = this.renderer.camera
        switch (mode) {
            case MODES.PAWN:
                if (this.trackedPawn) {
                    this.renderer.setFollowEntity(this.trackedPawn)
                    cam.setZoomToShowRadius?.(this.trackedPawn.traits?.detection ?? 100, 0.85)
                }
                break

            case MODES.OVERSEER:
                if (this.trackedPawn) {
                    this.renderer.setFollowEntity(this.trackedPawn)
                }
                // Pull back to show a larger area (~3× the pawn's perception radius)
                cam.setZoomToShowRadius?.(
                    (this.trackedPawn?.traits?.detection ?? 100) * 3,
                    0.85
                )
                break

            case MODES.GOD:
                // Detach camera and fit the entire world
                this.renderer.setFollowEntity(null)
                cam.setZoomToShowRadius?.(
                    Math.max(this.world.width, this.world.height) / 2,
                    0.9
                )
                cam.viewX = this.world.width / 2
                cam.viewY = this.world.height / 2
                break
        }
    }

    _totalSkill() {
        if (!this.trackedPawn?.skills) return 0
        return Object.values(this.trackedPawn.skills).reduce((sum, v) => sum + (v || 0), 0)
    }

    _hasMembership() {
        const membership = this.trackedPawn?.reputation?.membership
        return !!membership && Object.keys(membership).length > 0
    }
}

export default PlayerMode
