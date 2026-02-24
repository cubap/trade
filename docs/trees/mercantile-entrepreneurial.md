# Mercantile / Entrepreneurial Path

The mercantile-entrepreneurial path emerges when pawns exploit resource or price differentials between locations, accumulate portable value, and build trade networks. It is one of three roughly equal emergent trajectories; the others are [Tribal / Military](tribal-military.md) and [Civic / Industrial](civic-industrial.md).

**Typical emergence conditions:** geographic resource variation, early surplus from crafting, proximity to another settlement, or luck with cooperation and valuation skills.

---

## Stage 1 — Surplus and Exchange

### Surplus Accumulation 🔮
> A pawn has more of a resource than they personally need and recognises the excess.

- **Prerequisites (any one path):**
  - Inventory contains ≥ 5 of any single item type beyond immediate need
  - OR `crafting ≥ 5` AND multiple successful crafts of the same recipe
  - OR pawn's `accumulate_valuables` goal fires and succeeds
- **Enables:**
  - Motivation for [Bartering](#first-barter)
  - Crafted-item quality tracking (high-quality items flagged as trade goods)
  - Back-pressures [Skills › Valuation](skills.md#valuation) awareness

---

### First Barter 🔮
> A pawn offers one item in exchange for another with a different pawn.

- **Prerequisites (any one path):**
  - `cooperation ≥ 3` AND surplus accumulation AND proximity to another pawn with a different surplus
  - OR one pawn with `bartering ≥ 1` initiates an exchange
- **Enables:**
  - `bartering` skill gain for both parties
  - Price observation recorded (first data point for price discovery)
  - Back-pressures awareness of what others value

---

## Stage 2 — Trade Routes

### Price Discovery 🔮
> Observing multiple trades to understand relative item values.

- **Prerequisites:**
  - Pawn has completed ≥ 3 distinct trades
  - OR proximity to [Structures › Market](structures.md#market) during exchange
- **Enables:**
  - Rolling average price stored per item type
  - Merchant adjusts margins automatically
  - Triggers [Arbitrage](#arbitrage) awareness when price differential observed
  - Required for [Shop](#shop)

---

### Arbitrage 🔮
> Recognising that an item is valued more highly in one location than another.

- **Prerequisites:**
  - `valuation ≥ 2` AND price observations from ≥ 2 distinct locations
  - OR `bartering ≥ 3` AND pawn has travelled between two resource-distinct areas
- **Enables:**
  - Motivates caravan formation to exploit differentials
  - [Trade Route Graph](#trade-route-graph)
  - Back-pressures [Skills › Cartography](skills.md#cartography) (knowing the path matters)

---

### Trade Routes 🔮
> A regularly travelled path between nodes where goods are exchanged.

- **Prerequisites:**
  - Arbitrage identified AND pawn has made ≥ 2 round trips between locations
  - OR group of ≥ 2 merchants agrees on a route (caravan formation)
- **Graph structure:** nodes (settlements) + edges (travel frequency, value spread)
- **Enables:**
  - Predictable supply/demand flows
  - Route safety matters: motivates hiring [Military › escort](tribal-military.md#martial-hierarchy)
  - [Caravan](#caravan) formation
  - Cross-path: [Civic › Hamlet](civic-industrial.md#hamlet) nodes on a route grow faster

---

### Trade Route Graph 🔮
> An internal model of settlement nodes and their comparative advantages.

- **Prerequisites:**
  - `cartography ≥ 1` AND ≥ 2 trade routes established
- **Enables:**
  - Multi-stop trade planning (visit A → B → C → A)
  - Identification of missing links (new routes become goals)
  - Caravan routing optimisation

---

## Stage 3 — Enterprise

### Caravan 🔮
> A party travelling together to transport and trade goods across distance.

- **Prerequisites (any one path):**
  - `bartering ≥ 3` AND `cooperation ≥ 3` AND ≥ 2 pawns with surplus goods agreeing to travel
  - OR merchant pawn recruits a guard (military path pawn) for a journey
- **Group type:** `caravan`
- **Enables:**
  - Bulk goods transport
  - Demand-supply equalisation between distant settlements
  - Cross-path: military escort provides income for clan members
  - Establishes informal market nodes wherever caravan stops repeatedly

---

### Shop 🔮
> A fixed location with standing buy/sell offers.

- **Prerequisites:**
  - `bartering ≥ 3` AND `valuation ≥ 2` AND price discovery established
  - AND [Structures › Workshop](structures.md#workshop) or [Market](structures.md#market) nearby
- **Inventory:** Buy/sell slots with configurable offer prices
- **Enables:**
  - Permanent trading presence without caravan travel
  - Civic settlement benefit (attracts goods and pawns)
  - Required for [Corporation](#corporation)

---

### Trade Goods 🔮
> Items crafted or gathered specifically for sale rather than personal use.

- **Prerequisites:**
  - Pawn's `accumulate_valuables` goal produces item with quality > 1.2
  - OR `valuation ≥ 3` AND craft output flagged as trade good
- **Categories:**
  - **Basic:** cordage, stone knives, baskets, poultices
  - **Craft:** cloth, ceramics, worked bone items
  - **Luxury:** high-quality weapons, rare dyes, alchemical compounds
  - **Bulk:** food, fiber, timber, fired brick
- **Enables:**
  - Demand signal back-pressures production specialisation
  - Price differentials between categories drive route selection

---

### Specialised Goods Trade 🔮
> Dealing in items that require specific skills to produce, creating monopoly potential.

- **Prerequisites:**
  - `valuation ≥ 4` AND pawn or group exclusively produces an item type others cannot
  - OR access to a rare material ([Metal Ore](materials.md#metal-ore), linen, etc.)
- **Enables:**
  - Premium margins on exclusive goods
  - Cross-path: demand for metal weapons creates [Military](tribal-military.md#warrior-specialisation) back-pressure
  - Motivates [Skills › Alchemy](skills.md#alchemy) for rare dyes and compounds

---

## Stage 4 — Commercial Networks

### Corporation 🔮
> Multiple shops under one ledger with pooled float and shared purchasing power.

- **Prerequisites:**
  - ≥ 2 shops under common ownership AND `valuation ≥ 5` AND `planning ≥ 3`
  - AND [Civic › Currency](civic-industrial.md#currency) available (for ledger denominated in script)
- **Enables:**
  - Pooled purchasing power for bulk buys
  - Shared risk across multiple trade routes
  - Corporate patronage of [Civic › Guild](civic-industrial.md#educational-guild) for specialised training
  - Cross-path: large corporation may become politically influential ([Civic › Governance](civic-industrial.md#governance))

---

### Partnership & Protection 🔮
> Formal arrangement between a merchant and a military group.

- **Prerequisites:**
  - Caravan in operation AND [Tribal › Clan Formation](tribal-military.md#clan-formation) available
  - OR `cooperation ≥ 4` AND previous successful escort trip
- **Enables:**
  - Reduced caravan loss risk
  - Stable income for clan (foodstuffs and raw materials)
  - Mutual prosperity loop: safer routes → more trade → more escort fees

---

### Merchant Company 🔮
> A formal multi-pawn organisation with pooled goods, shared routes, and governance.

- **Prerequisites:**
  - Corporation established AND ≥ 3 pawn members AND `leadership ≥ 3` in a member
- **Group type:** `merchant_company`
- **Enables:**
  - Largest-scale trade operations
  - Ability to commission [Civic › Industrial Production Chain](civic-industrial.md#industrial-production-chain)
  - Political influence rivalling small settlements
  - Long-distance [Trade Route Graph](#trade-route-graph) covering multiple regions

---

## Mercantile Score

A pawn's or group's mercantile score aggregates:
- Completed trades count
- Total trade value flow (sum of arbitrage margins per cycle)
- Price-discovery accuracy (observed vs actual trade prices)
- Route coverage (distinct nodes visited)

High mercantile score makes a pawn or group attractive as a trading partner and raises their influence in settlements they frequent.

---

## Cross-Path Interactions

| Mercantile development | Interacts with |
|-----------------------|---------------|
| First barter | [Civic: market emergence](civic-industrial.md#hamlet) |
| Trade routes | [Military: escort demand](tribal-military.md#martial-hierarchy) |
| Caravan stops | [Civic: settlement growth](civic-industrial.md#proto-settlement) |
| Trade goods demand | [Civic: production specialisation](civic-industrial.md#industrial-production-chain) |
| Corporation | [Civic: currency and governance](civic-industrial.md#currency) |
| Merchant company | [Military: arms procurement](tribal-military.md#warrior-specialisation) |

---

## Back-Pressure Examples

- A pawn who has successfully traded stone knives will recognise the value of a better cutting tool ([Metal Blade](tools.md#metal-blade)) to improve their trade-good quality, back-pressuring the metallurgy chain.
- A merchant caravan that repeatedly passes through a dangerous area will seek military protection, back-pressuring clan formation in that region.
- Surplus cloth production motivates cartography: knowing where the cloth market is becomes valuable.
- A pawn who hears stories about legendary items from distant regions will develop wanderlust (exploration motivation) and may initiate new trade routes.
