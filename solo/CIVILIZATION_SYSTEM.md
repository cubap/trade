# Civilization & Social Systems

This document defines emergent civilization pathways for pawns: Military/Tribal, Civil/Government, Corporate/Merchant, and Educational/Guild. Systems are modular and driven by in‑world behavior rather than scripted progression.

---
## 1. Core Social Fabric
- Proximity Cohesion: Repeated co‑location (sleep, work, forage) increases social bond score.
- Shared Task Reinforcement: Cooperative completion of a goal (hunt, build, trade caravan) adds affinity.
- Group Formation Thresholds:
  - Bonded Pair: ≥2 pawns mutual bond > 20.
  - Party: 3–5 average mutual bonds > 15.
  - Proto‑Settlement: ≥5 pawns with average local resource richness score > threshold & stay ≥3 cycles.
  - Caravan/Clan Flag: Party travels > configured distance while retaining cohesion.
- Role Emergence: Highest (leadership + planning + reputation) becomes provisional coordinator.

### Data Structures (Conceptual)
```ts
interface SocialBond { otherPawnId: string; score: number; lastInteraction: number; }
interface PawnSocialState {
  bonds: Map<string, SocialBond>;
  groupId?: string;
  preferredBranchTraits: { martial: number; civic: number; mercantile: number; scholastic: number };
  leadershipPotential: number; // derived from skills & reputation
}
interface Group {
  id: string;
  type: 'clan' | 'settlement' | 'caravan' | 'merchant_company' | 'guild';
  members: Set<string>;
  territory?: { center: {x:number,y:number}; radius: number };
  inventories: { communal: string[] };
  reputation: { martial: number; civic: number; mercantile: number; scholastic: number };
  governance?: GovernanceModel;
}
```

---
## 2. Branch: Military / Clans
**Emergence Conditions**
- High combined hunting/combat skills in a party.
- External threat events (predators, scarcity, raids) increase martial inclination.

**Core Mechanics**
- Commands: follow, flank, scout, mark target, protect, retreat, pursue.
- Tactical Memory: successful hunts/defenses raise clan cohesion & tactical confidence.
- Territory Claim: clan sets informal waypoint ring; repeated defense formalizes territory.
- Promotion: leadershipPotential trending upward + command usage frequency.

**Outputs & Interactions**
- Provides defense contracts to settlements or merchants.
- Offers escort service to caravans.
- Can conflict with other clans over resource nodes.

**Basic Needs Fulfillment**
- Food via coordinated hunts; shelter via mobile camps; security via patrol cycles.

---
## 3. Branch: Civil / Government
**Emergence Conditions**
- ≥5 structures (tents → huts → workshops) within radius with sustained occupancy.
- Aggregate stability score (low threat, steady food/water) above threshold.

**Core Mechanics**
- Infrastructure Levels: camp → hamlet → village → town.
- Governance Models: informal (consensus) → appointed → elective → weighted influence.
- Law Tokens: simple rules (curfew, storage share, tax %) stored on civic ledger.
- Civic Reputation: contributions (build, defend, supply) raise influence weight.
- Currency Genesis: ledger tracks value ratios → minted script once trade volume high.

**Outputs & Interactions**
- Attracts merchants, educators, and defensive contracts.
- Stabilizes region for advanced crafting chains.

**Basic Needs Fulfillment**
- Food via farms & storerooms; water via wells/cisterns; shelter permanent; security guard rota.

---
## 4. Branch: Corporate / Merchant
**Emergence Conditions**
- Pawn exploits price differential between two locations (recorded trades > threshold).
- Accumulated portable value (commodities, crafted goods) enabling multi‑stop exchange.

**Core Mechanics**
- Trade Route Graph: nodes (settlements) + edges (travel frequency, value spread).
- Price Discovery: observed trades build rolling average; merchants adjust margins.
- Shop Entity: inventory slots, buy/sell offers, script acceptance.
- Partnership & Protection: hires clan members (bodyguard contract) or civic guards.
- Corporation Formation: multiple shops under one ledger with pooled float.

**Outputs & Interactions**
- Supplies rare goods to civics; pays clans for security; sponsors guild research.

**Basic Needs Fulfillment**
- Purchases food/water; rents shelter; outsources security; reinvests profits.

---
## 5. Branch: Educational / Guilds
**Emergence Conditions**
- Repeated teaching actions; skill disparities + proximity; one pawn with high scholastic trait.

**Core Mechanics**
- Knowledge Catalog: recipes, techniques, maps, material properties.
- Apprenticeship Contracts: time‑bound skill transfer with learning rate modifier.
- Cross‑Domain Synergy: weaving ↔ textile ↔ tailoring; hunting ↔ tracking ↔ scouting.
- Curriculum Slots: guild schedules seminars (batch XP events).
- Publication: creation of plans/scrolls increases diffusion radius.

**Outputs & Interactions**
- Enhances productivity of civic labor, merchant specialization, and clan tactics.

**Basic Needs Fulfillment**
- Guild hall provides communal meals & lodging; funding via tuition or patronage.

---
## 6. Interoperability Matrix
| Source → Target | Clan | Settlement | Merchant | Guild |
|-----------------|------|------------|----------|-------|
| Clan | — | Defense pact | Escort caravan | Tactical training |
| Settlement | Guard hire | — | Market access | Venue & funding |
| Merchant | Sponsor gear | Trade hub | — | Commission research |
| Guild | Combat drills | Public education | Specialized tools | — |

---
## 7. Progression & Feedback Loops
- **Success Reinforcement**: Completed group goals raise branch affinity → increases probability of selecting similar future goals.
- **Resource Anchoring**: High local resource richness raises settlement formation probability.
- **Value Arbitrage**: Large price spread raises merchant expansion chance.
- **Threat Pressure**: Predator/raid frequency increases clan cohesion & recruitment.
- **Knowledge Diffusion**: Guild publications lower invention difficulty for related crafts.

---
## 8. Metrics & Scores
- MartialScore, CivicScore, MercantileScore, ScholasticScore per pawn/group.
- StabilityIndex (threat, supply regularity, shelter quality).
- TradeValueFlow (sum of arbitrage margins per cycle).
- LearningVelocity (XP gained in assisted sessions / time).

---
## 9. AI Goal Selection Heuristics
1. Compute branch inclination vector from recent successes (exponential decay memory).
2. Apply local context modifiers (threat, richness, price spread, knowledge density).
3. Weight available macro-goals (hunt, build, trade, teach) accordingly.
4. Inject user overrides (priority reorder) with soft bias rather than hard lock.

---
## 10. User Influence Surface
- Adjust resource values → shifts merchant & settlement viability.
- Inject high-priority goals (e.g. defend, construct) → temporary boost to branch score.
- Reorder goal queue → soft penalty to abandoned goals, preserving autonomy.

---
## 11. Persistence & Evolution
- Groups persist if stability & cohesion above decay floor.
- Abandoned settlements degrade; clans dissolve if cohesion < threshold.
- Corporations split if profit flow stagnates; guilds fade without curriculum activity.

---
## 12. Minimal Implementation Slices
1. Bond tracking + simple group creation.
2. Clan hunting party with follow/protect commands.
3. Settlement detection (structure clustering) + communal storage.
4. Basic trade offers & price averaging.
5. Teaching action that transfers % of skill XP.
6. Branch inclination influencing goal selection.

---
## 13. Extension Hooks
- Law system: governance model yields rule evaluation events.
- Currency minting: convert civic ledger value index → token issuance.
- Story events: hero tale raises martial & scholastic temporary modifiers.
- Reputation layers: branch-specific reputation influencing contracts.

---
## 14. Data Retention & Efficiency
- Use rolling windows (last N events) rather than full history for scores.
- Normalize frequency counters per time slice to avoid unbounded growth.
- Decay factors applied once per major tick (e.g. every 200 cycles).

---
## 15. Risk & Balancing Considerations
- Over-dominant branch: introduce diminishing returns on repeated similar macro-goals.
- Runaway merchant wealth: maintenance cost scaling for shops/caravans.
- Clan aggression spiral: diplomacy events & resource trade softening hostility.
- Guild monopoly: knowledge diffusion lowers exclusivity over time.

---
## 16. Testing Strategy
- Unit: bond formation thresholds, inclination vector math.
- Simulation: spawn mixed-skill pawns, observe branch distribution stability.
- Load: ensure event aggregation O(k) per tick (k small) using capped arrays/queues.
- Player intervention: reorder goals, verify autonomous recovery.

---
## 17. Next Steps
See `CIVILIZATION_PUNCHLIST.md` for actionable items.
