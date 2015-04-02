var Elements = angular.module('tgElements', []);

Elements.service('Tile', function(Map) {
    // Each section of the map, let's start with hex of 1m
    this.new = function() {
        return {
            position: [], // hex coordinates {x,y,z}
            base: 0, // 0:dirt, 1:rock, 2:sand, 3:water
            history: [], // events on this space
            holds: [], // debris laying around
            contains: [], // discrete entities like structures and plants on tile
            vacant: 100 // percent of space not covered by structures or turf
                    // owner, signs, paths, makeup (fertility, danger, etc?)
        };
    };
    this.findInHold = function(tile,name,all){
        var hold = tile.holds.length;
        var items = [];
        for(var i=o;i<hold;i++){
            if(tile.holds[i].baseType === name){
                items.push(name);
                if(all){
                    continue;
                } else {
                  return items.join('');
                }
            }
        }
        return items;
    };
    this.getNeighbors = function(tile) {
        var t = (angular.isArray(tile)) ? tile : tile.position;
        var neighbors = [
            Tile.getByPosition(t.x + 1, t.y - 1, t.z),
            Tile.getByPosition(t.x, t.y + 1, t.z - 1),
            Tile.getByPosition(t.x - 1, t.y, t.z + 1),
            Tile.getByPosition(t.x - 1, t.y + 1, t.z),
            Tile.getByPosition(t.x, t.y - 1, t.z + 1),
            Tile.getByPosition(t.x + 1, t.y, t.z - 1)
        ];
        return neighbors;
    };
    this.getLocalNeighbors = function(tile, d) {
        var coordinates = [];
        var t = tile.position;
        for (var dx = -d; dx < d; dx++) {
        for (var dy = -d; dy < d; dy++) {
        for (var dz = -d; dz < d; dz++) {
               if(dx+dy+dz===0){
                   coordinates.push({
                    x: t.x + dx,
                    y: t.y + dy,
                    z: t.z + dz
                });
            }
        }
    }
        }
        // for each -N ≤ Δx ≤ N:
        //    for each max(-N, -Δx-N) ≤ Δy ≤ min(N, -Δx+N):
        //        Δz = -Δx-Δy
        //        results.append(H.add(Cube(Δx, Δy, Δz)))
        var tiles=[];
        angular.forEach(coordinates,function(c){
           tiles.push(Tile.getByPosition(c.x,c.y,c.z)); 
        });
    };
    this.getByPosition = function(x,y,z){
      if(x+y+z !== 0){
          throw Error("Invalid Hex position");
      }
      for(var h=0;h<Map.tiles.length;h++){
          if(Map.tiles[h].x === x &&
                  Map.tiles[h].y === y &&
                  Map.tiles[h].z === z) {
              return Map.tiles[h];
          }
      }
    };
    // TODO:finish Tile
});


