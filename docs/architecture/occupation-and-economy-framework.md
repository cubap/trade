# Occupation and Economy Framework

This document formalizes recurring concepts from early Trade notes into implementation priorities.

## Core Brand Triad

Trade development should center on three interacting pillars:

- **Tribe**: survival, shared labor, defense, kin-style coordination
- **Town**: structures, governance, specialization, persistent production
- **Traders**: mobility, arbitrage, logistics, contracts, market expansion

Each group develops distinct skill expressions and economic patterns, but they depend on cross-triad interactions to thrive.

## Progression and Pacing

Pawn and civilization development should feel emergent but avoid excessive grind.

### Individual Pawn Timelines

- **Starting State**: Primitive but capable - basic stone age skills (gathering, simple tools, fire, shelter) come easily
- **Childhood → Adulthood**: ~7 days of simulation time
- **Professional Lock-in**: ~20 days - primary occupation becomes evident through behavior patterns
- **Skill Mastery**: Continuous but with diminishing returns - experts still discover nuances after months

### Group and Settlement Timelines

- **Early Groups**: Tribes form naturally within first few weeks from social bonds and shared work
- **Proto-Towns**: Structure clustering and communal storage emerge within 1-2 months for organized groups
- **Mid-Game Tech**: 4-5 months for well-resourced groups (iron tools, advanced crafting, formal markets)
- **Preindustrial City**: ~1 year of simulation - full specialization, governance, trade networks, guild systems

### Technology Brackets

Similar to Minecraft/Vintage Story progression, but grounded in realistic materials:

1. **Stone Age** (Days 1-14): Wood, stone, fiber, basic shelter, fire, primitive tools
2. **Early Metal** (Weeks 3-8): Copper tools, better crafting, structures, early specialization
3. **Iron Age** (Months 3-5): Iron smelting, workshops, formal settlements, contracts
4. **Advanced Craft** (Months 6-12): Specialized tools, trade networks, civic institutions, banking

No magical lore or fantasy elements - all progression emerges from practical material and social development.

### Gameplay Feel

Players set goals and priorities rather than controlling individual actions:

- **Indirect Control**: Adjust pawn goal priorities, resource valuations, and group contracts
- **Emergent Specialization**: Occupations develop from repeated behavior, not class selection
- **Autonomous Execution**: Pawns handle pathfinding, crafting steps, social interactions independently
- **Strategic Planning**: Players focus on settlement layout, trade routes, group formation, tech priorities

Similar to One Hour One Life's emergent progression, but without real-time urgency or direct player embodiment.

## Pawn Occupation Development

Pawn progression should emerge from repeated behavior, not class selection.

- **Exposure-driven identity**: gathering, crafting, hauling, building, teaching, trading
- **Domain transfer**: familiarity in one material class improves comprehension of adjacent items in that class
- **Use discernment**: materials should be judged differently by intended use (tool, weapon, construction, medicine, etc.)
- **Apprenticeship effects**: observing experts should accelerate novice specialization
- **Reputation carryover**: reliability and delivery quality should influence future contracts and roles

## Skill Distribution Across the Triad

Skills naturally cluster within tribes, towns, or traders, but some appear in all three with different expressions.

### Tribe-Dominant Skills

- Hunting & Foraging (survival focus)
- Basic Crafting (tools, weapons, shelter)
- Defense & Scouting (security, threat detection)
- Kin Teaching (shared knowledge, oral tradition)

### Town-Dominant Skills

- Advanced Crafting (workshops, specialized tools)
- Construction & Architecture (permanent structures)
- Formal Schooling (structured curriculum, literacy)
- Market Operation (shop stocking, pricing, banking)

### Trader-Dominant Skills

- Logistics & Route Planning (caravans, multi-stop optimization)
- Appraisal & Valuation (quality assessment, arbitrage)
- Contract Negotiation (terms, guarantees, delivery)
- Apprenticeship Brokering (placing novices with experts for fees)

### Universal Skills with Context-Dependent Expression

- **Teaching**:
  - Tribe: Elder sharing survival stories, demonstrating techniques in the field
  - Town: School instructor with formal lessons, graded progression
  - Trader: Apprenticeship master providing hands-on mentorship under contract
- **Crafting Quality**:
  - Tribe: Immediate usability and durability for survival
  - Town: Trade-grade output with consistent standards for market sale
  - Trader: Portable, high-value goods for arbitrage (compactness, durability, scarcity)
- **Resource Assessment**:
  - Tribe: Nutritional value, threat level, immediate utility
  - Town: Processing suitability, workshop compatibility, local demand
  - Trader: Market delta (buy low elsewhere, sell high here), transport cost ratio

## Economic and Logistics Priorities

- Supply chains as first-class systems (source -> process -> transport -> destination)
- Shop and stall behavior with stock constraints and replenishment loops
- Dynamic value from scarcity, demand, and practical suitability
- Inventory and transport limits that make logistics a strategic choice
- Local surplus/deficit signals that drive trade routes and occupation drift

## Cross-Triad Interaction Patterns

Groups develop interdependencies that drive economic specialization and cooperation.

### Tribe ↔ Town

- **Security-for-Goods Contracts**: Tribes patrol trade routes and defend town perimeters in exchange for tool access, medicine, or food surplus
- **Raw Material Supply**: Tribes gather bulk resources (wood, stone, fibers, game) and sell to town workshops at volume discounts
- **Apprentice Placement**: Tribes send youth to town schools for structured training, returning with new skills

### Town ↔ Traders

- **Market Anchoring**: Traders use town markets as stable hubs for buying/selling, pay stall fees or shop rents
- **Banking & Credit**: Towns provide secure storage and extend credit to traders for caravan purchases
- **Skilled Labor Recruitment**: Traders hire craftspeople from towns for contract work or caravan production

### Tribe ↔ Traders

- **Rare Resource Brokering**: Tribes discover unique materials (exotic woods, medicinal plants, ore veins) and sell to traders for premium prices
- **Logistics Outsourcing**: Tribes hire traders for long-distance deliveries or inter-tribe gift exchanges
- **Story and Knowledge Trade**: Tribes provide local knowledge (terrain, weather, threats) to traders in exchange for distant news and discoveries

### Multi-Triad Dynamics

- **Industrial Scaling**: Towns that access cheap raw materials from tribes can produce beyond local demand, selling surplus to traders who distribute regionally
- **Security Economies**: Tribes that specialize in defense can contract with multiple towns and trader caravans, forming proto-mercenary groups
- **Knowledge Circulation**: Discoveries move from tribe field observations → town formal documentation → trader distribution to other regions

## Structure and Capability Priorities

- Structures as capability gates (workshops, storage, training, civic spaces)
- Settlement progression should unlock deeper specialization and market complexity
- Town-level organization should reduce coordination cost and improve throughput

## Near-Term Implementation Priorities

1. **Occupation signal model** from observed behavior history (frequency + success rate + domain specialization)
2. **Trade-oriented goal weighting** that uses specialization and current market needs
3. **Contract primitives** (supply, escort, delivery, apprenticeship) with reputation tracking
4. **Stock-aware market entities** (buy/sell offers + inventory pressure + replenishment triggers)
5. **Role progression events** (novice -> skilled -> specialist) with threshold detection
6. **Teaching/Apprenticeship variants**:
   - Tribe: Observational learning from elders (passive skill gain from proximity during work)
   - Town: Formal schooling (structured lessons, skill prerequisites, progression gates)
   - Trader: Contract apprenticeships (master-novice pairs, skill guarantees, fee-for-training)
7. **Cross-triad contract system**:
   - Security contracts (tribe patrols for town/trader clients)
   - Bulk supply contracts (tribe gathers raw materials for town workshops)
   - Logistics contracts (traders transport goods between tribes and towns)
   - Knowledge contracts (tribes/towns pay traders for distant news or discoveries)

## Potential Considerations (Later)

- Credit/debt mechanics and merchant financing
- Multi-shop corporations and caravan guilds
- Regional product identity and quality tiers
- Policy/law effects on commerce and town stability

## Related Documentation

- **[Knowledge Trees](../trees/)**: Detailed prerequisite chains for skills, materials, tools, structures, and the three emergent paths (tribal-military, civic-industrial, mercantile-entrepreneurial). The trees provide WHAT unlocks, this framework provides WHEN and WHY.
- **[Civilization Roadmap](../plans/civilization-roadmap.md)**: Implementation plan with MVP slice ordering and cross-branch interoperability.
- **[Invention System](../systems/invention-system.md)**: Autonomous discovery mechanics and quality systems.

## Source Notes

This framework is distilled from `docs/TradeGameNotes.pdf` (early handwritten notes). The OCR extraction is noisy, so these are normalized design themes rather than verbatim requirements.
