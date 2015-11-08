---
title: Let's Chase Critters
date: 2015-11-03 00:15
---

In the [last post](lets-imagine-behaviors.md), we covered the basic plant life cycle. Critters, which is a technical term I tend to use for anything animalistic that wanders about, are a little more complex. Additional movement (idle, wander, hunt/forage/scavenge, hide, evade, pursue) and motivation (security, shelter, hunger, thirst, rest, reproduction) components must be created for these entities, though many from `plants` can be reused.

### Movement

Any mobile critter will need to find food and water to sustain itself and shelter to survive and reproduce. Natural behavior will not be constant and will probably react to current health and energy levels as well as time of day. Some critters will prefer plentiful food sources (grass) in large quantities while others will expend serious energy for large and infrequent meals (critters). A caching, hoarding, or burying may also be an interesting mechanic as it will certainly be necessary for humanoid critters.

##### Move()
The move action is a sum of all active vectors with priority weights. The `idle` calculation should be easy and would rest or heal critters. In advanced critters, this may be "thinking" time for advancing consideration skills or planning future actions. `sleep` is an extreme form of idle that trades most of the awareness bonuses for rest and recuperation. Any strongly preyed upon species would never truly `sleep` unless in deep cover and in heavy need.

To `wander` will at first be a simple random walkabout. The simplest way to do this is probably push an adjustment vector out in front of the critter of a consistent magnitude but random angle. It is probably the case that there will always be other forces against wandering. For example, a prey species will rarely move further than a set distance from their home. All critters will probably have a natural pull to trodden paths, especially those of the same species. Less social animals may actually avoid evidence of their own when outside of their home territory. The `wander` is the mapping and exploring for a critter as they will keep track of where they see food and water, even if they do not need it at the time.

Hunting or scavenging is a `wander` movement changed to a `seek` by the detection of some sort. Even the most effective hunter or tracker is simulated in this way, seeking indicator after indicator with a high detection, but wandering in between.

Evasion may be active, as in escape from a predator, or passive, as in hiding for ambush or to escape detection. The `evade` movement, however, is always active and moving away from the target(s) being avoided. Hiding is really an `idle` that follows a `seek` movement.

### Motivation

Most games track health and some secondary meter, but for the critters to really be autonomous, this will have to be translated into interacting the motivations of security, shelter, hunger, thirst, rest, and reproduction. The attempt to create prey or predator species, domestic animals, humanoids, or monsters will depend on if it can be successfully encoded into these.

**Security** is the need to feel secure. For something below the top of the food web, this may prevent rest from becoming sleep. Creative humanoids may design clothing, furniture, or buildings to augment a poor natural security while a large predator does not need as much reassurance that it is a safe time to take a nap. Critters that create caches or collections also worry about security of property.

**Shelter** as a motivation is influenced by security, but focuses on feeling exposed. Wearables may satisfy, but only for environmental issues like rain, heat, cold, sun, etc. Any entity may add a sheltering quality to a tile, but it where one critter may find tall grass sheltering, for another it may be only a mature tree that can satisfy. This motivation in the extreme will drive a critter to establish a home from which to set out and mark territory.

**Hunger and Thirst** is the most commonly seen meter in simulation games and ought not to be reinvented. Most foods probably satisfy some thirst, but a good watering hole should still be a draw for all critters. A predator type or long haul animal will probably be able to suppress hunger for quite some time after a large meal, whereas a small prey or grazing animal may be required to feed several times a day to remain stable.

**Rest** as a motivation is based on how long the endurance of a critter can be depleted before requiring a sheltered stop somewhere. There are short-term rests, such as after an energetic action, and longer ones, such as sleeping at night. Some rule variations will set the regular schedule for any critter (nocturnal vs. diurnal) and their movement characteristics. A sprinting predator (say, a leopard) will have to rest after a short, strong burst, but a humanoid critter would be able to sustain a long run at a moderate speed without a rest (but a longer recuperation).

**Reproduction** in this game is probably not going to have too many stages. The motivation, however, will have to take over at certain times to force the numbers to grow while allowing for a throttle for population balancing. While it would be possible to create biological sex requirements and track pairings, genders, and genetic recombinations, that's beyond the scope and not likely to add fun to the game.
