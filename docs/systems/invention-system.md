# Autonomous Invention System

## Purpose

The invention system enables pawns to discover solutions, learn socially, specialize over time, and still accept player guidance.

## Implemented Capabilities

### Discovery and Pondering

- Pawns detect friction points and enqueue problems for pondering
- Discovery chance uses invention/experimentation skills and repeated attempts
- Discovered concepts persist in pawn knowledge

### Quality and Durability

- Crafted output quality is skill-influenced and variance-adjusted
- Durability and effectiveness scale with quality over item lifetime
- High quality output can retain stronger effectiveness when worn

### Lateral and Social Learning

- Pawns track observed crafts and encountered materials
- Material-group substitution can unlock adjacent solutions
- Nearby craft observation and story hearing can improve discovery outcomes
- Resource specialization now broadens by class: repeated encounters improve comprehension across similar domains (for example crops, soils, and seeds)
- Wood/stick gathering now develops intent-aware discernment for tool, weapon, and construction suitability, affecting perceived value

### Skill Synergy and Path Reinforcement

- Related skills contribute synergy bonuses
- Successful solution use reinforces similar future discoveries
- Repeated successes create natural specialization profiles

### User Intervention Surface

- `setGoalPriorities(priorities)`
- `assignArbitraryGoal(goalConfig)`
- `setResourceValuePreferences(preferences)`
- `adjustInventionRate(multiplier)`

All tuning values are centralized in `solo/js/models/entities/mobile/InventionConfig.js`.

## Testing

- Unit and integration tests live in `solo/test/`
- Browser-oriented helpers are available in `solo/test_goals.js` and `solo/test_invention_system.js`

## Operational Notes

- Use subtle priority multipliers for guidance-first gameplay
- Favor autonomous behavior and intervene only when steering outcomes
- Keep balancing changes in config, not hardcoded behavior branches

## Potential Considerations

- Add explicit trade-grade labels (common, practical, premium) derived from specialization confidence and intended use
- Introduce profession drift and identity thresholds (forager, farmer, woodwright, trader) that emerge from sustained domain behavior
- Let settlements and merchants publish demand signals that shape specialization progression without direct user commands
- Add explicit soil/season compatibility memory so agriculture specialists can forecast higher-yield planting choices
- Enable observational apprenticeship events where witnessing expert classification accelerates novice specialization gains

## Occupation Guidance

- Treat invention outputs as occupation-shaping signals, not isolated craft events
- Let repeated success in a domain bias future goals toward that domain and adjacent materials
- Reinforce Tribe/Town/Traders identity through practical outcomes:
  - Tribe: survival and shared labor innovations
  - Town: structure and production innovations
  - Traders: logistics, appraisal, and route innovations
