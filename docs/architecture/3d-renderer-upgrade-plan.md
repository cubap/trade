# 3D Renderer Upgrade Plan

## Goal
Enable true first-person pawn mode by introducing a 3D render backend while preserving the existing simulation and 2D workflows.

## Current State
- Rendering is 2D canvas (`solo/js/rendering/CanvasRenderer.js`).
- `PAWN` mode currently uses locked follow-camera fallback.
- `PlayerMode` now supports capability-based routing:
  - If renderer supports true first-person, it can call `enterFirstPerson(pawn)`.
  - Otherwise it falls back to locked 2D follow view.

## Phase 1: Renderer Interface Stabilization
- Keep shared API methods used by app/UI:
  - `setFollowEntity(entity)`
  - `setZoomToShowRadius(radius, marginFactor)`
  - `togglePerceptionMode()`
  - `render()`
- Add capability flags and hooks (already started):
  - `supportsTrueFirstPerson`
  - `enterFirstPerson(entity)`
  - `exitFirstPerson()`

## Phase 2: Add 3D Backend (Experimental)
- Create `ThreeRenderer` under `solo/js/rendering/`.
- Initial world representation:
  - Ground plane
  - Entity markers/meshes for pawns, animals, flora, resources - okay to billboard and pillbox for now.
- Camera modes:
  - Pawn mode: head-height camera attached to tracked pawn with yaw/pitch controls and smoothing on vector changes
  - Overseer/God: detached orbit or free camera
- Keep simulation authoritative in existing world/entity classes.

## Phase 3: Input + UX
- Mouse-look in first-person mode only when unlocked.
- `Esc` should exit first-person only when mode allows (or switch to overseer if unlocked).
- Mode UI text should reflect renderer capability.
- Pawn's perception should reveal nearby entities that are not large (like trees) and details are only available when approached or from memory.

## Phase 4: Performance + Validation
- Frustum culling and mesh pooling for large entity counts.
- Add smoke tests for mode transitions and renderer capability fallback.
- Keep 2D renderer as default until parity is achieved.

## Risks
- 3D rendering cost with dense flora/resource populations.
- Visual occlusion and readability compared to current top-down view.
- Input conflicts between existing shortcuts and mouse-look controls.

## Suggested Rollout
1. Land experimental 3D renderer behind URL flag.
2. Validate pawn first-person and overseer transitions.
3. Iterate on readability/performance.
4. Promote to default once stable.
