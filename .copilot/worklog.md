# Copilot Worklog

## 2026-02-23

- Consolidated scattered markdown documentation into canonical files under `docs/`
- Created persistent Copilot context under `.copilot/context.md`
- Marked transient implementation/session summary docs for removal
- Implemented learnable memory clustering, route planning, social memory sharing, revisit confidence decay, and observed-success route weighting
- Implemented broad resource specialization by domain (including agriculture class transfer for seeds/soils) and intent-aware stick/wood discernment for value appraisal
- Documented additional specialization and mercantile-path opportunities as future considerations in docs
- Synthesized recurring ideas from `docs/TradeGameNotes.pdf` into canonical occupation/economy documentation
- Formalized Tribe/Town/Traders framing and occupation-focused priorities in docs and persistent context
- Documented skill distribution across triad with context-dependent expressions (teaching, crafting, assessment)
- Documented cross-triad interaction patterns (security contracts, supply chains, market anchoring, knowledge circulation)
- Established progression pacing targets (7-day adulthood, 20-day specialization, 5-month mid-game, 1-year city)
- Added timing benchmarks to InventionConfig and civilization roadmap with concrete tick values
- Updated persistent context with core design principles (pacing targets, gameplay feel, control style)
- **Compared framework with docs/trees knowledge trees:**
  - Trees provide detailed prerequisite chains (skills, materials, tools, structures, 3 paths)
  - Framework provides timing targets and cross-triad interaction patterns
  - Identified work items: occupation signal scoring, prerequisite evaluation system, contract primitives, teaching variants, group formation mechanics
  - Resolved terminology (Tribe↔Tribal, Town↔Civic, Traders↔Mercantile are compatible)
  - Noted skill scaling question (recommend dual-scale: 0-10 unlock tiers, 0-100 mastery levels)
  - Documented findings in `.copilot/trees-framework-alignment.md`
- **Configured Netlify deployment:**
  - Created `netlify.toml` with static site configuration (Node 22.0.0, redirects, cache headers)
  - Created `.nvmrc` for Node version pinning
  - Updated `.gitignore` (added .env, .netlify, build artifacts)
  - Created serverless function `netlify/functions/dev-log.js` for client-side logging
  - Created `NETLIFY_DEPLOY.md` with deployment instructions
  - Created root `README.md` with project overview, quick start, and design principles
  - Configured auto-deploy on push to main branch
  - Root URL redirects to solo game at `/solo/index.html`
- **Configured Railway deployment:**
  - Created `railway.toml` with build/deploy configuration
  - Created `Procfile` for process management
  - Created `RAILWAY_DEPLOY.md` with comprehensive deployment guide
  - Updated environment variable references from MONGODB_URI to MONGO_URI (matches code)
  - Updated README.md with dual deployment strategy (Netlify + Railway)
  - Configured auto-deploy on push to main branch
  - Railway hosts full Node.js server with Socket.io and MongoDB

Use this file for future short-lived execution logs. Promote durable outcomes into `docs/`.
