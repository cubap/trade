# Knowledge Trees

This directory contains the knowledge trees for the Trade simulation. Each tree describes a domain of discovery — skills, materials, tools, structures — together with the prerequisite conditions that make each discovery possible.

## How to Read the Trees

- **Prerequisites** are listed under each entry. When multiple prerequisite lines appear, they represent **alternative paths** — satisfying *any one* of them is sufficient unless explicitly marked `AND`.
- **Enables** lists what a discovery unlocks: skills, recipes, goals, or entries in other trees.
- Cross-tree links use the format `[Tree › Entry](target-file.md#section-heading)`.
- Entries marked 🔮 are **planned but not yet implemented**; entries marked ✅ are **implemented**.
- Discoveries are generally **emergent**: pawns stumble into them through play, not through a fixed checklist.

## Trees

| File | Domain |
|------|--------|
| [skills.md](skills.md) | Skill development — how new capabilities are unlocked |
| [materials.md](materials.md) | Raw materials and how they are found or refined |
| [tools.md](tools.md) | Hand tools and carried equipment |
| [structures.md](structures.md) | Placeable buildings and infrastructure |
| [knowledge.md](knowledge.md) | Invention, pondering, and cross-domain insight |

## Emergent Paths

Three broad civilizational trajectories emerge from the simulation. They are **roughly equally likely** in an unguided run, and they cross-pollinate freely.

| File | Path |
|------|------|
| [tribal-military.md](tribal-military.md) | Hunting, combat, territory, and clan organisation |
| [civic-industrial.md](civic-industrial.md) | Settlement, production, infrastructure, and governance |
| [mercantile-entrepreneurial.md](mercantile-entrepreneurial.md) | Trade networks, value creation, and merchant enterprise |

## Conventions

- **Skill levels** are numeric (e.g. `weaving ≥ 2`).
- **Item exposure** counts how many times a pawn has encountered a material type.
- **Structure exposure** counts how many times a pawn has been near a structure tag.
- `OR` between prerequisite lines means any single line suffices.
- Back-pressure: once a pawn masters a later discovery they may find earlier prerequisites easier to recognise — this is noted where relevant.
