# Copilot Worklog

## 2026-02-23

- Consolidated scattered markdown documentation into canonical files under `docs/`
- Created persistent Copilot context under `.copilot/context.md`
- Marked transient implementation/session summary docs for removal
- Implemented learnable memory clustering, route planning, social memory sharing, revisit confidence decay, and observed-success route weighting
- Implemented broad resource specialization by domain (including agriculture class transfer for seeds/soils) and intent-aware stick/wood discernment for value appraisal
- Documented additional specialization and mercantile-path opportunities as future considerations in docs
- Synthesized recurring ideas from `docs/TradeGameNotes.pdf` into canonical occupation/economy documentation
- Formalized Tribe/Town/Traders framing and occupation-focused priorities in docs and persistent context
- Documented skill distribution across triad with context-dependent expressions (teaching, crafting, assessment)
- Documented cross-triad interaction patterns (security contracts, supply chains, market anchoring, knowledge circulation)
- Established progression pacing targets (7-day adulthood, 20-day specialization, 5-month mid-game, 1-year city)
- Added timing benchmarks to InventionConfig and civilization roadmap with concrete tick values
- Updated persistent context with core design principles (pacing targets, gameplay feel, control style)
- **Compared framework with docs/trees knowledge trees:**
  - Trees provide detailed prerequisite chains (skills, materials, tools, structures, 3 paths)
  - Framework provides timing targets and cross-triad interaction patterns
  - Identified work items: occupation signal scoring, prerequisite evaluation system, contract primitives, teaching variants, group formation mechanics
  - Resolved terminology (Tribe↔Tribal, Town↔Civic, Traders↔Mercantile are compatible)
  - Noted skill scaling question (recommend dual-scale: 0-10 unlock tiers, 0-100 mastery levels)
  - Documented findings in `.copilot/trees-framework-alignment.md`
- **Configured Netlify deployment:**
  - Created `netlify.toml` with static site configuration (Node 22.0.0, redirects, cache headers)
  - Created `.nvmrc` for Node version pinning
  - Updated `.gitignore` (added .env, .netlify, build artifacts)
  - Created serverless function `netlify/functions/dev-log.js` for client-side logging
  - Created `NETLIFY_DEPLOY.md` with deployment instructions
  - Created root `README.md` with project overview, quick start, and design principles
  - Configured auto-deploy on push to main branch
  - Root URL redirects to solo game at `/solo/index.html`
- **Configured Railway deployment:**
  - Created `railway.toml` with build/deploy configuration
  - Created `Procfile` for process management
  - Created `RAILWAY_DEPLOY.md` with comprehensive deployment guide
  - Updated environment variable references from MONGODB_URI to MONGO_URI (matches code)
  - Updated README.md with dual deployment strategy (Netlify + Railway)
  - Configured auto-deploy on push to main branch
  - Railway hosts full Node.js server with Socket.io and MongoDB

## 2026-02-24 — Progression Slice Log

- Checklist item: `<copy exact item text>`
- Status: `done` | `partial` | `blocked`
- Files changed:
  - `path/to/file`
  - `path/to/file`
- What changed:
  - `<1-3 bullets>`
- Verification:
  - Automated: `<test command or test file + result>`
  - Manual: `<exact behavior validated>`
- Risks / follow-up:
  - `<any residual risk or next action>`

- [date/time] `<item>` — done
  - files: `...`
  - verify: `...`
  - next: `...`

## 2026-03-08 — Progression Slice 1 (partial)

- Checklist item: external progression payload + override phase + first capability consumers (`validCamera`, `compass`, `minimap`)
- Status: `partial`
- Files changed:
  - `solo/js/core/ProgressionController.js`
  - `solo/js/core/PlayerMode.js`
  - `solo/js/app.js`
  - `solo/js/rendering/CanvasRenderer.js`
  - `solo/js/rendering/UIRenderer.js`
  - `solo/js/rendering/CameraController.js`
  - `solo/js/ui/controls.js`
  - `solo/test/player-mode.test.js`
  - `solo/test/progression-controller.test.js`
- What changed:
  - Added external progression controller with phase defaults, mode unlock state, override phase support, and transition telemetry.
  - Wired payload propagation into player mode + renderer and added capability-aware compass/minimap + override badge behavior.
  - Added dev time controls (speed presets, step tick, skip ticks) and phase override controls in the UI.
- Verification:
  - Automated: `solo/test/player-mode.test.js`, `solo/test/progression-controller.test.js` (15 passed, 0 failed)
  - Manual: not run in-browser yet (pending)
- Risks / follow-up:
  - Perception toggle policy is only partially enforced; needs full phase/mode matrix handling.
  - Fast-forward telemetry correctness should be validated manually with unlock transitions.

## 2026-03-08 — Progression Slice 1 (continued)

- Checklist item: complete telemetry event coverage and fast-forward transition tests
- Status: `done`
- Files changed:
  - `solo/js/core/ProgressionController.js`
  - `solo/test/progression-controller.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added `capability_unlocked` event emission when capability modules change across progression updates.
  - Added progression test for fast-forward-style milestone transitions and telemetry expectations.
  - Updated checklist status for completed DoD and file-level tasks.
- Verification:
  - Automated: `solo/test/player-mode.test.js`, `solo/test/progression-controller.test.js` (17 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - Manual verification of override badge visibility and in-browser controls remains open.

## 2026-03-08 — Progression Slice 1 (UI verification)

- Checklist item: verify override badge capability path
- Status: `done`
- Files changed:
  - `solo/test/ui-renderer-capabilities.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added unit test validating `UIRenderer.setCapabilities` toggles compass/minimap and override badge text.
  - Promoted override badge DoD item to done with automated evidence.
- Verification:
  - Automated: `solo/test/player-mode.test.js`, `solo/test/progression-controller.test.js`, `solo/test/ui-renderer-capabilities.test.js` (18 passed, 0 failed)
  - Manual: pending for in-browser interaction feel
- Risks / follow-up:
  - Perception matrix and full manual interaction checks still pending.

## 2026-03-08 — Progression Slice 1 (perception policy hardening)

- Checklist item: prevent perception toggle from violating phase/mode policy
- Status: `done`
- Files changed:
  - `solo/js/ui/followControls.js`
  - `solo/js/ui/controls.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added policy sync hook for perception controls.
  - Locked perception toggle and cleared active perception when policy is `disabled` or `god_noop`.
  - Wired progression payload updates to refresh perception policy in UI.
- Verification:
  - Automated: `solo/test/player-mode.test.js`, `solo/test/progression-controller.test.js`, `solo/test/ui-renderer-capabilities.test.js` (18 passed, 0 failed)
  - Manual: pending for in-browser UX
- Risks / follow-up:
  - Full perception matrix behavior still needs broader phase-by-phase validation.

## 2026-03-08 — Progression Slice 1 (full suite verification)

- Checklist item: run broader solo test suite and update residual risk posture
- Status: `done`
- Files changed:
  - `.copilot/progression_checklist.md`
- What changed:
  - Executed full `solo/test` suite set and confirmed no regressions.
  - Marked progression contract tests as complete and closed fast-forward transition risk based on automated evidence.
- Verification:
  - Automated: `solo/test/*.test.js` (18 passed, 0 failed)
  - Manual: still pending for interactive UX checks
- Risks / follow-up:
  - Renderer/UI drift risk and debug override leak risk remain open until interactive/manual validation and additional integration tests.

## 2026-03-08 — Progression Slice 1 (override lifecycle verification)

- Checklist item: close debug override leak risk with deterministic tests
- Status: `done`
- Files changed:
  - `solo/test/progression-controller.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added test confirming override session context while active and clean evaluator fallback after `clearOverridePhase()`.
  - Marked debug override leak risk mitigated in checklist.
- Verification:
  - Automated: `solo/test/progression-controller.test.js`, `solo/test/player-mode.test.js`, `solo/test/ui-renderer-capabilities.test.js` (19 passed, 0 failed)
  - Manual: pending for interactive controls UX
- Risks / follow-up:
  - Renderer/UI drift remains the primary open risk requiring broader integration validation.

## 2026-03-08 — Progression Slice 1 (renderer capability integration test)

- Checklist item: close renderer/UI drift risk for first capability slice
- Status: `done`
- Files changed:
  - `solo/test/canvas-renderer-capabilities.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added integration-style renderer test (with DOM stubs) validating payload propagation to minimap visibility, camera pan permission, and perception policy.
  - Marked renderer/UI drift risk mitigated for the first capability slice.
- Verification:
  - Automated: `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/progression-controller.test.js`, `solo/test/player-mode.test.js`, `solo/test/ui-renderer-capabilities.test.js` (20 passed, 0 failed)
  - Manual: pending for in-browser feel checks
- Risks / follow-up:
  - Remaining open work is manual interaction validation and post-slice deferred feature expansion.

## 2026-03-08 — Deferred kickoff (visibility matrix increment)

- Checklist item: begin post-slice visibility matrix expansion
- Status: `partial`
- Files changed:
  - `solo/js/core/ProgressionController.js`
  - `solo/test/progression-controller.test.js`
  - `solo/test/canvas-renderer-capabilities.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added explicit `perceptionModePolicy` defaults for every phase in capability payload.
  - Extended tests to assert policy values in default and override paths.
  - Logged deferred progress while keeping broader visibility-matrix item open.
- Verification:
  - Automated: `solo/test/progression-controller.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js`, `solo/test/ui-renderer-capabilities.test.js` (20 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - Remaining visibility matrix fields (labels/overlays/controls) still need staged enforcement.

## 2026-03-08 — Deferred visibility contract expansion (labels/overlays)

- Checklist item: continue visibility matrix payload expansion without UI breakage
- Status: `partial`
- Files changed:
  - `solo/js/core/ProgressionController.js`
  - `solo/test/progression-controller.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added phase-default `labels` and `mapOverlay` capability fields to progression payload.
  - Added test assertions for default and override module values.
- Verification:
  - Automated: `solo/test/progression-controller.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js`, `solo/test/ui-renderer-capabilities.test.js` (20 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - UI consumption of `labels`/`mapOverlay` still pending; current work establishes contract only.

## 2026-03-08 — Progression payload hardening

- Checklist item: harden capability payload against shared default mutation
- Status: `done`
- Files changed:
  - `solo/js/core/ProgressionController.js`
- What changed:
  - Cloned emitted module payloads (including `mapOverlay`) to avoid accidental mutation of shared phase defaults by consumers.
- Verification:
  - Automated: `solo/test/progression-controller.test.js`, `solo/test/player-mode.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/ui-renderer-capabilities.test.js` (20 passed, 0 failed)
  - Manual: not required
- Risks / follow-up:
  - Continue staged enforcement of new module fields in renderer/UI.

## 2026-03-08 — Deferred increment (minimap stage awareness)

- Checklist item: start radar/partial/full minimap behavioral differentiation
- Status: `partial`

## 2026-03-08 — Deferred increment (labels/mapOverlay HUD surfacing)

- Checklist item: continue visibility matrix enforcement for labels and overlays
- Status: `partial`
- Files changed:
  - `solo/js/rendering/UIRenderer.js`
  - `solo/test/ui-renderer-capabilities.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added a capability panel in `UIRenderer` that surfaces current `labels` mode and `mapOverlay` set.
  - Derived readable strings in `setCapabilities` so phase differences are inspectable and testable.
  - Expanded UI renderer capability test assertions for labels and overlay values.
- Verification:
  - Automated: `solo/test/ui-renderer-capabilities.test.js`, `solo/test/progression-controller.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js` (20 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - Current panel is diagnostic; next pass should convert overlay flags into concrete minimap/world annotation behavior.

## 2026-03-08 — Deferred increment (telemetry diff stability + minimap stage behavior)

- Checklist item: strengthen progression transition correctness and radar/map differentiation
- Status: `partial`
- Files changed:
  - `solo/js/core/ProgressionController.js`
  - `solo/js/rendering/UIRenderer.js`
  - `solo/test/progression-controller.test.js`
  - `solo/test/ui-renderer-capabilities.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Replaced reference-only module comparison with array-aware value comparison to prevent false `capability_unlocked` emissions.
  - Added regression test proving unchanged payload modules do not emit repeated capability unlock events.
  - Upgraded minimap rendering to use mode-specific detail levels (entity caps, mobile-only radar stages, scan ring for radar modes).
- Verification:
  - Automated: `solo/test/ui-renderer-capabilities.test.js`, `solo/test/progression-controller.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js` (22 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - Overlay flags are now visible and staged, but semantic overlays (e.g., route traces, waypoints) still need world-data-backed drawing.

## 2026-03-08 — Deferred increment (interaction/feedback debug consumption)

- Checklist item: begin consuming steering and interaction modules in UI flow
- Status: `partial`
- Files changed:
  - `solo/js/ui/controls.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added secondary progression debug readout showing `steering`, `interactionControls`, and `feedbackChannels` from capability payload.
  - Preserved existing phase/camera/compass/minimap line and perception policy sync behavior.
- Verification:
  - Automated: `solo/test/progression-controller.test.js`, `solo/test/ui-renderer-capabilities.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js` (22 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - Current consumption is informational only; direct action affordances for interaction controls are still pending.

## 2026-03-08 — Deferred increment (mapOverlay semantic minimap rendering)

- Checklist item: move overlay modules from diagnostic text to concrete map behavior
- Status: `partial`
- Files changed:
  - `solo/js/rendering/UIRenderer.js`
  - `solo/test/ui-renderer-capabilities.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added `mapOverlay`-driven minimap rendering hooks.
  - Implemented chunk-edge overlay drawing for `biome_edges`.
  - Implemented immobile resource marker overlay for `resource_class` and `resource_known_types`.
  - Added unit assertions for active overlay set extraction.
- Verification:
  - Automated: `solo/test/ui-renderer-capabilities.test.js`, `solo/test/progression-controller.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js` (22 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - Route traces and waypoint overlays still need dedicated world-data hooks.

## 2026-03-08 — Deferred visibility contract expansion (steering/controls/feedback)

- Checklist item: continue visibility and cognition contract expansion for upcoming UI hooks
- Status: `partial`
- Files changed:
  - `solo/js/core/ProgressionController.js`
  - `solo/test/progression-controller.test.js`
- What changed:
  - Added phase-default `steering`, `interactionControls`, and `feedbackChannels` fields to progression payload modules.
  - Added test assertions for default and override module contracts.
- Verification:
  - Automated: `solo/test/progression-controller.test.js`, `solo/test/player-mode.test.js`, `solo/test/ui-renderer-capabilities.test.js`, `solo/test/canvas-renderer-capabilities.test.js` (20 passed, 0 failed)
  - Manual: pending
- Risks / follow-up:
  - Renderer/UI behavior remains unchanged for these new fields; next step is staged consumer adoption.
- Files changed:
  - `solo/js/rendering/UIRenderer.js`
  - `solo/test/ui-renderer-capabilities.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added tracked `minimapMode` in UI renderer capability state.
  - Added stage label rendering so minimap mode progression is visible in runtime/debug.
  - Extended tests to assert minimap mode transitions from capabilities.
- Verification:
  - Automated: `solo/test/ui-renderer-capabilities.test.js`, `solo/test/progression-controller.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/player-mode.test.js` (20 passed, 0 failed)
  - Manual: pending for subjective readability review
- Risks / follow-up:
  - Minimap visuals remain placeholder; semantic overlays and true radar behavior still pending.

## 2026-03-08 — Deferred increment (status-layer gating)

- Checklist item: begin capability-driven HUD status depth progression
- Status: `partial`
- Files changed:
  - `solo/js/core/ProgressionController.js`
  - `solo/js/ui/statsDisplay.js`
  - `solo/test/progression-controller.test.js`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added phase-default `pawnStatus` capability arrays to progression payload.
  - Added capability-aware row gating in Pawn HUD (`statsDisplay`) so detail depth can evolve by phase.
  - Extended progression contract tests for `pawnStatus` defaults and override behavior.
- Verification:
  - Automated: `solo/test/progression-controller.test.js`, `solo/test/player-mode.test.js`, `solo/test/canvas-renderer-capabilities.test.js`, `solo/test/ui-renderer-capabilities.test.js` (20 passed, 0 failed)
  - Manual: pending for perceived readability/clarity checks
- Risks / follow-up:
  - HUD gating currently affects core rows only; deeper panel stratification remains for later slice.

## 2026-03-08 — Clean handoff packaged

- Checklist item: package plan/local context for cloud-agent continuation
- Status: `done`
- Files changed:
  - `.copilot/HANDOFF_2026-03-08_progression.md`
  - `.copilot/worklog.md`
- What changed:
  - Consolidated architecture state, completed increments, test backstop, remaining priorities, and a copy/paste cloud-agent bootstrap prompt into one handoff file.
- Verification:
  - Automated: not applicable (documentation-only)
  - Manual: reviewed for continuity against checklist/worklog/deferred items
- Risks / follow-up:
  - Cloud continuation still depends on completing manual runtime checks listed in checklist.

Use this file for future short-lived execution logs. Promote durable outcomes into `docs/`.

## 2026-03-08 — Deferred overlay tests + interaction panel + feedback channel UI

- Checklist item: implement `route_traces`/`waypoints_local` tests, actionable interaction panel, and lightweight feedback channel UI
- Status: `done`
- Files changed:
  - `solo/test/ui-renderer-capabilities.test.js` — added 4 overlay tests
  - `solo/test/player-mode.test.js` — added 2 `pinLocation` tests
  - `solo/test/feedback-channel-ui.test.js` — new 3-test suite for feedback channel UI
  - `solo/js/core/PlayerMode.js` — added `localPins` array and `pinLocation()` method
  - `solo/js/ui/interactionPanel.js` — new module: phase-gated actionable HUD controls
  - `solo/js/ui/feedbackChannelUI.js` — new module: progression-event-driven toast notifications
  - `solo/js/app.js` — wired interactionPanel and feedbackChannelUI into startMainLoop/syncProgressionState
  - `.copilot/worklog.md`
  - `.copilot/progression_checklist.md`
- What changed:
  - Added 4 targeted tests for `renderMinimapRouteTraces`, `renderMinimapWaypoints`, and `renderMinimapOverlays` dispatch in `ui-renderer-capabilities.test.js`. All overlay rendering paths now have automated evidence.
  - Added `pinLocation(x, y, label)` to `PlayerMode`: stores to `localPins[]` in pawn mode, delegates to `addWaypoint` in overseer mode. Added two tests covering both paths.
  - Created `solo/js/ui/interactionPanel.js`: mounts a fixed HUD panel that surfaces actionable controls from the `interactionControls` capability — nudge-need buttons (`nudge_need_focus`), location pin (`goal_pin_local`), route pin (`goal_pin_route`), waypoint place/edit/remove (`waypoint_place`, `waypoint_edit`, `waypoint_remove`). Visibility and content are driven entirely by the capability payload each tick.
  - Created `solo/js/ui/feedbackChannelUI.js`: listens to progression events and produces toast notifications. `capability_unlocked` events emit per-module change toasts. `capability_reflection` triggers a phase summary panel on phase transitions. `intent_confirmation` produces short goal-change toasts when the pawn adopts a new goal description.
  - Wired both modules in `app.js`: `_interactionPanel.update()` and `_feedbackUI.onProgressionPayload()` are called each tick in `syncProgressionState`.
- Verification:
  - Automated: `solo/test/*.test.js` — **96 passed, 0 failed**
  - Manual: pending for in-browser feel checks
- Risks / follow-up:
  - Manual browser verification of interaction panel HUD layout and toast readability remains open.
  - `goal_pin_route` currently pins the pawn's position (not a full route snapshot); a richer route-capture could be added later.
  - `waypoint_edit` inline input updates the waypoint object in memory but does not persist between refreshes (no persistence layer yet).
