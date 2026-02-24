# Tribal / Military Path

The tribal-military path emerges when pawns develop combat and survival skills, form defensive bonds, and establish territorial control. It is one of three roughly equal emergent trajectories; the others are [Civic / Industrial](civic-industrial.md) and [Mercantile / Entrepreneurial](mercantile-entrepreneurial.md).

**Typical emergence conditions:** high predator density, scarce resources forcing competition, or early luck with hunting skills.

---

## Stage 1 — Survivalist

Individual pawns develop the skills to stay alive and obtain food through force rather than farming or foraging.

### Primitive Hunter 🔮
> Pawn can pursue and kill small animals reliably.

- **Prerequisites (any one path):**
  - [Skills › Knapping](skills.md#knapping) ≥ 2 AND direct combat with animal
  - OR [Skills › Tracking](skills.md#tracking) ≥ 1 AND pawn has observed animal ≥ 5 times
- **Enables:**
  - [Tools › Spear](tools.md#spear) motivation
  - [Materials › Hide](materials.md#hide) and [Bone](materials.md#bone) access
  - Hunting skill progression

---

### Armed Survivor 🔮
> Pawn carries a weapon and can defend against threats.

- **Prerequisites (any one path):**
  - [Tools › Stone Knife](tools.md#stone-knife) in inventory AND pawn has survived a predator encounter
  - OR [Tools › Spear](tools.md#spear) crafted
- **Enables:**
  - Predator deterrence (reduces pawn mortality)
  - Other pawns in range gain a small safety buff (proto-guard role)
  - Back-pressures bonding with nearby pawns (shared threat creates cohesion)

---

## Stage 2 — Clan Formation

### Bonded Pair / Small Party 🔮
> Two or more pawns with mutual bond > 20 cooperating on hunts or defence.

- **Prerequisites (any one path):**
  - `cooperation ≥ 3` AND mutual bond score > 20 between 2+ pawns
  - OR shared threat event (predator attack while multiple pawns are nearby)
  - Cross-path: Civic and Mercantile pawns may bond first and develop military skills later
- **Group type:** bonded_pair → party (3–5 members)
- **Enables:**
  - Coordinated hunting (flanking reduces animal escape chance)
  - Communal camp (shared lean-to or storage pit)
  - [Clan Formation](#clan-formation)

---

### Clan Formation 🔮
> A party formalises into a named clan with a recognised coordinator.

- **Prerequisites:**
  - Party of 3–5 pawns AND average mutual bond > 15
  - Coordinator candidate: highest `(leadership + planning + reputation)` pawn
  - OR external threat pressure pushes informal party to organise
- **Group type:** `clan`
- **Enables:**
  - Tactical commands: `follow`, `flank`, `scout`, `protect`, `retreat`, `pursue`
  - Tactical memory: successful hunts and defences raise clan cohesion
  - [Territory Claim](#territory-claim)
  - Cross-path: Clan may offer [defence contracts](civic-industrial.md#defence-contract) to settlements

---

### Territory Claim 🔮
> The clan marks an informal boundary and begins defending it.

- **Prerequisites:**
  - Clan established AND [Structures › Watchtower](structures.md#watchtower) OR patrol route defined
  - OR clan successfully defends a resource node ≥ 3 times
- **Enables:**
  - Formal territory (waypoint ring stored on group)
  - Repeated defence raises territorial confidence
  - Adjacent clans may negotiate or conflict
  - Cross-path: Stable territory back-pressures [Civic › Proto-Settlement](civic-industrial.md#proto-settlement) formation

---

## Stage 3 — Military Organisation

### Raid / Counter-Raid 🔮
> Active aggression against or defence from other groups over resources.

- **Prerequisites:**
  - Clan territory overlaps with another group's resource use
  - OR resource scarcity event triggers territorial pressure
- **Outcomes (variable):**
  - Victory: resource node captured, martial score rises, cohesion boost
  - Defeat: cohesion drops, possible dispersal
  - Stalemate: diplomatic event possible
- **Enables:**
  - More experienced fighters (combat skill progression)
  - Motivates [Stone Wall](structures.md#stone-wall) and [Watchtower](structures.md#watchtower)
  - Cross-path: Costly conflict motivates diplomacy and trade (Mercantile back-pressure)

---

### Martial Hierarchy 🔮
> The clan develops formal ranks and command structure.

- **Prerequisites:**
  - Clan size ≥ 5 AND `leadership ≥ 3` in coordinator
  - Repeated successful coordinated actions (hunts or defences)
- **Enables:**
  - Specialist roles: scout, guard, hunter-captain
  - Improved command efficiency
  - Cross-path: Clan can offer mercenary or escort services to [Merchant Caravans](mercantile-entrepreneurial.md#caravan)

---

### Fortified Camp 🔮
> A defensive perimeter with watchtower and palisade.

- **Prerequisites (any one path):**
  - `construction_basics ≥ 2` AND `carpentry ≥ 1` AND `timber × 20`
  - OR `masonry ≥ 2` AND `stone × 30`
  - AND territory claim established AND group under active threat
- **Structures needed:** [Watchtower](structures.md#watchtower) + [Stone Wall](structures.md#stone-wall) or timber palisade
- **Enables:**
  - Strong defence bonus
  - Attracts settlers seeking protection (cross-path: settlement growth)
  - Reduces predator and raid mortality for group members

---

## Stage 4 — Tribal Society

### Chiefdom 🔮
> A recognised leader with the authority to direct group resources.

- **Prerequisites:**
  - `leadership ≥ 5` AND clan size ≥ 8 AND martial score dominant in group
  - OR successful raid victory that significantly raises coordinator reputation
- **Enables:**
  - Resource redistribution within group
  - Tribute from allied or subordinate groups
  - Cross-path: Chiefdom may evolve into [Civic › Governance](civic-industrial.md#governance) if civic score rises

---

### Warrior Specialisation 🔮
> Dedicated combat pawns with advanced martial skills and equipment.

- **Prerequisites:**
  - `hunting ≥ 5` AND `leadership ≥ 2` AND access to metal tools
  - [Tools › Metal Blade](tools.md#metal-blade) in widespread use within group
- **Enables:**
  - Elite fighters with significant combat advantage
  - Demand for [Mercantile › Arms Trade](mercantile-entrepreneurial.md#specialised-goods-trade) cross-path
  - Defence contracts at premium rates to settlements

---

## Cross-Path Interactions

| Military development | Interacts with |
|---------------------|---------------|
| Clan formation | [Civic: proto-settlement](civic-industrial.md#proto-settlement) (territory stabilises) |
| Territory claim | [Mercantile: trade routes](mercantile-entrepreneurial.md#trade-routes) (routes avoid or pay tolls) |
| Raid/counter-raid | [Mercantile: demand surge](mercantile-entrepreneurial.md#price-discovery) (weapons, food) |
| Defence contracts | [Civic: hired guards](civic-industrial.md#defence-contract) |
| Chiefdom tribute | [Civic: currency genesis](civic-industrial.md#currency) (tribute formalised) |
| Warrior specialisation | [Civic: guild](civic-industrial.md#educational-guild) (combat training offered) |

---

## Back-Pressure Examples

- A pawn who has already built a stick shelter will more quickly notice that clay and stone could provide stronger walls when under military threat.
- A clan that has lost a raid may recognise the value of walls, forges, and metal tools — back-pressuring the industrial path.
- Storytelling within a clan about past hunts and battles accelerates martial skill diffusion to new members.
