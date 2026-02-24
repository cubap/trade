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
