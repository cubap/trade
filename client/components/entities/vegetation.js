var Plants = angular.module('tgVegetation', ['tgElements', 'utils', 'ngStorage']);

Plants.service('Grass', function (Tile) {
    // Grass on dirt is one per meter with a crowding count instead of individual
    this.new = function(tid) {
        return {
            coverage: 0, // 1-100
            growthRate: 5, // constant for number randomly increased each turn;
            footprint: 0, // though it covers the ground, it doesn't prohibit other growth
            loc: tid // this tile id, grass always exists somewhere
        };
    };
    // TODO: add grass variants like flowers and grains
    this.grows = function(grass) {
        var maxSpace = 100 - grass.getTile().vacant;
        var newGrowth = Math.random() * grass.growthRate;
        var coverage = grass.coverage + newGrowth;
        if (coverage > 40 || coverage > maxSpace) {
            // overcrowded and spreads
            grass.coverage = maxSpace;
            var spread = coverage - maxSpace;
            var neighbors = Tile.getNeighbors(grass.loc);
            for (var i = 6; i > 0; i--) {
                var n = neighbors.splice(parseInt(Math.random() * i), 1);
                if (n.vacant < maxSpace) {
                    // spread here
                    this.propogate(n, spread / 6);
                }
            }
        }
        return grass;
    };
    this.propogate = function(tile, spread) {
        var grass = Tile.findInHold(tile,'GRASS');
        if(grass){
            grass.coverage = Math.min(100-tile.vacant,grass.coverage+spread);
        } else {
            grass = this.new(tile.id);
            grass.coverage = spread;
            Tile.add(tile, grass);
        }
        return grass;
    };
    this.isTread = function(grass, tread) {
        // wear out when different things pass over
        // low for animals, more for people, severe for vehicles
        grass.coverage -= tread;
        if(grass.coverage < 1){
            this.dies(grass);
        }
    };
    this.dies = function(grass) {
        if (grass.coverage < 1) {
            Tile.remove(grass);
            return true;
        }
        return false;
    };
});

Plants.service('Bush', function() {
    // medium sized plants that grow in patches near treelines
    this.new = function(init) {
        var bush = {
            type: 0, // 2:berry, 1:bramble, 0:bush for growth
            footprint: 5, // of 100 space taken up in a tile
            stage: 0, // 0:seed, 1:sprout, 2:adult
            age: 0, // age for growth checks
            growthRate: 1, // ratio for aging
            holds: [] // stored items for drops
        };
        angular.extend(init);
        return bush;
    };
    this.newBerry = function() {
        return this.new({type: 2});
    };
    this.newBramble = function() {
        return this.new({type: 1});
    };
    var toSprout = function(bush) {
        // TODO: change attributes to make a sprout
        // add .branches
        return bush;
    };
    var toAdult = function(bush) {
        // TODO: change attributes to make a adult
        // define maxsize
        return bush;
    };
    var checkEnvironment = function(bush) {
        switch (bush.stage) {
            case 0: // seeds can sprout if there are less than 5 sprouts      
                if (Tile.numOfType(bush.tile, 'BUSH', 1) > 4) {
                    return false;
                }
                break;
            case 1: // sprout to bush
                // only 3 bushes allowed per m
                if (Tile.numOfType(bush.tile, 'BUSH', 2) > 2) { // tile to check, type of entity, stage
                    return  false;
                }
                ;
                // 3-10 trees in 10m radius
                var tiles = [bush.tile].push(Tile.getNeighbors(bush.tile, 9));
                var numOfTrees = 0;
                for (var i = 0; i < tiles.length; i++) {
                    numOfTrees += Tile.numOfType(tiles[i], 'TREE', 3);
                    if (numOfTrees > 10) {
                        return false;
                    }
                }
                ;
                if (numOfTrees < 3) {
                    return false;
                }
                break;
            case 2: // adult is always good, once grown
        }
        // looks good
        return true;
    };
    var thrive = function(bush) {
        switch (bush.type) {
            case 0: // just a bush
                if (maxsize === bush.branches) {
                    // cannot grow more
                } else if (History.now() - History.recentEvent(bush.history.growth).time < 8 * bush.growthRate) {
                    // recently grew a stick
                } else {
                    var newStick = Materials.new('STICK', bush);
                    bush.holds.push(newStick);
                    bush.history.growth(History.log(newStick));
                    bush.branches++;
                }
                break;
            case 1: // bush is a bramble
                if (maxsize === bush.branches) {
                    // cannot grow more
                } else if (History.now() - History.recentEvent(bush.history.growth).time < 12 * bush.growthRate) {
                    // recently grew a stick
                    break;
                } else {
                    var newStick = Materials.new('STICK', bush);
                    bush.holds.push(newStick);
                    bush.history.growth(History.log(newStick));
                    bush.branches++;
                }
            case 2: // bush is a berry
                if (maxsize === bush.branches) {
                    // cannot grow more
                } else if (History.now() - History.recentEvent(bush.history.growth).time < 12 * bush.growthRate) {
                    // recently grew a stick
                    break;
                } else {
                    var newStick = Materials.new('STICK', bush);
                    bush.holds.push(newStick);
                    bush.history.growth(History.log(newStick));
                    bush.branches++;
                }
                // check for last berry growth
                if (History.now() - History.recentEvent(bush.history.fruit).time > 30) {
                    // old (or no) fruit, drop and start over
                    this.drop(bush, 'BERRY', -1); // -1 for all of them
                    var newBerries = Food.new('BERRIES', bush, bush.branches * 30);
                    bush.holds.concat(newBerries);
                    bush.history.growth(History.log(newBerries));
                } else {
                    // modify all the berries on the bush
                    angular.forEach(bush.holds, function(item) {
                        if (item.is === 'BERRY' &&
                                item.age++ > 7 &&
                                item.stage === 0) {
                            // attempt to ripen
                            if (Math.random() * 14 + age > 16) {
                                item.stage++;
                            }
                        }
                        // TODO: possibly add premature spoilage as well
                    });
                }
                break;
        }
        return bush;
    };
    this.grows = function(bush) {
        bush.age += bush.growthRate;
        if (age > 6 && stage === 0) { // age in days for now
            // try to sprout or die
            if (checkEnvironment(bush)) {
                toSprout(bush);
            } else if (bush.age > 60) {
                this.dies(bush);
            }
        } else if (age > 8 && stage === 1) {
            // try to adult or die
            if (checkEnvironment(bush)) {
                toAdult(bush);
            } else if (bush.age > 120) {
                this.dies(bush);
            }
        } else if (age > 21 && stage === 2) {
            // adult gains based on type
            thrive(bush);
        }
        return bush;
    };
    this.drops = function(bush) {
        // TODO: bush drop
        // remove item from holds:[]
        // add to tile debris
    };
    this.dies = function(bush) {
        // TODO: bush dies
        // test for death (age, crowding)
        // remove if true
    };
});

Plants.service('Tree', function (Items, Lists, $localStorage) {
    var service = this;
    // large sized plants that grow in groves
    this.new = function(init) {
        var tree = {
            type: 0, // 2:nuts, 1:fruit, 0:lumber for growth
            footprint: 5, // of 100 space taken up in a tile
            stage: 0, // 0:seed, 1:seedling, 2:sapling, 3:adult
            age: 0, // age for growth checks
            growthRate: 1, // ratio for aging
            holds: {}, // stored items for drops
            color: "green",
            icon: "tree",
            id: Items.makeID(),
            label: "tree",
            movement: false,
            pos: {x: 0, y: 0},
            size: 0
        };
        angular.extend(tree, init);
        return tree;
    };
    this.newNut = function() {
        return this.new({type: 2});
    };
    this.newFruit = function() {
        return this.new({type: 1});
    };
    var inRange = function (e1, e2, range) {
        if (Math.abs(e2.pos.x - e1.pos.x) < range
                && Math.abs(e2.pos.y - e1.pos.y) < range
                && Math.sqrt(Math.pow((e2.pos.x - e1.pos.x), 2) + Math.pow((e2.pos.y - e1.pos.y), 2)) < range) {
            return true;
        }
        return false;
    };
    var like = function (origin, specifically, rng) {
        var ents = [];
        var range = rng || 10;
        var searchIn = Lists.withinRange($localStorage.map, origin.pos, {width: 2 * range, height: 2 * range});
        angular.forEach(searchIn, function (ent) {
            ent = $localStorage.entities[ent];
            if (ent) {
                if (inRange(ent, origin, range))
                    var stillgood = true;
                angular.forEach(specifically, function (k, v) {
                    if (ent[k] !== v) {
                        stillgood = false;
                    }
                });
                if (stillgood)
                    ents.push(ent);
            }
        });
        return ents;
    };
    var toSeedling = function(tree) {
        // TODO: change attributes to make a seedling
        // add .branches
        tree.stage++;
        tree.size++;
        return tree;
    };
    var toSapling = function(tree) {
        // TODO: change attributes to make a sapling
        tree.stage++;
        tree.size++;
        return tree;
    };
    var toAdult = function(tree) {
        // TODO: change attributes to make a adult
        // define maxsize
        tree.stage++;
        tree.size++;
        tree.holds = {seeds: 0};
        return tree;
    };
    var checkEnvironment = function(tree) {
        switch (tree.stage) {
            case 0: // seeds can grow if there are less than 3 seedlings      
//                if (Tile.numOfType(tree.tile, 'TREE', 1) > 2) {
//                    return false;
//                }
                if (like(tree, {label: "tree", stage: 1}, 20).length > 2) {
                    return false;
                }
                break;

            case 1: // seedling to sapling
                // only one allowed per m
//                if (Tile.numOfType(tree.tile, 'TREE', 2) > 0) { // tile to check, type of entity, stage
//                    return  false;
//                }
                if (like(tree, {label: "tree", stage: 2}, 20).length > 0) {
                    return false;
                }
                break;
            case 2: // sapling to adult
                // only one allowed per 1m radius
//                var tiles = [tree.tile].push(Tile.getNeighbors(tree.tile, 1));
//                for (var i = 0; i < tiles.length; i++) {
//                    if(Tile.numOfType(tiles[i], 'TREE', 3) > 0) {
//                        return false;
//                    }
//                }
                if (like(tree, {label: "tree", stage: 3}, 60).length > 0) {
                    return false;
                }
                break;
            case 3: // adult is always good, once grown
        }
        // looks good
        return true;
    };
        // TODO: finish trees 
        this.grows = function(tree){
            tree.age+=tree.growthRate;
            if(tree.age > 7 && tree.stage===0){
                // grow to seedling
                if(checkEnvironment(tree)) {
                    tree = toSeedling(tree);
            } else if (tree.age > 3) {
                service.dies(tree);
                }
            } else if (tree.age > 30 && tree.stage===1){
                // grow to sapling
                if(checkEnvironment(tree)) {
                    tree = toSapling(tree);
                } else if (tree.age > 730) {
                service.dies(tree);
                } else {
                    // add a few branches
                }
            } else if (tree.age > 60 && tree.stage===2){
                // grow to adult
                if(checkEnvironment(tree)) {
                tree = toAdult(tree);
            } else if (tree.age > 7300) {
                service.dies(tree);
            }
        } else if (tree.age > 73000) {
            service.dies(tree);
        } else if (tree.age > 80) {
            // gain seeds
                if (Math.random() > .9) {
                    tree.holds.seeds++;
                }
                if (tree.holds.seeds > 10) {
                    // drop seeds
                    for (var i = 0; i < 10; i++) {
                    var newSeed = {pos: {
                            x: tree.pos.x,
                            y: tree.pos.y
                        }};
                        var castOff = {
                            x: Math.round(Math.random() * 150 - 75),
                            y: Math.round(Math.random() * 150 - 75)
                        }; // just for now
                    }
                    if (Math.abs(castOff.x) > 10 && Math.abs(castOff.y) > 10) {
                        newSeed.pos.x += castOff.x;
                        newSeed.pos.y += castOff.y;
                    newSeed = service.new(newSeed);
                        $localStorage.entities[newSeed.id] = newSeed;
                    }
                    tree.holds.seeds = 0;
                }
                // add a few branches
                }
        };
    this.drops = function(tree) {
        // TODO: tree drop
        // remove item from holds:[]
        // add to tile debris
    };
    this.dies = function(tree) {
        // TODO: tree dies
        // test for death (age, crowding)
        // remove if true

        // just die for now
        console.log(tree);
        delete $localStorage.entities[tree.id];
    };
});