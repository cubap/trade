# Hierarchical Goal Planning

## Overview

Pawns decompose complex goals into executable subgoals based on recipes, known resources, and skill constraints.

## Components

### Goal Planner

- `decomposeGoal(pawn, goal)` generates prerequisite subgoals for craft goals
- `isGoalReachable(pawn, goal)` validates resource and skill feasibility
- `injectRecipes(recipes)` provides synchronous recipe access at startup

### Pawn Goal Runtime

- Deferred goal queue stores currently unreachable goals
- Goals are periodically re-evaluated and resumed when conditions improve
- `gather_specific` uses remembered resource locations
- `search_resource` explores for unknown or depleted resource targets

### Pawn Resource Memory

- Resource sightings are tracked with location and recency
- Recall helpers provide lookups by type or tags
- Exploration updates memory with newly observed resources

## Goal Decomposition Flow

1. A high-level craft goal is selected.
2. Reachability is checked against inventory, memory, and required skills.
3. Missing requirements become subgoals (`gather_specific`, `search_resource`, or skill training goals).
4. Subgoals execute before the original craft goal.
5. Unreachable goals move to deferred state and are retried later.

## Integration Points

- App startup injects recipe data into the planner
- Resource seeding influences initial plan success rates
- Idle behavior should bias toward gathering when inventory is low

## Design Benefits

- Produces emergent gather → craft behavior
- Keeps planning extensible for additional goal families
- Improves debuggability through explicit subgoal chains
