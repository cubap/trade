# Copilot Persistent Context

Last updated: 2026-02-23

## Working Agreements

- Keep documentation canonical under `docs/`
- Keep AI-session and implementation memory under `.copilot/`
- Avoid reintroducing scattered session logs in root or `solo/`

## Canonical Doc Map

- Goal architecture: `docs/architecture/hierarchical-goals.md`
- Occupation/economy framework: `docs/architecture/occupation-and-economy-framework.md`
- Invention system: `docs/systems/invention-system.md`
- Memory roadmap: `docs/plans/memory-system-roadmap.md`
- Civilization roadmap: `docs/plans/civilization-roadmap.md`

## Current State Snapshot

- Hierarchical goal planning is active and integrated with resource memory
- Invention system is implemented and configurable
- Memory system has baseline cleanup but still needs clustering, route planning, and social sharing
- Civilization systems remain roadmap-level and should be implemented in phased slices
- Occupation direction is now formalized around Tribe/Town/Traders and behavior-driven specialization
- Resource specialization now supports cross-material comprehension and use-intent valuation

## Documentation Hygiene Rules

- Session-specific notes belong in `.copilot/` only
- Promote durable guidance to `docs/` after stabilization
- Remove or merge superseded markdown docs promptly

## Next Recommended Work Tracks

1. Add occupation signal scoring and role progression events
2. Add market-aware goal weighting (specialization x demand x supply constraints)
3. Start contract primitives (supply, escort, delivery, apprenticeship)
