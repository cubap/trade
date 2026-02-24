# Copilot Persistent Context

Last updated: 2026-02-23

## Working Agreements

- Keep documentation canonical under `docs/`
- Keep AI-session and implementation memory under `.copilot/`
- Avoid reintroducing scattered session logs in root or `solo/`

## Canonical Doc Map

- Goal architecture: `docs/architecture/hierarchical-goals.md`
- Invention system: `docs/systems/invention-system.md`
- Memory roadmap: `docs/plans/memory-system-roadmap.md`
- Civilization roadmap: `docs/plans/civilization-roadmap.md`

## Current State Snapshot

- Hierarchical goal planning is active and integrated with resource memory
- Invention system is implemented and configurable
- Memory system has baseline cleanup but still needs clustering, route planning, and social sharing
- Civilization systems remain roadmap-level and should be implemented in phased slices

## Documentation Hygiene Rules

- Session-specific notes belong in `.copilot/` only
- Promote durable guidance to `docs/` after stabilization
- Remove or merge superseded markdown docs promptly

## Next Recommended Work Tracks

1. Implement memory clustering and add focused tests
2. Prototype route-aware gather planning for craft prerequisites
3. Start Phase 0 civilization foundations (bond tracking and group formation)
