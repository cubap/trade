# Copilot Persistent Context

Last updated: 2026-02-23

## Core Design Principles

### Progression Pacing

All systems should respect these timing targets for emergent gameplay feel:

- **Individual Pawn**: Childhood → adulthood in ~7 days, professional specialization evident by ~20 days
- **Group Development**: Tribes form naturally (weeks 1-3), mid-game tech in 4-5 months, preindustrial city in ~1 year
- **Technology**: Stone age comes easily, progression brisk but not grindy (Minecraft/Vintage Story brackets, no magic)
- **Control Style**: Indirect (set goals/priorities) not micromanagement, similar to One Hour One Life's emergent feel

### Tribe/Town/Traders Triad

- Skills cluster by group but some (teaching, crafting, assessment) express differently in each context
- Cross-triad interactions drive specialization economies (tribes = security/gathering, towns = production/governance, traders = logistics/arbitrage)
- Occupation emerges from behavior patterns, not class selection

## Working Agreements

- Keep documentation canonical under `docs/`
- Keep AI-session and implementation memory under `.copilot/`
- Avoid reintroducing scattered session logs in root or `solo/`

## Canonical Doc Map

- Goal architecture: `docs/architecture/hierarchical-goals.md`
- Occupation/economy framework: `docs/architecture/occupation-and-economy-framework.md`
- **Knowledge trees:** `docs/trees/` (skills, materials, tools, structures, 3 paths with detailed prerequisites)
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
- US English spelling and consistent terminology (e.g. specialization, governance, contracts) in docs

## Trees-Framework Relationship

- **Trees** (`docs/trees/`): Detailed prerequisite chains, specific unlock thresholds, alternative material paths
- **Framework** (`docs/architecture/occupation-and-economy-framework.md`): Timing targets, gameplay feel, cross-triad interactions
- **Alignment:** Trees = WHAT unlocks, Framework = WHEN/WHY
- **Terminology:** Tribe↔Tribal/Military, Town↔Civic/Industrial, Traders↔Mercantile/Entrepreneurial
- **Key work items from alignment:** occupation signal scoring, prerequisite evaluation, contract system, teaching variants, group formation
- **Skill scaling recommendation:** Dual-scale (0-10 unlock tiers for features, 0-100 mastery for quality/identity)

## Next Recommended Work Tracks

1. **Resolve skill scaling model** (dual-scale: unlock tiers 0-10, mastery levels 0-100)
2. **Implement occupation signal scoring** (behavior frequency × success rate × domain affinity)
3. **Implement prerequisite evaluation system** (check skill/exposure/proximity conditions from trees)
4. **Add contract primitives** (supply, escort, delivery, apprenticeship, security with reputation)
5. **Implement group formation mechanics** (bonded_pair, party, clan, proto_settlement detection)
6. **Add teaching variant mechanics** (observational, formal schooling, apprenticeship)
