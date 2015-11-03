---
title: Let's Describe the Game
updated: 2015-11-01 15:00
published: true
---

The `Trade` world is a living thing that players simply enter into as a bossy observer. Instead of playing a character, a player adopts a character who they may coach through the simple tasks of living. But let's not get ahead of ourselves.

### The World
A simulterra, earth-like world is populated at its conception with a habitable environment, basic resources, and a simple food-web. I'd like to avoid naming as much as I can, so take all labels herein as semantic crutches and are flexible.
**Terrain** The long goal is to have wonderful, immersive, and dynamic terrains, but this is probably happening much later in development. To begin, then, let's commit to a flat world with land types manually placed.
**Land** The type of land in each part of the map will certainly be the foundation not only for the type of things that grow and thrive there, but also available resources. Stone, dirt, sand, and water seem like the most obvious starting points. If we find a good way to describe these, the discrimination may not be so important and the emergence of tundra, swamp, desert, and other more "biome-y" land types not explicitly assigned.
**Plants** Land types that support vegetation will have some that occurs naturally of various sizes. Considering this planet, the simplest divisions are probably canopy, under-story, and meadow. Vines, mosses, and specialty plants probably aren't reasonable to work in at this point. The canopy level are your tree-types: fruit, nuts, lumber; under-story are bush-types: berry, hedge, and bramble; meadow are turf-types: flowers, grass, grains. These all thrive when in favorable conditions and reproduce when mature and satisfied. Variation is expected for selection and genetic shift.
**Animals** Are identical to plants except that their ability to move complicates the motivation system. As with plants, there should be some primary types: grazers, scavengers, and hunters. I would expect them to also come in various sizes. For now, probably flight is too much to accommodate. A reasonable starting set would be: fox, squirrel, elk, puma, bear, and players.

### Idle Behavior
Without any input at all, the world grows and shifts, grass spreads across dirt, trees fruit and propagate, and animals seek out food and shelter while populations balance each other. The humanoid player characters in the world will require a little more programming, but they will still basically operate on autopilot with simply a more complete set of motivations.
The first accomplishment, I think, in the development of `Trade` will be the creation of a populated world without any input from any user at all.

### Playing Characters
While the world is humming along, a user may come into it and adopt a player character. I imagined users only wanting to play humanoid characters, but there would not *technically* be anything in the way for someone who wants to drive a squirrel around. The adoption process may be creative, where a user's primary player is born or at least spawned when the world is initiated or a new player may wander around free-looking at all the entities in the world until inhabiting one which isn't spoken for otherwise. I don't know which I like better at this point, but the latter is probably easier to code in the first instance.
The inhabited character will expose her immediate plans and her basic satisfaction. There will be some suggestions that the user can make (go here; gather this; build this; talk to her) and these are shown to the user based on the available resources and skills. Given that all suggestions will be in the basic formula of `act with x on target` (with `x` being a tool or entity and `target` being an entity, location, or classification) it should be simple to insert the suggestions into the character's own action queue once it is tested for resistance, priority, and possibility.

<hr>

In closing, the plan is a Tecmo Superbowl (coach vs coach) meets MUD meets Civilization. It is Populous without the terraforming; Minecraft without the destructable environment; and Spore without the episodes. The world will be uncomplicated at first, just a scaffold for the entities that infest it, and the typical user will stop in to visit the characters they have invested in.
