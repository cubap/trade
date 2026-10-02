# Copilot Instructions for Trade

## Project Overview

Trade is a game about learning trades, trading stories, and executing trades. It features both multiplayer and solo gameplay modes with autonomous AI agents (pawns) that exhibit emergent behaviors through goal planning, resource memory, and crafting systems.

### Key Features
- Real-time multiplayer game server using Socket.io
- Solo gameplay with autonomous pawns/agents
- Hierarchical goal planning system for AI agents
- Resource memory and gathering mechanics
- Crafting system with recipes
- Animal behaviors (foragers, predators)
- Entity-component architecture

## Technology Stack

- **Runtime**: Node.js >= 22.0.0
- **Framework**: Express.js 4.x
- **Real-time**: Socket.io 4.x
- **Database**: MongoDB with Mongoose 8.x
- **Module System**: ES Modules (`type: "module"`)
- **Testing**: Node.js built-in test runner with supertest

## Development Setup

### Prerequisites
- Node.js 22.0.0 or higher
- MongoDB (optional, can be disabled in server.js)

### Installation
```bash
npm install
```

The solo client loads three.js as plain ES modules (no bundler). `server.js`
generates the served subset into `vendor/three/` on boot from the installed
`three` package; `vendor/` is gitignored. Run `npm run vendor:three` to refresh
it by hand (e.g. after bumping the `three` version). Never add a static route to
`node_modules` - only the allowlisted `vendor/three/` copy is served, and
`test/vendor-three.test.js` enforces that.

### Running the Application
```bash
# Start the multiplayer server
npm run serve

# Start a client (in another terminal)
npm run start:client

# Solo game
# Open http://localhost:3000/solo/index.html in browser after starting server
```

### Testing
Tests use Node.js built-in test runner (not Jest):
```bash
npm test                                    # test/ + solo/test/
node --test test/vendor-three.test.js       # a single file
```

## Project Structure

### Root Level
- `server.js` - Express server setup, serves static files and provides basic REST endpoint
- `client.js` - Socket.io client for connecting to multiplayer server
- `gameLogic.js` - Multiplayer game logic with Socket.io event handlers
- `package.json` - Node.js project configuration with ES modules

### `/models`
MongoDB models for multiplayer mode:
- `Entity.js` - Base entity schema for MongoDB
- `Feature.js` - Feature entity schema

### `/solo` 
Standalone single-player game with autonomous agents:
- `app.js` - Client-side game entry point
- `test_goals.js` - Testing utilities for goal system
- `/js/models/` - Game entity models and systems
  - `Entity.js` - Base entity class for solo game
  - `/entities/` - The live entity hierarchy, exported by `entities/index.js`,
    `entities/mobile/index.js`, `entities/immobile/index.js` and
    `entities/resources/index.js`. There is no central type table: a type is its
    class plus its `subtype` string and `tags`, and readers match on those.
  - `/entities/mobile/` - Mobile entities (Pawns, Animals)
    - `Pawn.js` - Main autonomous agent with inventory, stats, and memory
    - `PawnGoals.js` - Goal planning and execution system
    - `GoalPlanner.js` - Hierarchical goal decomposition
    - `Animal.js`, `AnimalBehavior.js` - Animal AI
  - `/entities/resources/` - Harvestable resources (Rock, Stick, FiberPlant, etc.)
  - `/entities/plants/` - Flora entities
  - `/crafting/` - Crafting recipes and systems

### `/config`
Configuration files (database connection, etc.)

### `/test`
Test files using Node.js test runner

## Architecture

### Solo Game Architecture
The solo game uses a client-side simulation with autonomous agents:

1. **Entity System**: Base `Entity` class with position, movement, and action queuing
2. **Pawn System**: Autonomous agents with:
   - **Inventory**: Item storage system
   - **Attributes**: Health, energy, hunger, thirst
   - **Goals**: Priority-based goal queue
   - **Memory**: Resource location memory with age tracking
   - **Skills**: Crafting, gathering, weaving skills

3. **Goal Planning System**:
   - Hierarchical goal decomposition (complex goals → subgoals)
   - Goal types: gather, craft, explore, socialize, search_resource, gather_specific
   - Automatic prerequisite detection for crafting
   - Resource memory integration for efficient gathering

4. **Crafting System**:
   - Recipe-based item creation
   - Input requirements (materials, skills)
   - Skill progression on successful crafts

### Multiplayer Architecture
- Express server serves static files and REST endpoints
- Socket.io handles real-time bidirectional communication
- MongoDB stores persistent entity state
- Optional - can be commented out if not needed

## Code Style and Conventions

### General
- Use ES modules (`import`/`export`, not `require`)
- Use single quotes for strings
- Use camelCase for variables and functions
- Use PascalCase for classes
- Prefer `const` over `let`, avoid `var`

### File Organization
- One class per file when possible
- Export classes/functions at end of file
- Group related imports together

### Classes
- Use class syntax (not prototype manipulation)
- Constructor initializes all instance properties
- Methods should be concise and single-purpose

### Comments
- Use JSDoc comments for complex functions
- Inline comments for non-obvious logic
- Document magic numbers and thresholds

### Example Code Style
```javascript
import Entity from './Entity.js'
import { RECIPES } from './Recipes.js'

class Pawn extends Entity {
  constructor(name, x, y) {
    super(name, x, y, 2)
    this.inventory = []
    this.resourceMemory = []
  }

  rememberResource(entity) {
    // Avoid duplicates within cluster radius
    const nearby = this.resourceMemory.find(mem => {
      const dx = mem.x - entity.x
      const dy = mem.y - entity.y
      return mem.type === entity.type && Math.sqrt(dx * dx + dy * dy) <= 30
    })

    if (!nearby) {
      this.resourceMemory.push({
        type: entity.type,
        x: entity.x,
        y: entity.y,
        rememberedAt: Date.now()
      })
    }
  }
}

export default Pawn
```

## Testing Guidelines

### Test Structure
- Use Node.js built-in `test` and `assert` modules
- Place tests in `/test` directory
- Name test files with `.test.js` suffix
- Use `supertest` for HTTP endpoint testing

### Example Test
```javascript
import test from 'node:test'
import assert from 'node:assert'
import request from 'supertest'
import { app } from '../server.js'

test('GET / should return server status', async () => {
  const res = await request(app).get('/')
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.text, 'Server is running')
})
```

### Running Tests
```bash
npm test
```

## Important Behavioral Notes

### Goal System
- Pawns use hierarchical goal planning - complex goals decompose into subgoals
- Goals have priorities and descriptions
- Resource memory is consulted before exploration
- A failed gather lowers that memory's confidence, and a patch that fails three
  times is forgotten outright; `observeGatheringOutcome` books what other pawns
  report about the same place

### Memory System
- The cap is a phase ladder, not a constant: 20 places at memory phase 1, then 40,
  60 and 100 (`updateMemoryPhase`, driven by orienteering and cartography). Above
  phase 2 nothing evicts at all, which is a bug being tracked in #119.
- Memories have timestamps and age naturally; recall throws away anything below
  0.1 confidence or older than 2000 ticks, and ranks the rest by distance
  (weighted by tiredness), age, confidence, cluster size and observed outcomes
- Resource types: rock, stick, fiber_plant, forage_food, water
- Clustering merges nearby sightings into one patch, but only once a pawn reaches
  memory phase 3 or earns `memoryClustering` 10; the radius is
  `min(45, 18 + memoryClustering * 0.8)`, so it grows with practice rather than
  being a fixed distance
- `solo/test/pawn-memory.test.js` is the executable version of all of the above

### Crafting
- Recipes define inputs (materials + quantities) and outputs
- Skills may be required or gained from crafting
- Goal planner automatically creates gathering subgoals for missing materials

### Skill awards (`useSkill` vs `increaseSkill`)
There are exactly two ways to move a skill number, and which one you type is the
rule (#101, enforced by `solo/test/pawn-skill-verbs.test.js`):

- `pawn.useSkill(skill, amount)` - the pawn *did* something. Gathering, crafting,
  closing a barter, teaching or attending a lesson, walking a route, remembering a
  resource, even a tick spent exploring. Every activity handler uses this, and it
  is the only place a diminishing-returns curve can ever go.
- `pawn.increaseSkill(skill, amount)` - the arithmetic underneath, and the door
  for payments that are not practice: a workshop's "you are standing in here"
  bump, a market's bartering bonus, a tincture's buffs, a meal's effect, the
  regular-hours habit, a growth rule, a test.

`gainSkill` was a third alias added so civic code would stop throwing; it is
deleted and must not come back. Amounts belong to the caller either way - the
verb decides *how* a payment lands, never how big it is.

## Documentation References

- **Hierarchical Goals**: See `HIERARCHICAL_GOALS.md` for detailed goal planning architecture
- **Memory Enhancement**: See `MEMORY_ENHANCEMENT_PLAN.md` for future memory system improvements
- **License**: CC BY-NC-SA 4.0 (see LICENSE file)

## Common Tasks

### Adding a New Resource Type
1. Create class in `/solo/js/models/entities/resources/`
2. Extend `Resource` base class
3. Export from `/solo/js/models/entities/resources/index.js`
4. Set `this.subtype` and `this.tags` in the constructor - that pair is the
   registration. `PawnGoals` matches on it when it looks for something to gather,
   and `EntityPose.js` / `ThreeRenderer.js` when they pick a model. There is no
   type table to add it to; `EntityTypes.js` was a dead lookalike of the real
   hierarchy and was deleted, so do not recreate it.
5. Spawn instances in game initialisation (`solo/js/app.js`) or world generation

### Adding a New Goal Type
1. Define goal structure in `PawnGoals.js`
2. Add execution logic to `executeGoal()` method
3. If complex, add decomposition logic to `GoalPlanner.js`
4. Update goal priorities and descriptions

### Adding a New Recipe
1. Add recipe to `RECIPES` in `/solo/js/models/crafting/Recipes.js`
2. Define inputs (item type + quantity)
3. Define outputs
4. Optionally add skill requirements/rewards
5. Test with goal planner decomposition

## MongoDB Considerations

- MongoDB is optional for solo game
- Comment out MongoDB imports and `connectDB()` in `server.js` if not needed
- Multiplayer mode requires MongoDB for entity persistence
- Use Mongoose schemas defined in `/models`

## Environment Variables

Create `.env` file in root:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/trade
TEST_PAWN=<valid-mongodb-objectid>
NODE_ENV=development
```

## Known Limitations

- Resource memory stops honouring its cap above memory phase 2 (#119)
- No UI for crafting/inventory (console-based for now)
- Single pawn in solo mode (multi-pawn planned)
