---
title: Let's Make a Plan
published: 2015-11-11 14:21
---

Since I don't know anything about anything, it seems responsible to make a plan for some prototyping. As far as I can tell, there are visualization first or data first development paths. I will probably alternate between the two to find a final product, like walking a heavy bookcase against a wall.

### Skills I have

The Infinternet can barely contain all I cannot do, so let us start be thinking of those things with which I have experience.

Having built web applications before, I am comfortable with the data wrangling and logic used to manage digital objects and push them forward into views. jQuery and AngularJS are both very good at interactions between data and user, but probably have too much overhead for a final product. However, most of the methods I create would port easily into other JS game engine/libraries (one supposes).

Similarly, though I know that WebGL is hot and an app built for Android or iOS or anything else using their SDK and custom version of C or Java or whatever is very mainstream, I have zero experience with them. My hope is that if I can make the data systems make sense, the porting from one to another as needed ought to be easy or automatable by a third party tool. In at least the first instance, I'll probably pull the "HTML 5 apps FTW blah blah!" and spend time talking about how hip I am to know such a portable technology and less about how limited I am in my ability to code anything else.

### The Plan, then?

Okay, fair point. Let's assume the basic game concept is baked even where not recorded and start from there. Let's also assume our environment during development is a browser, which we'll connect to a back-end when we need to later (perhaps NodeJS, my mustachioed friend?):

1. Build a POJO definitions for basic entities: map, vegetation, and critters;
* Organize POJO collections for the same and mock-persist them in the game cache (probably localCache);
* Build a simple game-loop without rendering and create a simple output view (probably something obvious like AngularJS);
* Attach motivations and behaviors to `turf` and `trees` to simulate growth and terraformation;
* Attach motivations to some simple critters and let them wander around;
* Switch to some simple draw cycles and see if it looks like the world is visualizing in a natural way;
* Finish at least 3 tiers of vegetation and 3 tiers of critters all on a single map tile type;
* Add humanoids as simple critters with only a few social behaviors at first;
* Try porting the mess into a game engine and evaluate options like canvas vs. svg vs. WebGL vs. whatevs;
* Do something;
* Take over the world.
