# Memory System Roadmap

## Goal

Advance pawn resource memory from simple location recall to adaptive, reliable decision support.

## Current Baseline

- Pawns remember discovered resources by type and location
- Memory size is capped
- Recency and confidence influence recall quality
- Basic stale/invalid memory cleanup is in place

## Remaining Work

### Phase 2: Memory Clustering

- Merge nearby same-type sightings into cluster memories
- Track cluster density/count for better gathering expectations
- Reduce redundant entries and lookup overhead
- Consider letting this develop as a skill after wandering for a time and finding only similar resources in an area, to give a natural learning curve and specialization path
- If following someone else who already has a cluster memory for a resource, they can share that memory and get a boost to confidence, which can help spread knowledge of good resource locations through social interactions without explicit teaching actions.

Current implementation notes:

- Added learnable `memoryClustering` skill progression through repeated nearby sightings and successful cluster merges
- Added `clusterCount` and memory `source` metadata on resource memories
- Added social memory transfer APIs (`shareResourceMemory`, `learnResourceLocation`) with confidence blending

### Phase 3: Multi-Resource Route Planning

- Build route plans for recipes requiring multiple resource types
- Select memory targets in travel-efficient order
- Feed route ordering into gather subgoal generation

Current implementation notes:

- Added learnable `routePlanning` skill progression through route creation and social exchange
- Added `planGatheringRoute(requirements)` and integrated it into goal decomposition for craft prerequisites
- Added explicit observed-success/failure weighting in route stop scoring so experienced pawns prefer proven nodes over merely close ones

### Phase 4: Knowledge Sharing

- Share high-confidence memories during social interactions
- Distinguish self-discovered versus learned memories
- Add confidence blending and corroboration behavior

Current implementation notes:

- Added revisit-based confidence decay that penalizes repeated failed returns more strongly
- Added witnessed gathering outcome weighting (`observeGatheringOutcome`) so nearby pawn successes/failures adjust memory confidence
- Added broadcast propagation of gather outcomes to nearby pawns to reinforce practical learning-by-observation
- Added broad class-level resource specialization so repeated encounters improve comprehension for similar material families
- Added intent-aware wood/stick discernment so practical suitability (tool, weapon, construction) can increase valuation

Potential considerations:

- Add seasonal and biome-specific memory weighting for agriculture-focused pawns
- Add explicit market demand memory so specialization affects trade strategy and profession drift
- Add mentorship bonuses when novices witness expert classification and valuation decisions

## Optional Extensions

- Danger memory and avoidance zones
- Seasonal respawn expectations
- Territory-aware memory weighting
- Map artifact generation and knowledge trading

## Suggested Validation

- Unit tests for clustering and confidence updates
- Simulation checks for route efficiency improvements
- Multi-pawn tests for memory-sharing diffusion
