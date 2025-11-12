# Civilization Systems Punchlist

This checklist tracks actionable tasks to implement emergent Military/Clan, Civil/Government, Corporate/Merchant, and Educational/Guild systems.

## Phase 0: Foundations

- [ ] Social bond tracking (per pawn → other pawn, decay over time)
- [ ] Proximity/cooperation events increase bond score
- [ ] Group formation thresholds (pair, party, proto‑settlement, caravan)
- [ ] Group data model and minimal persistence (id, type, members, inventories)
- [ ] Branch inclination vector per pawn (martial, civic, mercantile, scholastic)
- [ ] Heuristics to bias macro‑goal selection by inclination and local context

## Phase 1: Military / Clans

- [ ] Party commands: follow, protect, scout, mark target
- [ ] Hunting party coordination (role: hunter, scout, carrier)
- [ ] Simple territory claim (waypoint ring) and patrol loop
- [ ] Tactical memory: success raises cohesion and confidence
- [ ] Escort contract: accept/fulfill escort for merchants

## Phase 2: Civil / Government

- [ ] Structure clustering → detect proto‑settlement
- [ ] Communal storage and job board entity
- [ ] Governance seed: informal consensus (simple rule tokens)
- [ ] Civic reputation from contributions (build, defend, supply)
- [ ] Settlement growth tiers: camp → hamlet → village (thresholds + buffs)

## Phase 3: Corporate / Merchant

- [ ] Trade offer model (buy/sell, quantity, price or ratio)
- [ ] Price averaging by location (rolling window per commodity)
- [ ] Shop entity (inventory, offers, script acceptance)
- [ ] Merchant route planner (value spread × travel cost)
- [ ] Bodyguard contract (hire clan member / party)

## Phase 4: Educational / Guilds

- [ ] Teaching action: transfer % XP with diminishing returns
- [ ] Guild formation when repeated teaching with membership
- [ ] Curriculum schedule (batch XP events to members)
- [ ] Publication (plans/scrolls) that reduce invention difficulty in radius
- [ ] Apprenticeship contract (time‑bound, progress tracking)

## Interoperability

- [ ] Contract system: escort, defense pact, supply agreement, research commission
- [ ] Inter‑group reputation (per branch) influencing contract rates
- [ ] Event hooks: raids, festivals, markets, disasters
- [ ] Player influence: reorder priorities, inject goals, tweak resource values

## Balancing & Metrics

- [ ] Success reinforcement with diminishing returns
- [ ] Stability index (threat, supply, shelter quality)
- [ ] Trade value flow metric and profit tracking
- [ ] Learning velocity metric for education impact

## Performance & Persistence

- [ ] Rolling windows for event aggregation (cap memory)
- [ ] Periodic decay passes (e.g., every 200 ticks)
- [ ] Save/load for groups, contracts, and civic ledgers

## Minimal Implementation Slices (Order of Execution)

1. [ ] Bonds + pair/party formation
2. [ ] Clan hunting party with follow/protect
3. [ ] Settlement detection + communal storage
4. [ ] Basic trade offers + local price average
5. [ ] Teaching action + simple guild seed
6. [ ] Inclination‑weighted macro‑goal selection
