# Civic / Industrial Path

The civic-industrial path emerges when pawns establish stable settlements, organise communal labour, and progressively build more sophisticated production infrastructure. It is one of three roughly equal emergent trajectories; the others are [Tribal / Military](tribal-military.md) and [Mercantile / Entrepreneurial](mercantile-entrepreneurial.md).

**Typical emergence conditions:** rich local resources enabling sedentary life, moderate group size, and early luck with construction or planning skills.

---

## Stage 1 — Encampment

Multiple pawns occupy a shared area and begin to coordinate survival.

### Proto-Settlement 🔮
> At least 3–5 pawns maintaining co-location with a shared structure.

- **Prerequisites (any one path):**
  - ≥ 3 pawns with average mutual bond > 10 AND ≥ 1 shelter structure within radius
  - OR ≥ 5 pawns staying ≥ 3 cycles in the same location with moderate resource richness
  - Cross-path: [Tribal › Territory Claim](tribal-military.md#territory-claim) stabilises an area for settlement
- **Group type:** `proto_settlement`
- **Enables:**
  - Communal storage threshold check (triggers [Storage Pit](structures.md#storage-pit))
  - [Civic Score](#civic-score) tracking begins
  - Back-pressures planning, construction, and specialisation

---

### Communal Storage 🔮
> A shared inventory accessible to all group members.

- **Prerequisites:**
  - Proto-settlement established AND [Structures › Storage Pit](structures.md#storage-pit) built
- **Enables:**
  - Food and material sharing without direct hand-off
  - Surplus accumulation enabling specialisation
  - Required for [Hamlet](#hamlet) classification

---

## Stage 2 — Hamlet

A named place with dedicated production and at least basic infrastructure.

### Hamlet 🔮
> A small permanent settlement with storage and at least 2 specialised structures.

- **Prerequisites:**
  - ≥ 5 pawns with sustained co-location AND communal storage AND stability score above threshold
  - At least 2 distinct structure types built (e.g. shelter + storage)
- **Enables:**
  - Role emergence: highest `(leadership + planning)` pawn becomes provisional coordinator
  - [Governance](#governance) seed
  - Attracts wandering pawns (population growth)
  - Cross-path: Attracts merchants from [Mercantile](mercantile-entrepreneurial.md) path

---

### Organised Labour 🔮
> Coordinator assigns tasks; pawns follow a shared work schedule.

- **Prerequisites:**
  - `planning ≥ 2` AND hamlet established AND coordinator role filled
- **Enables:**
  - Production bonuses when goal types are coordinated
  - Infrastructure construction speed increased
  - Required for [Workshop](structures.md#workshop) and [Well](structures.md#well)

---

## Stage 3 — Village

A self-sufficient community with water supply, workshops, and basic governance.

### Village 🔮
> A settlement with well, granary, workshop, and governance structure.

- **Prerequisites:**
  - Hamlet established AND [Well](structures.md#well) AND [Granary](structures.md#granary) AND [Workshop](structures.md#workshop) built
  - `planning ≥ 3` AND group size ≥ 8
- **Enables:**
  - Formal governance ([Law Tokens](#law-tokens))
  - Artisan specialisation (dedicated crafting pawns)
  - Cross-path: [Market](structures.md#market) construction attracting merchants
  - [Currency Genesis](#currency) threshold possible

---

### Governance 🔮
> A set of rules and roles that coordinate the settlement's activities.

- **Prerequisites (any one path):**
  - `leadership ≥ 3` AND `planning ≥ 2` AND village established
  - OR coordinator resolves ≥ 3 resource disputes between group members
- **Models (progressively unlocked):**
  - Informal (consensus) → Appointed → Elective → Weighted influence
- **Enables:**
  - [Law Tokens](#law-tokens)
  - [Civic Reputation](#civic-reputation) system
  - Long-term stability of large groups
  - Cross-path: governance legitimizes [Mercantile › Corporation](mercantile-entrepreneurial.md#corporation) charters

---

### Law Tokens 🔮
> Simple rules stored on the civic ledger: curfew, storage share, tax rate.

- **Prerequisites:**
  - Governance model established AND `planning ≥ 3`
- **Enables:**
  - Formalized resource redistribution
  - Tax collection enabling civic projects
  - Cross-path: Tax revenue can fund [Military Defense Contracts](tribal-military.md#martial-hierarchy)

---

### Civic Reputation 🔮
> A pawn's standing in the settlement based on contributions (building, supplying, defending).

- **Prerequisites:**
  - Governance established AND pawn performs civic contributions
- **Enables:**
  - Influence weight in elective/weighted governance
  - Access to better communal resources
  - Required for senior roles in any governance model

---

## Stage 4 — Town

A large, specialized settlement with multiple production chains and inter-settlement trade.

### Town 🔮
> A settlement with formal boundary, multiple workshops, and market.

- **Prerequisites:**
  - Village established AND [Stone Wall](structures.md#stone-wall) AND [Market](structures.md#market) AND group size ≥ 15
  - At least 3 distinct craft specializations present among pawns
- **Enables:**
  - Currency issuance ([Currency Genesis](#currency))
  - Cross-path: attracts Mercantile corporations
  - Cross-path: military defense contracts formalized as civic guard
  - [Educational Guild](#educational-guild)

---

### Currency 🔮
> A token of value that replaces direct barter in high-volume trade.

- **Prerequisites (any one path):**
  - `planning ≥ 4` AND civic ledger trade volume above threshold
  - OR `valuation ≥ 5` AND `bartering ≥ 5` AND governance model in place
  - Cross-path: Mercantile corporations may propose currency to speed settlement trade
- **Enables:**
  - Deferred payment (credit)
  - Long-distance trade without transporting bulk goods
  - Required for [Mercantile › Corporation](mercantile-entrepreneurial.md#corporation)

---

### Defence Contract 🔮
> Formal arrangement for a military group to guard a settlement in exchange for resources.

- **Prerequisites:**
  - Civic governance established AND [Tribal › Clan Formation](tribal-military.md#clan-formation) in range
  - OR `leadership ≥ 3` AND pawn negotiates with clan coordinator
- **Enables:**
  - Civic security without pawn combat specialization
  - Clan receives food and materials (demand for civic production)
  - Mutual prosperity incentive between military and civic paths

---

## Stage 5 — Industrial

### Industrial Production Chain 🔮
> Multiple workshops linked in sequence, each refining materials for the next.

- **Prerequisites:**
  - Town established AND [Forge](structures.md#forge) AND [Kiln](structures.md#kiln) AND `metallurgy ≥ 3`
  - At least 4 dedicated artisan pawns
- **Enables:**
  - Metal tools at scale
  - Bulk construction materials (fired brick, dressed stone)
  - Cross-path: Industrial output feeds [Mercantile › Trade Goods](mercantile-entrepreneurial.md#trade-goods)

---

### Educational Guild 🔮
> Organised institution for curriculum-based skill transfer.

- **Prerequisites:**
  - [Structures › School](structures.md#school) built AND `planning ≥ 3` AND teacher with skill ≥ 8 in any domain
  - OR `storytelling ≥ 5` AND group size ≥ 5 AND pawn convenes regular teaching sessions
- **Enables:**
  - Curriculum-scheduled teaching events (batch XP grants)
  - Apprenticeship contracts
  - Knowledge diffusion radius extended
  - Cross-path: Guild trains fighters for [Military](tribal-military.md#warrior-specialisation) and specialists for [Mercantile](mercantile-entrepreneurial.md#specialised-goods-trade)

---

### Healer 🔮
> A pawn dedicated to treating injuries and illness across the settlement.

- **Prerequisites:**
  - `medicine ≥ 3` AND `herbalism ≥ 3` AND civic role assigned
- **Enables:**
  - Group mortality reduction
  - Poultice supply chain (civic demand for herbs)
  - Cross-path: healer knowledge can be traded as guild expertise

---

## Civic Score

The settlement's civic score aggregates:
- Structure count and variety
- Governance model sophistication
- Stability index (threat, supply regularity, shelter quality)
- Law token compliance rate

A high civic score makes the settlement attractive to merchants and wandering pawns, creating a positive feedback loop.

---

## Cross-Path Interactions

| Civic development | Interacts with |
|------------------|---------------|
| Proto-settlement | [Military: territory stabilisation](tribal-military.md#territory-claim) |
| Market | [Mercantile: price discovery](mercantile-entrepreneurial.md#price-discovery) |
| Currency | [Mercantile: corporation](mercantile-entrepreneurial.md#corporation) |
| Defence contract | [Military: clan income](tribal-military.md#martial-hierarchy) |
| Educational guild | [Military: combat training](tribal-military.md#warrior-specialisation) |
| Industrial chain | [Mercantile: bulk goods supply](mercantile-entrepreneurial.md#trade-goods) |

---

## Back-Pressure Examples

- A pawn who built a lean-to and later encounters clay near the river may recognise an opportunity for a more durable mud hut — construction knowledge back-pressures material discovery.
- A settlement that grows large enough to strain food supply will back-pressure farming and granary construction.
- Repeated conflict with a neighbouring clan motivates wall construction, feeding the masonry skill chain.
