'use strict';

angular.module('tradeGame')
        .constant("mapLimits", {
            "y-": 0,
            "y+": 1000,
            "x-": 0,
            "x+": 1000
        })
        .constant("MOVEMENT", {
            coinFlipMove: function (p) {
                if (Math.random() < .5) { // coin flip for now
                    (Math.random() < .5) ? p.x++ : p.x--;
                } else {
                    (Math.random() < .5) ? p.y++ : p.y--;
                }
                return p;
            }
        })
        .controller('hudController', function ($scope, $localStorage, PlayerService, EntitiesService, Nearby, GameService) {
            $scope.display = {};
            $scope.notifications = [
                {
                    id: "_somethingHere",
                    title: "Event",
                    icon: "fa-exclamation",
                    data: "blah blah k'pah"
                }, {
                    id: "_somethingElseHere",
                    title: "Log",
                    icon: "fa-info-circle",
                    data: "blah blah k'pah"
                }
            ];
            $scope.player = PlayerService.get();
            $scope.getTool = function (id) {
                return $localStorage.items[id];
            };
            $scope.gm = {
                width: document.getElementsByTagName("game-map")[0].offsetWidth,
                height: document.getElementsByTagName("game-map")[0].offsetHeight
            };
            $scope.player.pos = {x: $scope.gm.width / 2, y: $scope.gm.height / 2};
            $scope.visibleEntities = function () {
                return EntitiesService.getVisible($scope.player.pos, $scope.gm);
            };
            $scope.$on('player-position', function ($event, pos) {
                $scope.display.resources = Nearby.update($scope.visibleEntities(), $scope.player);
                $scope.$apply();
            });
            var getEnt = function (eid) {
                return angular.isObject(eid) ? eid : GameService.getEntities()[eid];
            };
            $scope.getEnts = function (eids) {
                var ents = [];
                angular.forEach(eids, function (id) {
                    ents.push($localStorage.entities[id]);
                });
                return ents;
            };
        })
        .controller('gameMapController', function ($scope, GameService, PlayerService, Nearby, $rootScope, mapLimits, MOVEMENT, $localStorage, Tree) {
            var playerAt = $scope.player.pos;
            var checkForPlayer = function (ent) {
                var player = PlayerService.get();
                var fleedom = false;
                if (Nearby.noticed(player, ent, 20)) {
                    // noticed player, run away
                    if (Math.abs(player.pos.x - ent.pos.x) > Math.abs(player.pos.y - ent.pos.y)) {
                        // flee y
                        fleedom = (player.pos.y > ent.pos.y)
                                ? {y: ent.pos.y - 2}
                        : {y: ent.pos.y + 2};
                    } else {
                        // flee x
                        fleedom = (player.pos.x > ent.pos.x)
                                ? {x: ent.pos.x - 2}
                        : {x: ent.pos.x + 2};
                    }
                }
                return fleedom;
            };
            var keys = {};
            var init = function () {
                $scope.stage = new createjs.Stage("gameMap");
                createjs.Ticker.on("tick", tick);
                createjs.Ticker.setFPS(30);
                document.onkeydown = keydown;
                document.onkeyup = keyup;
            };
            function keydown(event) {
                keys[event.keyCode] = true;
            }

            function keyup(event) {
                keys[event.keyCode] = null;
            }

            var drawPlayer = function () {
                var g = new createjs.Graphics();
                g.setStrokeStyle(1);
                g.beginStroke(createjs.Graphics.getRGB(255, 255, 255));
                g.beginFill(createjs.Graphics.getRGB(205, 130, 0));
                g.drawCircle($scope.gm.width / 2, $scope.gm.height / 2, 6);
                var s = new createjs.Shape(g);
                s.x = 0;
                s.y = 0;

                $scope.stage.addChild(s);
            };
            var drawEntities = function () {
                var extent = {
                    left: playerAt.x - $scope.gm.width / 2,
                    top: playerAt.y - $scope.gm.height / 2
                };
                angular.forEach($scope.visibleEntities(), function (vis) {
                    var ent = $localStorage.entities[vis];
                    if (!ent) {
                        return false;
                    }
                    var x = ent.pos.x - extent.left;
                    var y = ent.pos.y - extent.top;
                    var g = new createjs.Graphics();
                    g.setStrokeStyle(1);
                    g.beginStroke(createjs.Graphics.getRGB(0, 0, 0));
                    g.beginFill(ent.color);
                    g.drawCircle(x, y, ent.size);
                    var s = new createjs.Shape(g);
                    s.x = 0;
                    s.y = 0;
                    s.name = ent.id;

                    $scope.stage.addChild(s);
                });
            };
            var enforceEdges = function (pos) {
                if (pos.x < mapLimits["x-"])
                    pos.x = mapLimits["x-"];
                if (pos.x > mapLimits["x+"])
                    pos.x = mapLimits["x+"];
                if (pos.y < mapLimits["y-"])
                    pos.y = mapLimits["y-"];
                if (pos.y > mapLimits["y+"])
                    pos.x = mapLimits["y+"];
            };
            var moveEntities = function () {
                if (!document.getElementsByTagName("game-map").length)
                    return false;
                angular.forEach($scope.visibleEntities(), function (vis) {
                    var ent = $localStorage.entities[vis];
                    if (!ent) {
                        return false;
                    }
                    if (ent.movement) {
                        var fleedom = checkForPlayer(ent);
                        if (fleedom) {
                            return angular.extend(ent.pos, fleedom);
                        }
                        MOVEMENT[ent.movement](ent.pos);
                        enforceEdges(ent.pos);
                    }
                });
            };
            var movePlayer = function () {
                if (!document.getElementsByTagName("game-map").length)
                    return false;
                $scope.gm = {
                    width: document.getElementsByTagName("game-map")[0].offsetWidth,
                    height: document.getElementsByTagName("game-map")[0].offsetHeight
                };
                if (keys[37] || keys[65])
                    playerAt.x -= 1; //DEBUG evaluate speed
                if (keys[38] || keys[87])
                    playerAt.y -= 1;
                if (keys[39] || keys[68])
                    playerAt.x += 1;
                if (keys[40] || keys[83])
                    playerAt.y += 1;
                if (keys[37] || keys[38] || keys[39] || keys[40]
                        || keys[65] || keys[68] || keys[83] || keys[87])
                    $rootScope.$broadcast("player-position", playerAt);
                enforceEdges(playerAt);
            };
            var growTrees = function () {
                angular.forEach($localStorage.entities, function (ent) {
                    if (ent.label === "tree") {
                        Tree.grows(ent);
                    }
                });
            };
            var tick = function () {
                
                $scope.stage.removeAllChildren();// DEBUG get children if exist is better
                movePlayer();
                growTrees();
                moveEntities();
                drawEntities();
                drawPlayer();
                $scope.stage.update();
            };
            init();
        })
        .service('Nearby', function ($localStorage) {
            var service = this;
            this.resources = [];
            this.noticed = function (seekEnt, searchEnt, range) {
                var e1 = angular.isObject(seekEnt) ? seekEnt : $localStorage.entities[seekEnt];
                var e2 = angular.isObject(searchEnt) ? searchEnt : $localStorage.entities[searchEnt];
                if (!e1 || !e2) {
                    return false;
                }
                if (Math.abs(e2.pos.x - e1.pos.x) < range
                        && Math.abs(e2.pos.y - e1.pos.y) < range
                        && Math.sqrt(Math.pow((e2.pos.x - e1.pos.x), 2) + Math.pow((e2.pos.y - e1.pos.y), 2)) < range) {
                    return true;
                }
                return false;
            };
            this.update = function (visible, player) {
                var ents = [];
                var range = 10;
                angular.forEach(visible, function (ent) {
                    if (service.noticed(ent, player, range))
                        ents.push(ent);
                });
                service.resources = ents;
                return service.resources;
            };

        });