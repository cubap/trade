# Handoff: Progression/Camera/HUD Slice

Date: 2026-03-08
Repo: `cubap/trade`
Branch: `main`
Scope: Solo mode progression system, capability payload, camera/HUD gating, minimap stage behavior.

## TL;DR
- Core progression architecture is now externalized via `ProgressionController` and consumed by `PlayerMode` + renderer/UI.
- Slice 1 goals are complete in automated coverage.
- Deferred work is in progress with meaningful wins (labels/overlay surfacing, stage-specific minimap behavior, overlay semantics, module contract expansion).
- Current automated backstop: `22 passed, 0 failed` on targeted progression/rendering suites.
- Main unfinished areas: manual UX verification and higher-fidelity overlay/interaction behavior.

## What Is Implemented

### Runtime and contracts
- Added `solo/js/core/ProgressionController.js` with:
  - deterministic phase defaults
  - external `modeUnlocked` and module payload
  - override phase support
  - transition telemetry: `phase_entered`, `mode_unlocked`, `capability_unlocked`
  - array-safe payload cloning and array-aware change diffing (prevents false capability unlock spam)

- Updated `solo/js/core/PlayerMode.js`:
  - `setCapabilities(payload)` / `getCapabilities()`
  - unlock gate consumption from external payload with safe fallback to legacy behavior

- Updated `solo/js/app.js`:
  - progression lifecycle wiring per tick
  - payload sync into mode + renderer
  - fast-forward/skip paths call progression sync
  - override callback integration from controls

### Camera and renderer
- Updated `solo/js/rendering/CameraController.js`:
  - `allowManualPan` guard

- Updated `solo/js/rendering/CanvasRenderer.js`:
  - `setCapabilities/getCapabilities`
  - applies minimap visibility, camera pan permissions, perception policy
  - blocks perception toggle for `disabled` / `god_noop`

- Updated `solo/js/rendering/UIRenderer.js`:
  - capability-driven compass/minimap/override badge
  - labels + map overlay diagnostic panel
  - minimap stage configs (`radar_blips`, `radar_icons`, `partial_recall_map`, `local_full_map`, `strategic_map`)
  - mode-specific minimap detail density and radar scan ring
  - initial semantic overlays:
    - `biome_edges` -> chunk-edge lines
    - `resource_class`/`resource_known_types` -> immobile resource markers

### Controls and HUD
- Updated `solo/js/ui/controls.js`:
  - pause/speed presets/step/skip controls
  - phase override controls
  - progression debug line (phase/camera/compass/minimap)
  - additional module debug line (`steering`, `interactionControls`, `feedbackChannels`)

- Updated `solo/js/ui/followControls.js`:
  - policy sync for perception toggle; disables and clears mode when policy forbids usage

- Updated `solo/js/ui/statsDisplay.js`:
  - capability-aware `pawnStatus` gating for HUD detail depth

## Tests and Verification

### Added tests
- `solo/test/progression-controller.test.js`
- `solo/test/ui-renderer-capabilities.test.js`
- `solo/test/canvas-renderer-capabilities.test.js`

### Updated tests
- `solo/test/player-mode.test.js`

### Latest automated result
- Targeted suites: `22 passed, 0 failed`
- Command pattern used:
  - `solo/test/progression-controller.test.js`
  - `solo/test/ui-renderer-capabilities.test.js`
  - `solo/test/canvas-renderer-capabilities.test.js`
  - `solo/test/player-mode.test.js`

## Source of Truth Files
- Checklist: `.copilot/progression_checklist.md`
- Detailed chronological log: `.copilot/worklog.md`
- Design canon/spec: `docs/plans/player-modes.md`

## Remaining Work (Ordered)

1. Manual verification pass (required)
- Force each phase and verify camera/compass/minimap transitions live.
- Verify override badge and dev controls under pause/step/skip.
- Confirm perception lock behavior in forbidden policies.

2. Overlay semantics expansion
- Implement `route_traces` and `waypoints_local` minimap/world overlay behavior.
- Add tests for overlay-specific rendering decisions.

3. Interaction module consumption
- Move from debug-only display to actionable UI controls for:
  - `nudge_need_focus`
  - `goal_pin_local`
  - `goal_pin_route`
  - waypoint edit/remove (when unlocked)

4. Feedback channel consumption
- Add lightweight UI channels for:
  - `intent_confirmation`
  - `capability_reflection`
  - `achievement_log`
- Keep autonomy guardrail: no direct command queue semantics.

5. Dashboard/status progression depth
- Continue `pawnStatus` stratification with additional panel layers by phase.

## Backstop Before Cloud Handoff

The cloud agent should not proceed until this minimal backstop is confirmed:

- [ ] Run the 4 targeted tests and confirm green.
- [ ] Perform manual checklist from `.copilot/progression_checklist.md` "Manual" section.
- [ ] Confirm no diagnostics in touched progression/renderer/control files.
- [ ] Record manual findings in `.copilot/worklog.md` with date/time.

## Known Risks
- Manual UX/feel validation is still pending.
- Route/waypoint overlays are not yet semantically complete.
- New interaction/feedback modules are currently informational in debug UI, not full control surfaces.

## Cloud Agent Bootstrap Prompt (Copy/Paste)

Use this as the first message to a cloud agent:

"Continue the progression/camera/HUD deferred work in `cubap/trade` from `.copilot/HANDOFF_2026-03-08_progression.md`, `.copilot/progression_checklist.md`, and `.copilot/worklog.md`. Respect existing architecture: external progression controller owns gate logic; renderer/UI are capability consumers. First, run and keep green these tests: `solo/test/progression-controller.test.js`, `solo/test/ui-renderer-capabilities.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js`. Then complete manual verification checklist items. Next implement semantic `route_traces` and `waypoints_local` overlays, followed by actionable interaction-control consumption and lightweight feedback-channel UI. Log each increment in `.copilot/worklog.md` and update deferred notes in `.copilot/progression_checklist.md`. Do not introduce direct-command control paths; keep autonomy-weighted behavior." 

## Notes
- This file is intentionally compact and execution-oriented for handoff continuity.
- Existing long-form rationale and contract details remain in `docs/plans/player-modes.md`.
