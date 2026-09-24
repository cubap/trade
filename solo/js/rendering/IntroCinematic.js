/**
 * Cinematic game-start sequence (#74).
 *
 * On a new game the camera opens high above the spawn, orbits 360 degrees
 * while dropping toward the landscape, ends pointing straight down at the
 * pawn, then snaps into first-person. A black overlay fades in once the
 * terrain around the pawn has been built, and any input skips the sequence.
 *
 * Mixed into ThreeRenderer via Object.assign, mirroring the other
 * create*Module(renderer) factories.
 */

export const INTRO_ORBIT_MS = 7000
export const INTRO_HOLD_MS = 1300
export const INTRO_SNAP_MS = 700
export const INTRO_FADE_IN_MS = 1200
export const INTRO_TOTAL_MS = INTRO_ORBIT_MS + INTRO_HOLD_MS + INTRO_SNAP_MS

export const INTRO_START_HEIGHT = 240
export const INTRO_END_HEIGHT = 26
export const INTRO_START_RADIUS = 150

function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2
}

/**
 * Pure camera-path math for the intro orbit.
 * t is normalized 0..1 across the orbit phase. World (x, y) maps to the
 * three.js (x, z) plane; y is up. Returns the eye position and look target.
 */
export function introCameraPose(t, pawnX, pawnY, headY) {
    const e = easeInOutSine(Math.min(1, Math.max(0, t)))
    const azimuth = Math.PI * 2 * e
    const height = INTRO_START_HEIGHT + (INTRO_END_HEIGHT - INTRO_START_HEIGHT) * e
    const radius = INTRO_START_RADIUS * (1 - e)
    return {
        x: pawnX + Math.cos(azimuth) * radius,
        y: headY + height,
        z: pawnY + Math.sin(azimuth) * radius,
        lookX: pawnX,
        lookY: headY,
        lookZ: pawnY,
        azimuth
    }
}

export function createIntroCinematic() {
    return {
        /**
         * Begin the opening sequence. Safe to call before the first render;
         * the clock starts once the terrain mesh exists.
         */
        startIntroCinematic(pawn) {
            if (!pawn || this._intro?.active) return
            this._intro = {
                active: true,
                pawn,
                t0: null,
                overlay: this._createIntroOverlay(),
                onInput: () => this.skipIntroCinematic()
            }
            window.addEventListener('keydown', this._intro.onInput)
            window.addEventListener('pointerdown', this._intro.onInput)
            window.addEventListener('wheel', this._intro.onInput)
        },

        skipIntroCinematic() {
            if (!this._intro?.active) return
            this._intro.skipped = true
            this._intro.t0 = -Infinity // force completion on next update
        },

        _createIntroOverlay() {
            if (typeof document === 'undefined') return null
            const el = document.createElement('div')
            el.id = 'intro-cinematic-overlay'
            el.textContent = 'click or press any key to skip'
            Object.assign(el.style, {
                position: 'fixed',
                inset: '0',
                background: '#000',
                opacity: '1',
                zIndex: '5000',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.55)',
                font: '12px system-ui, sans-serif',
                paddingBottom: '24px',
                transition: 'opacity 200ms linear'
            })
            document.body.appendChild(el)
            return el
        },

        /**
         * Drive the cinematic camera. Called from _updateCamera; returns true
         * while the intro owns the camera.
         */
        _updateIntroCamera() {
            const intro = this._intro
            if (!intro?.active) return false

            const now = performance.now()
            // Wait for terrain to be built around the pawn before fading in.
            if (!this._ground) return true
            if (intro.t0 === null) intro.t0 = now

            const elapsed = now - intro.t0
            const pawn = intro.pawn
            const groundY = this._getGroundHeightAt(pawn.x, pawn.y)
            const headY = groundY + 2

            if (elapsed >= INTRO_TOTAL_MS || intro.t0 === -Infinity) {
                this._finishIntroCamera(pawn)
                return true
            }

            let opacity = 0
            if (elapsed < INTRO_FADE_IN_MS) {
                opacity = 1 - elapsed / INTRO_FADE_IN_MS
            }
            if (elapsed < INTRO_ORBIT_MS) {
                const pose = introCameraPose(elapsed / INTRO_ORBIT_MS, pawn.x, pawn.y, headY)
                this._camera3d.position.set(pose.x, pose.y, pose.z)
                this._camera3d.lookAt(pose.lookX, pose.lookY, pose.lookZ)
            } else if (elapsed < INTRO_ORBIT_MS + INTRO_HOLD_MS) {
                // Pointed straight down at the pawn, hovering.
                this._camera3d.position.set(pawn.x, headY + INTRO_END_HEIGHT, pawn.y + 0.01)
                this._camera3d.lookAt(pawn.x, headY, pawn.y)
            } else {
                // Snap phase: dip to black, then hand over to first person.
                const snapT = (elapsed - INTRO_ORBIT_MS - INTRO_HOLD_MS) / INTRO_SNAP_MS
                opacity = Math.min(1, snapT * 1.6)
                this._camera3d.position.set(pawn.x, headY + INTRO_END_HEIGHT * (1 - snapT), pawn.y + 0.01)
                this._camera3d.lookAt(pawn.x, headY, pawn.y)
                if (snapT >= 0.5 && !intro.entered) {
                    intro.entered = true
                    this.enterFirstPerson(pawn)
                }
            }
            if (intro.overlay) intro.overlay.style.opacity = String(opacity)
            return true
        },

        _finishIntroCamera(pawn) {
            this.enterFirstPerson(pawn)
            this._removeIntroOverlay()
        },

        _removeIntroOverlay() {
            const intro = this._intro
            if (!intro) return
            intro.active = false
            window.removeEventListener('keydown', intro.onInput)
            window.removeEventListener('pointerdown', intro.onInput)
            window.removeEventListener('wheel', intro.onInput)
            if (intro.overlay) {
                intro.overlay.style.opacity = '0'
                const el = intro.overlay
                setTimeout(() => el.remove(), 250)
            }
            this._intro = null
        }
    }
}
