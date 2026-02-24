# Trade

A game about learning trades, trading stories, and executing trades. Featuring autonomous AI agents with emergent behavior, hierarchical goal planning, resource memory, and civilization development.

## Features

- **Solo Gameplay**: Fully client-side simulation with autonomous pawns
- **Autonomous Agents**: Pawns with goals, memory, skills, and emergent specialization
- **Tribe/Town/Traders**: Three interacting civilization paths
- **Hierarchical Goals**: Complex goal decomposition with resource memory
- **Crafting and Discovery**: Autonomous invention system with quality and durability
- **Occupation Emergence**: Professional specialization from repeated behavior

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Run the server
npm run serve

# Open the game
# Navigate to http://localhost:3000/solo/index.html
```

### Play Online

The game is deployed on Netlify and updates automatically on every push to `main`.

## Project Structure

- `/solo` - Client-side game (HTML, CSS, JavaScript)
- `/docs` - Comprehensive documentation
  - `/architecture` - Core design and behavior patterns
  - `/systems` - Implemented gameplay systems
  - `/plans` - Roadmaps and implementation plans
  - `/trees` - Knowledge trees with prerequisites
- `/models` - MongoDB schemas (optional, for multiplayer)
- `/config` - Configuration files
- `/test` - Unit tests

## Documentation

- **[Occupation & Economy Framework](docs/architecture/occupation-and-economy-framework.md)** - Progression pacing and cross-triad interactions
- **[Knowledge Trees](docs/trees/)** - Detailed prerequisite chains for skills, materials, tools, structures
- **[Invention System](docs/systems/invention-system.md)** - Autonomous discovery mechanics
- **[Civilization Roadmap](docs/plans/civilization-roadmap.md)** - Multi-branch progression plan
- **[Deployment Guide](NETLIFY_DEPLOY.md)** - How to deploy to Netlify

## Technology Stack

- **Runtime**: Node.js 22.0.0+
- **Framework**: Express.js (for local development server)
- **Real-time**: Socket.io (for multiplayer, optional)
- **Database**: MongoDB with Mongoose (optional)
- **Module System**: ES Modules
- **Testing**: Node.js built-in test runner

## Development

### Running Tests

```bash
# Run unit tests
node --test solo/test/*.test.js
```

### Code Style

- ES modules (`import`/`export`)
- No unnecessary semicolons
- ES6+ syntax (optional chaining, nullish coalescing)
- Guard clauses over nested conditionals

## Deployment

The solo game is deployed as a static site on Netlify. See [NETLIFY_DEPLOY.md](NETLIFY_DEPLOY.md) for detailed instructions.

For multiplayer server deployment, consider platforms like Render, Railway, or Fly.io.

## License

Trade © 2008 by Patrick Cuba is licensed under [CC BY-NC-SA 4.0](LICENSE)

## Design Principles

### Progression Pacing

- Days 1-7: Basic stone age competence
- Days 7-20: Professional specialization emerges
- Months 3-5: Mid-game technology (organized groups)
- Year 1: Full preindustrial city complexity

### Gameplay Feel

- **Indirect Control**: Set goals and priorities, not micromanagement
- **Emergent Specialization**: Occupations develop from behavior patterns
- **Autonomous Execution**: Pawns handle pathfinding, crafting, social interactions
- **Brisk but Earned**: Progression feels rewarding without grind

Stone age skills come easily. Technology brackets similar to Minecraft/Vintage Story, but grounded in realistic materials with no magic.
