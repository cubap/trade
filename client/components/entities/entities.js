var Entities = angular.module('tgEntities', [
    'tgElements', //all discrete passive elemental objects
    'tgVegetation', // all unmoving, automated objects
    'tgAnimals', // all active, automated objects
    'ngStorage'
]);

Entities.service('EntitiesService', function (PlayerService, $localStorage, mapLimits, Lists, Items, Tree) {
    this.getVisible = function (center, extent) {
        return Lists.withinRange($localStorage.map, center, extent);
        var visible = [];
        var bound = {
            left: center.x - extent.width / 2,
            right: center.x + extent.width / 2,
            top: center.y - extent.height / 2,
            bottom: center.y + extent.height / 2
        };
        var tx = Math.floor(bound.left / 20) * 10;
        var ty = Math.floor(bound.top / 20) * 10;
        while (ty < bound.bottom) {
            while (tx < bound.right) {
                for (var each in $localStorage.map['x' + tx + 'y' + ty]) {
                    visible.push(each);
                }
                tx += 20;
            }
            tx = Math.floor(bound.left / 20) * 10;
            ty += 20;
        }
        return visible;
    };
    this.spawn = function (type, config) {
        // random pos
        var newEnt = config || {};
        newEnt.pos = {
            x: Math.round(Math.random() * mapLimits['x+']),
            y: Math.round(Math.random() * mapLimits['y+'])
        };
        var newEnt;
        switch (type) {
            case "tree":
                newEnt = Tree.new(newEnt);
                break;
            case "squirrel":
                angular.extend(newEnt, {
                    type: 0, // 0:squirrel, 1:fox, 2:deer, 3:wolf
                    stage: 2, // 0:baby, 1:young'un, 2:adult
                    age: 30,
                    growthRate: 1,
                    holds: {PELT: 1, BONES: 1, MEAT: 1, OFFAL: 1},
                    color: "brown",
                    icon: "bicycle",
                    id: Items.makeID(),
                    label: "squirrel",
                    movement: "coinFlipMove",
                    size: 2
                });
        }
        $localStorage.entities[newEnt.id] = newEnt;
        var addTo = "x" + Math.floor(newEnt.pos.x / 20) * 10 + "y" + Math.floor(newEnt.pos.y / 20) * 10;
        if ($localStorage.map[addTo]) {
            $localStorage.map[addTo].push(newEnt.id);
        } else {
            $localStorage.map[addTo] = [newEnt.id];
        }
        return newEnt;
    };
});