---
title: Let's Imagine Behaviors - Plants
updated: 2015-11-02 20:06
---

As I've been led to understand, describing behaviors is better than trying to program actions into as many various critters as we expect to populate this world with. There is a decent [Tuts roundup](http://gamedevelopment.tutsplus.com/series/understanding-steering-behaviors--gamedev-12732) of these sorts of things as it impacts movement, but we'll plan for some of our plants first.

### Plant Behaviors
We know from biology that plants feed on light, soil, and air; they propogate by seed, runner, rhisome, and cutting; they grow through distinct life phases; and generate a host of materials useful to myriad critters. In this world, light and air will be simulated by a `crowding` metric; soil will have `type` and `quality`; propogation will follow different patterns; plant `stage` will enable certain properties; and all manner of droppables (nuts, seeds, fruit, flowers, berries, sticks, logs, fiber).
#### Grow and Multiply
Growing is a simple set of rules where the `base.quality` of the tile (however we determine that) sets a multiplier on the advancing of the stages of the plant and space available will determine when new growth is possible.
**turf** like grass and grains has the easiest behavior, since it acts mostly like a covering organism instead of many individual ones. Each grass will have a `coverage` and will first fill up its neighborhood and then spread to others: 
~~~
if (hex.vacant > grass.coverage) {
  grass.coverage += random * base.quality * grass.growthRate
  if (grass.coverage > 40%) {
    // overcrowded and spreads
    // seed out even if it does not land
      seed = random()*spread
      spread -= seed
      n = neighbors[random]
      if (n is soil-type 
          && spread && n.vacant > 40%
          && n.vacant > seed) {
          // spread here
          self.propogate(n,seed);
      }
  }
~~~
In this way, grasses against rocky or sandy areas will stop spreading and turf will be much thinner in an area well-populated with trees, homes, or other things that take up space on a tile. If the space is below some threshold (40%, here), it will be considered too crowded and grass won't even get a start.
From this, other mechanics may develop as well:
* a constantly grazed area will remain in lower coverage, but replenish itself rapidly unless it is grazed bald in areas;
* well-trodden areas may make natural paths, which mobile critters woudl be able to detect and prefer to move along;
* farming grain or flowers would have a natural buff if the farmer were clever enough to clear an area and sparsely sow the seeds. Weed grasses would invade and slow propogation naturally;
* potted flowers would need their `tile` replaced with a pot container of some type, just as with a raised bed garden; and
* farmers may observe natural fertilizers (bone char, ash, blood, manure) and begin to amend soil with them.

**Bushes and Trees** will be more complex because they have stages of life. A new `tree` begins as a seed in `stage:0` with `age:0`, and `footprint:0`. A seed takes up no space on the ground and grows only by aging:
~~~
if(tree.age > 7){
  // grow to seedling
  if(checkEnvironment(tree)) {
      tree = toSeedling(tree);
  } else if (tree.age > 180) {
      self.dies(tree);
  }
}
~~~
The seed will check its environment every turn for a set range of times to attempt to grow. If conditions never prove favorable, it `dies()`.
A `stage:1` seedling follows the exact same rules, but with a different environmental test and different age range. As the plants mature, they require more space, but can idle for longer while waiting for favorable conditions. The environment check generally checks for similar plants in the stage being entered:
~~~
function checkEnvironment (tree) {
  switch (tree.stage) {
    case 0: if (number_of_seedlings_on_tile > 2)
      return false
    case 1: if (number_of_saplings_on_tile > 0)
      return false
    case 2: // only one allowed per 1m radius
        if (number_of_adults_on_all_neighbor_tiles > 0)
          return false
    case 3: // adult is always good, once grown
  }
  return true;
}
~~~

Seeding takes place in an adult `bush` or `tree` and individual spreading rules (like the equal circles of grass, above) can be set for different varieties. A `berry` or `fruit` might first create a seeded fruit on the plant and mature it before dropping or being consumed. A `nut` may drop a fruit that needs to spend quite some time off the tree (during which other forces may move it) before growing. A `maple` or `lumber` type, might drop many fragile seeds along a wind vector.
Farming trees follows the patterns for `grass` above:
* well-spaced trees will reach maturity quickly and soil can be amended for better yields;
* clearing an area requires not only removing adults, but maintaining to remove the sprouts as well;
* knowledge and cultivation of variants will yeild better results for purposeful farming; and
* natural variation in properties may be introduced to allow for more selective harvesting.

### Die and Destroy
Plants die differently from other things. The growth and propogation will cease, obviously, but their usefulness does not. Dead `turf` may stick around for awhile (or even be having been harvested) and dry out into `fiber` or rot until it actually disappears from the map (`destroy()`). A `bush` or `tree` remains sticks and logs for much longer, though it may fall over or clear an area for other plants to mature. A dead sapling may leave a dried out stick standing for some time, which is good for firewood, but terrible for a bow. A dead tree may actually fall and destroy some other things in its path.

With these basic behaviors, it is time to consider critters, which also grow, multiply, and die, but add in the complications of movement (idle, wander, hunt/forage/scavenge, hide, evade, pursue) and motivation (security, shelter, hunger, thirst, rest, endurance, reproduction). However, just as basic `turf` made for a broader foundation for many other methods, I suspect these will simplify under investigation.
