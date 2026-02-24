# Trees-Framework Alignment Analysis

**Date:** 2026-02-23

## Overview

This document compares today's [occupation-and-economy-framework.md](../docs/architecture/occupation-and-economy-framework.md) work with the existing detailed knowledge trees in [docs/trees/](../docs/trees/).

## Terminology Mapping

The framework and trees use compatible but different names for the three paths:

| Framework | Trees | Alignment |
|-----------|-------|-----------|
| **Tribe** | Tribal / Military | Survivalist → Clan → Military Organisation |
| **Town** | Civic / Industrial | Encampment → Hamlet → Village |
| **Traders** | Mercantile / Entrepreneurial | Surplus/Exchange → Trade Routes → Enterprise |

**Recommendation:** Keep both. Framework uses short names for brand/identity, trees use descriptive names for progression paths.

## Timing Targets vs Tree Stages

Today's framework established concrete timing benchmarks. Here's how they map to tree progression stages:

### Individual Pawn Timeline

| Framework Target | Tree Milestone | Notes |
|-----------------|----------------|-------|
| **Days 1-7: Basic Competence** | Skills tree foundational skills unlock (Gathering, Exploration, Knapping, Weaving) | Stone age skills should come easily |
| **Days 7-20: Professional Lock-in** | First specialization evident (Primitive Hunter OR Surplus Accumulation OR Construction Basics ≥2) | Occupation signal scoring needed |
| **Weeks 3-8: Domain Specialist** | Skills reach ≥3 in primary domain, synergies active | Specialist threshold = 40 per InventionConfig |

### Group Timeline

| Framework Target | Tree Milestone | Group Type | Notes |
|-----------------|----------------|------------|-------|
| **Weeks 1-3: Natural Grouping** | Bonded Pair / Small Party | `bonded_pair`, `party` | From proximity and shared work |
| **Weeks 2-4: Proto-Organization** | Proto-Settlement OR Clan Formation | `proto_settlement`, `clan` | Structure clustering detection |
| **Weeks 4-8: Formal Groups** | Hamlet OR Territory Claim | `hamlet`, `clan_territory` | Named groups with roles |
| **Months 2-3: Specialized Groups** | Village OR Caravan | `village`, `caravan` | Formal governance/trade |
| **Months 3-5: Mid-Game** | Organised Labour, Workshop, Market | Structure unlocks | Iron age tech accessible |
| **Months 6-12: City Complexity** | Governance, Currency, Guild System | Multi-group interactions | Full preindustrial |

## Key Observations

### 1. Implementation Status

- **Trees:** Mostly 🔮 (planned), detailed prerequisites, few ✅ (implemented)
- **Framework:** Establishes timing constraints and style guidance
- **Gap:** Trees provide WHAT unlocks, framework provides WHEN it should unlock
- **Action:** Use timing targets to set skill gain rates and prerequisite thresholds

### 2. Teaching Variants (Framework Addition)

Framework documents context-dependent teaching expressions:
- **Tribe:** Elder observational learning (passive proximity skill gain)
- **Town:** Formal schooling (structured lessons, prerequisites)
- **Trader:** Contract apprenticeships (master-novice pairs, fees)

**Tree state:** Skills tree has basic Teaching skill, doesn't reflect variants yet

**Work item:** Add teaching variant mechanics to skills tree and civic/mercantile paths

### 3. Cross-Triad Interaction Patterns (Framework Addition)

Framework documents 9 specific interaction patterns (security-for-goods, bulk supply, market anchoring, etc.)

**Tree state:** Trees mention some cross-path interactions but not systematically:
- Trees note: "Clan may offer defence contracts to settlements"
- Trees note: "Hamlet attracts merchants"
- Trees note: "Military escort provides income for clan members"

**Gap:** Framework's detailed contract patterns (security, supply, logistics, knowledge) need prerequisite entries in trees

**Work item:** Add Contract System section to mercantile tree with prerequisites and enables chains

### 4. Occupation Signal Scoring (Framework Priority #1)

**Framework needs:** Occupation signal model from behavior history (frequency + success + domain)

**Tree foundation:** Skills tree provides skill levels, structures provide exposure counts, paths track role progression

**Missing mechanics:**
- Behavior frequency tracking per domain
- Success rate per activity type
- Domain affinity scoring (agriculture, woods, stones, textiles, metals, etc.)
- Role progression thresholds (novice → skilled → specialist → master)

**Work item:** Implement occupation signal scoring system in Pawn.js that consumes skill/exposure data from trees

### 5. Skill Thresholds vs Timing Targets

Trees use specific skill thresholds (e.g., `knapping ≥ 2`, `planning ≥ 3`, `bartering ≥ 3`). InventionConfig sets:
- `specialistThreshold: 40` (skill level = specialist recognition)
- `masterThreshold: 80` (skill level = master recognition)

**Potential conflict:** Tree thresholds (2-5) seem low compared to InventionConfig thresholds (40, 80)

**Resolution options:**
1. Trees use "unlock tiers" (0-10 scale), different from "skill mastery" (0-100 scale)
2. Rescale tree prerequisites to 0-100 scale
3. Keep dual systems: tier-based unlocks (0-10) for gameplay, level-based mastery (0-100) for progression

**Work item:** Clarify skill scaling model and update either trees or InventionConfig for consistency

### 6. Group Type Taxonomy

Trees define specific group types that framework doesn't explicitly list:
- `bonded_pair`, `party`, `clan`, `clan_territory`
- `proto_settlement`, `hamlet`, `village`
- `caravan`, `shop`, `corporation`

**Work item:** Add group type definitions and formation mechanics to civilization roadmap implementation plan

### 7. Prerequisite Implementation

Trees extensively use prerequisite patterns:
- Skill thresholds: `knapping ≥ 2`
- Item exposure: `rock ≥ 3, stick ≥ 2`
- Structure exposure: `school ≥ 1`
- Mutual bonds: `bond > 20 between 2+ pawns`
- Location: `near WaterSource`, `proximity to market`

**Current implementation:** Pawn.js has resource memory, skill tracking, inventory, but no formal prerequisite evaluation system

**Work item:** Implement prerequisite evaluation system that can check trees' unlock conditions

## Alignment Actions

### Documentation Updates

1. **Add trees reference to occupation framework:**
   - Link to trees/ directory from framework
   - Note that trees provide detailed unlock chains while framework provides timing targets

2. **Add timing context to trees README:**
   - Reference framework pacing targets
   - Map Stage 1/2/3 to days/weeks/months timeline

3. **Expand teaching skill entries in trees:**
   - Add Observational Teaching (Tribe)
   - Add Formal Schooling (Town)
   - Add Apprenticeship (Trader)

4. **Add Contract System section to mercantile tree:**
   - Security contracts (prerequisites, group types, enables)
   - Supply contracts
   - Logistics contracts
   - Knowledge/information contracts

### Implementation Work Items

Priority order based on framework's "Near-Term Implementation Priorities":

1. **Occupation Signal Scoring** (1-2 days implementation)
   - Track behavior frequency by domain (agriculture, woods, stones, textiles, metals, hunting, construction)
   - Track success/fail rates per activity type
   - Calculate domain affinity scores
   - Detect role progression thresholds (novice → skilled → specialist → master)

2. **Prerequisite Evaluation System** (2-3 days implementation)
   - Parse prerequisite patterns from tree entries
   - Check skill thresholds, exposure counts, proximity conditions
   - Support OR/AND logic for alternative paths
   - Trigger unlock events when prerequisites met

3. **Group Formation Mechanics** (3-4 days implementation)
   - Track mutual bond scores between pawns
   - Detect group formation thresholds (bonded_pair, party, clan, proto_settlement)
   - Assign group types and coordinator roles
   - Implement group-level goals and reputation

4. **Contract Primitives** (3-5 days implementation)
   - Define contract types (supply, escort, delivery, apprenticeship, security)
   - Track contract state (offered, accepted, in-progress, completed, failed)
   - Calculate reputation impacts
   - Enable cross-triad contracting (tribe security for town goods, etc.)

5. **Teaching Variant Mechanics** (2-3 days implementation)
   - Observational learning: passive skill gain from proximity during expert work
   - Formal schooling: school structure enables structured lessons
   - Apprenticeship contracts: master-novice pairing with skill guarantees

6. **Market-Aware Goal Weighting** (2-3 days implementation)
   - Track local supply/demand by item type
   - Weight gathering/crafting goals by (specialization × demand × scarcity)
   - Price discovery from barter events
   - Shop/market structure integration

### Skill Scaling Resolution (needs decision)

**Option A:** Dual-scale system (recommended)
- **Unlock tiers** (0-10): Used in trees for feature gating (knapping ≥ 2 unlocks stone knife)
- **Skill mastery** (0-100): Used for quality/speed bonuses, specialist/master identity

**Option B:** Single scale (0-100)
- Rescale all tree prerequisites × 10 (knapping ≥ 2 becomes knapping ≥ 20)
- Adjust skill gain rates in InventionConfig to hit timing targets

**Option C:** Single scale (0-10)
- Rescale InventionConfig thresholds ÷ 10 (specialist = 4, master = 8)
- Risks insufficient granularity for quality variance

**Recommendation:** Option A (dual-scale). Tiers gate features, mastery affects outcomes.

## Future Considerations

### From Trees Not Yet in Framework

1. **Back-pressure mechanics:** Trees extensively document how later discoveries make earlier ones easier to recognize
2. **Alternate material paths:** Same functional goal (shelter) via multiple material routes (woven, clay, timber, brick)
3. **Structure degradation:** Maintenance costs and upgrade pressure
4. **Cross-path pollination:** How tribal pawns can shift civic, etc.
5. **Currency genesis threshold:** Specific conditions for money emergence (Village + high trade volume)
6. **Law tokens and governance models:** Progression from consensus → appointed → elective

### From Framework Not Yet in Trees

1. **Skill expression variants:** Same skill (teaching, crafting, assessment) with different context-dependent behaviors
2. **Multi-triad dynamics:** Industrial scaling, security economies, knowledge circulation
3. **Indirect control model:** Player sets priorities/goals, pawns execute autonomously
4. **Progression feel guidance:** "Brisk but not grindy", "stone age skills come easily"

## Summary

The framework and trees are **complementary and compatible**:
- **Framework:** High-level design principles, timing targets, gameplay feel, cross-triad interactions
- **Trees:** Detailed prerequisite chains, specific unlocks, alternative paths, granular progression

**No conflicts found**, only gaps to fill:
1. Trees need contract system details
2. Trees need teaching variant mechanics
3. Framework needs group type taxonomy reference
4. Both need skill scaling clarification
5. Implementation needs occupation scoring and prerequisite evaluation systems

**Next session priorities:**
1. Resolve skill scaling model (recommend dual-scale)
2. Implement occupation signal scoring
3. Add contract system to mercantile tree
4. Begin prerequisite evaluation system
