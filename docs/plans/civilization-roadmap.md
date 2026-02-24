# Civilization and Social Systems Roadmap

## Objective

Enable emergent multi-branch civilization behavior across clan, civic, merchant, and guild pathways.

Brand framing should keep the Tribe/Town/Traders triad explicit:

- Tribe aligns to survival and social-cohesion gameplay loops
- Town aligns to structure, governance, and specialization loops
- Traders align to mobility, logistics, and market loops

## Branch Model

- **Military/Clan**: defense, escort, territory pressure response
- **Civil/Government**: settlement formation, governance, civic stability
- **Corporate/Merchant**: route economics, trade entities, contracts
- **Educational/Guild**: teaching loops, apprenticeships, knowledge diffusion

## Foundations (Phase 0)

- Social bond tracking with decay
- Group formation thresholds and lightweight group persistence
- Branch inclination vectors per pawn
- Macro-goal selection bias from inclination and local context

## Implementation Phases

### Phase 1: Military/Clan (Tribe Focus)

- Party commands (follow/protect/scout/mark)
- Coordinated hunt and escort behavior
- Territory and tactical memory loops
- **Security contract primitives**: patrol routes, defense assignments

### Phase 2: Civil/Government (Town Focus)

- Structure clustering to detect proto-settlements
- Communal storage and simple job board behavior
- Early governance tokens and civic reputation scoring
- **Formal schooling**: structured lessons with prerequisites and progression

### Phase 3: Corporate/Merchant (Trader Focus)

- Trade offer model and rolling price averages
- Shop entity behavior and route planning
- Security hiring contracts
- **Logistics contracts**: multi-stop deliveries, arbitrage optimization

### Phase 4: Educational/Guild (Cross-Triad)

- Teaching action with diminishing-return transfer
- Guild formation and curriculum events
- Publication artifacts that improve nearby invention outcomes
- **Apprenticeship variants**: tribe observation, town school, trader contract mentorship

## Cross-Branch Interoperability

- **Contract types**: escort, defense, supply, research, apprenticeship
- **Inter-group reputation** affecting contract rates and priority
- **Event hooks**: raids, markets, festivals, disasters
- **User influence** via priorities, injected goals, and resource valuation
- **Apprenticeship and observation effects** should accelerate occupation specialization
- **Supply-chain pressure** should dynamically shift role demand over time

### Cross-Triad Contract Patterns (Priority Implementation)

- **Tribe → Town Security**: Tribes patrol routes and defend settlements for tool/medicine/food access
- **Tribe → Town Supply**: Tribes deliver bulk raw materials to town workshops at volume rates
- **Town → Trader Services**: Towns provide market, banking, and storage services for fees
- **Trader → Tribe/Town Logistics**: Traders handle long-distance transport and arbitrage
- **All → Knowledge Circulation**: Discoveries flow from tribe observations → town documentation → trader distribution

These interactions enable specialization economies: tribes focus on security/gathering, towns on production/governance, traders on logistics/arbitrage.

## Metrics and Performance

- Stability index, trade value flow, learning velocity
- Capped rolling windows for event aggregation
- Periodic decay passes for scores and cohesion

## Progression Timeline Targets

Based on emergent gameplay feel (similar to One Hour One Life) with indirect control:

- **Days 1-7**: Individual pawns reach basic competence in stone age skills (gathering, tools, shelter)
- **Days 7-20**: Professional specialization becomes evident through repeated behavior patterns
- **Weeks 3-8**: Organized tribes form, early metal (copper) becomes accessible
- **Months 3-5**: Mid-game tech unlocked for well-resourced groups (iron, workshops, contracts)
- **Months 6-12**: Full preindustrial city complexity (specialized trades, markets, civic systems)

Stone age skills should come easily. Progression should feel brisk but earned, not grindy.

## MVP Slice Order (with expected timeline context)

1. **Bonds and pair/party formation** - Days 1-3: Natural social clustering from proximity and shared work
2. **Clan hunting with follow/protect** - Days 3-7: Coordinated gathering and defense emerge
3. **Settlement detection and communal storage** - Weeks 2-4: Structure clustering creates proto-towns
4. **Basic trading and local price averaging** - Weeks 4-8: Value discovery through barter and surplus
5. **Teaching action with guild seeding** - Months 2-3: Formal knowledge transfer and specialization groups
6. **Inclination-weighted macro-goal selection** - Ongoing: Pawns bias behavior toward tribe/town/trader identity
