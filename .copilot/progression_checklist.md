# Progression Checklist

Last updated: 2026-03-08

Purpose: execution checklist for progression/camera/HUD slice.
Companion log: `.copilot/worklog.md` for dated notes and outcomes.

## Slice 1 Scope (Locked)

- External progression payload is emitted each update.
- Dev controls include pause/resume, speed presets, step ticks.
- One debug override is active: forced phase (`overridePhase`).
- Renderer/UI consume first three capability flags:
  - `validCamera`
  - `compass`
  - `minimap`
- Telemetry includes:
  - `phase_entered`
  - `unlock_reason`
  - `created_landmark_return_loops`

## Definition of Done (Slice 1)

- [x] Forcing each phase updates camera/compass/minimap immediately.
- [x] Pause/speed/step work without simulation desync.
- [x] Override-active indicator is visible in debug UI.
- [x] Transition telemetry logs in normal and fast-forward updates.
- [x] No direct-command path introduced; thought-boost autonomy unchanged.

## File-by-File Checklist

### `solo/js/core/PlayerMode.js`

- [x] Add `setCapabilities(payload)` consumer.
- [x] Gate mode switches using `payload.modeUnlocked` when payload exists.
- [x] Keep fallback behavior when payload is absent.
- [x] Expose current resolved capabilities getter.

### `solo/js/core/ProgressionController.js` (new)

- [x] Emit capability payload from pawn/world state.
- [x] Support `overridePhase`.
- [x] Emit transition events (`phase_entered`, `mode_unlocked`, `capability_unlocked`).
- [x] Attach gate snapshot and unlock reason to telemetry context.

### `solo/js/rendering/CanvasRenderer.js`

- [x] Respect payload for `validCamera`, `compass`, `minimap`.
- [x] Preserve legacy behavior if no payload is present.
- [x] Ensure atomic apply on phase transition.

### `solo/js/rendering/UIRenderer.js`

- [x] Show/hide compass by capability.
- [x] Show/hide minimap by capability.
- [x] Add visible debug badge when overrides are active.

### `solo/js/ui/followControls.js`

- [x] Add pause/resume control.
- [x] Add speed preset selector.
- [x] Add step-ticks control.
- [x] Keep deterministic behavior under pause/step.

Note: implemented in `solo/js/ui/controls.js` to keep dev controls centralized.

### `solo/js/ui/controls.js`

- [x] Add debug section for `overridePhase`.
- [x] Add apply/clear override controls.
- [x] Display current phase and key effective capabilities.

### `solo/js/app.js`

- [x] Instantiate and wire progression controller.
- [x] Update progression each tick.
- [x] Push payload into mode and renderer/UI consumers.
- [x] Ensure skip/fast-forward path still processes progression updates.

### Tests

- [x] Update `solo/test/player-mode.test.js` for payload-gated unlock behavior.
- [x] Add progression contract tests in `solo/test/`:

  - [x] phase transitions
  - [x] override behavior
  - [x] telemetry emission
  - [x] fast-forward transition correctness

## Verification Checklist

### Manual

- [ ] Start fresh in pawn phase defaults.
- [ ] Force each phase and verify capability effects.
- [ ] Use pause, step, and speed presets in combination.
- [ ] Trigger at least one unlock transition during fast-forward.
- [ ] Confirm override badge always visible when active.

### Automated

- [x] Run relevant `solo/test/*` suites for player mode/progression.
- [x] Confirm no regressions in existing player mode tests.

Automated evidence:

- `solo/test/ui-renderer-capabilities.test.js` validates capability-driven override badge state.

## Risks / Watch Items

- [x] Renderer and UI drift if capability payload is partially consumed.
- [x] Legacy perception toggle conflicting with phase contract.
- [x] Fast-forward skipping transition events.
- [x] Debug overrides leaking into non-debug contexts.

Mitigation note:

- Renderer capability propagation is covered in `solo/test/canvas-renderer-capabilities.test.js`.
- Perception toggle is now policy-synchronized (`disabled`/`god_noop` lock the UI toggle and clear active perception state).
- Fast-forward transition path is covered in `solo/test/progression-controller.test.js`.
- Override lifecycle path (`set -> active`, `clear -> evaluator-driven`) is covered in `solo/test/progression-controller.test.js`.

## Deferred (Post Slice 1)

- [ ] Full visibility matrix enforcement beyond first 3 capability flags.
- [ ] Thought injection UI and competing-thought feedback loop.
- [ ] Radar semantic stages and partial recall map behavior.
- [ ] Expanded dashboard/status progression layers.

Deferred progress note:

- Added phase-default `perceptionModePolicy` values in progression payload and covered via tests.
- Added phase-default `labels` and `mapOverlay` payload fields and covered contract assertions via tests.
- Added `UIRenderer` capability panel consumption for `labels` and `mapOverlay` so phase contract differences are visible in HUD.
- Added minimap stage-mode awareness in `UIRenderer` with test coverage (`radar`/`partial`/`full` mode labels).
- Added phase-default `pawnStatus` payload fields and capability-aware HUD row gating in `statsDisplay`.
- Added phase-default `steering`, `interactionControls`, and `feedbackChannels` payload fields with contract assertions in progression tests.
- Added initial controls-panel consumption of `steering`, `interactionControls`, and `feedbackChannels` in progression debug output.
- Fixed capability transition diffing to avoid false `capability_unlocked` events when array modules are value-equal across ticks.
- Upgraded minimap behavior by stage (`radar_blips`/`radar_icons`/`partial_recall_map`/`local_full_map`/`strategic_map`) with mode-specific entity density and radar scan ring.
- Added minimap overlay semantics for `mapOverlay` modules: chunk edge grid when `biome_edges` is active and immobile resource markers for `resource_class`/`resource_known_types`.
- **[2026-03-08]** Added 4 targeted tests for `route_traces` and `waypoints_local` overlay rendering, closing the test coverage gap for those minimap overlay paths.
- **[2026-03-08]** Added `PlayerMode.pinLocation()` — phase-2+-safe location pinning that stores to `localPins[]` in pawn mode and delegates to overseer `addWaypoint` when mode permits.
- **[2026-03-08]** Created `solo/js/ui/interactionPanel.js` — new HUD panel that renders capability-gated actionable controls: need nudge buttons (`nudge_need_focus`), goal/route pin (`goal_pin_local`, `goal_pin_route`), waypoint place/edit/remove (`waypoint_place`, `waypoint_edit`, `waypoint_remove`). Mounted and updated each tick via `syncProgressionState`.
- **[2026-03-08]** Created `solo/js/ui/feedbackChannelUI.js` — passive notification layer wired to progression events: `capability_unlocked` → per-module toasts; `capability_reflection` → phase-transition summary panel; `intent_confirmation` → goal-change toasts when pawn adopts a new goal. All 96 tests pass.

## Worklog Link Protocol

When completing a checklist item:

1. Add a dated note in `.copilot/worklog.md`.
2. Reference exact files touched.
3. Record verification evidence (test name, manual checks).
4. Mark checklist item complete only after verification.
