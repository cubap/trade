---
title: Let's POJO Some Entities
published: 2015-11-13 02:51
---

It is not pseudo-code, but it isn't baked into any structure or commit yet. The goal is to outline what properties will be attached to which entity for control. Behaviors are not considered yet.

## Gameboard

~~~
trade.Map = {
  tiles: {},                // Map of Tiles
  center: { x:0, y:0, z:0 } // for hex-grid, but may change
};

trade.Tile = {
  id: "x000y000z000", // unique, position-based
  position: {},       // hex coordinates {x,y,z}
  base: {             
      type:0,         // 0:dirt, 1:rock, 2:sand, 3:water
      quality:1       // suitability for things
  },
  history: [],        // events on this space
  holds: [],          // debris laying around
  cover: {},          // turf, gravel, grit coverage
  contains: [],       // discrete entities like structures and plants on tile
  vacant: 100         // percent of space not covered by structures or turf
  // Add? owner, signs, paths, makeup (fertility, danger, etc?)
};
~~~

## Plants

~~~
trade
~~~
