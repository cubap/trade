'use strict';

angular.module('tradeGame')
        .controller('menuController', function ($scope, GameService, PlayerService, EntitiesService, $localStorage) {
            $scope.game = GameService.get();
            $scope.players = PlayerService.getList();
            $scope.age = function (date) {
                var seconds = Math.floor((Date.now() - date) / 1000);
                var interval = Math.floor(seconds / 31536000);
                if (interval > 1) {
                    return interval + " years";
                }
                interval = Math.floor(seconds / 2592000);
                if (interval > 1) {
                    return interval + " months";
                }
                interval = Math.floor(seconds / 86400);
                if (interval > 1) {
                    return interval + " days";
                }
                interval = Math.floor(seconds / 3600);
                if (interval > 1) {
                    return interval + " hours";
                }
                interval = Math.floor(seconds / 60);
                if (interval > 1) {
                    return interval + " minutes";
                }
                return Math.floor(seconds) + " seconds";
            };
            $scope.addPlayer = function () {
                var player = {
                    creation: Date.now(),
                    label: "", // self-appointed name
                    titles: [], // earned titles, accolades, affiliations
                    attributes: {// strength, intelligence, endurance, health, hunger, thirst
                        strength: 100,
                        endurance: 100,
                        focus: 100,
                        health: 100,
                        hunger: 0,
                        thirst: 0
                    },
                    personality: {// reputation from 0 for some things
                        alignment: 0, // good vs evil
                        generosity: 0, // charity vs theft
                        aggression: 0, // defensive vs unprovoked
                        membership: 0 // social life vs isolation
                    },
                    vector: {
                        speed: 0, // m/s movement at the end of last tick
                        active: [] // current ongoing behavior[s]
                    },
                    worn: {
                        rightHand: null,
                        leftHand: null,
                        head: null,
                        face: null,
                        ears: null,
                        neck: null,
                        mouth: null,
                        eyes: null,
                        shoulders: null,
                        chest: null,
                        back: null,
                        leftArm: null,
                        rightArm: null,
                        waist: null,
                        hips: null,
                        crotch: null,
                        butt: null,
                        leftLeg: null,
                        rightLeg: null,
                        leftFoot: null,
                        rightFoot: null,
                        holdRight: 't1',
                        holdLeft: 't2'
                    },
                    inventory: {// limited by size and weight tolerance of container
                        // carried and worn items
                        // Items at the top level here are either discrete or containers
                        // Items have size and weight
                        items: [],
                        weight: {
                            current: 0,
                            max: 30 // kilograms
                        },
                        // Worn items no longer impact carried volume and items that have
                        // been bundled together can reduce the effective carried volume.
                        // Anything in a container does not have a carried volume and likely
                        // has a reduction in effective weight.
                        volume: {
                            current: 0,
                            max: 100 // cubic decimeters
                        }
                    },
                    skills: {
//        Each skill refers up to a larger skill table. In this list,
                        // just the id and proficiency is held, but the full skill resembles:
                        // {
                        //   id: unique code family-category-skill,
                        //   label: human string like "exploring",
                        //   description: extended memo of skill,
                        //   proficiency: simple int,
                        //   config: {} unknown, but sets effects and interactions with the skill
                        // }
                        /*
                         * Check for current proficiency by finding the value of the key[skillID]
                         */
                    },
                    memory: {
                        // Impacts user interface and available options.
                        // Memories have a persistence that fades in the short term, but
                        // can be locked away for the long term.
                        vault: {},
                        recent: {
                            // events have:
                            // time, persistence, iteration, impact, label, type
                            //events: [],
                            // skill may affect acces to these details, but locations have:
                            // coordinates, label, type, iteration, persistence
                            //locations: [],
                            // people have:
                            // {Reputation} and hidden unique id and a possibly a shared label
                            //people: [],
                            // Stories are complicated and I don't know what to do with them yet
                            //stories: []
                        }
                    },
                    behavior: {
                        // Guides the AI of the Player when not logged in as it does the actions
                        // of all NPEs. As Player develops better planning, more options exist.

                        // instincts override anything else and have: threshold, activity
                        instincts: {},
                        // priorities have: label, action or sequence, threshold
                        priorities: [],
                        // time:activity pair for things that happen through the day
                        schedule: [],
                        // interrupts default behavior with planning actions
                        intent: [],
                        // queue can be filled with planned tasks and will be executed until
                        // the priority is overridden by something else
                        queue: []
                    }
                };
                player.label = prompt('Called?'); // TODO: pull into a modal with char gen
                if (player.label.length) {
                    player.id = PlayerService.new(player);
                }
            };
            $scope.deletePlayer = PlayerService.destroy;
            $scope.selectPlayer = function (pid) {
                $scope.player = PlayerService.select(pid);
            };
            $scope.resetEntities = function () {
                $localStorage.entities = {};

                // some trees
                for (var i = 0; i < 15; i++) {
                    EntitiesService.spawn("tree");
                }
                // some squirrels
                for (var i = 0; i < 10; i++) {
                    EntitiesService.spawn("squirrel");
                }
            };
        })

        .service('GameService', function ($localStorage, Items, PlayerService, Nearby, EntitiesService) {
            var service = this;
            var $storage = $localStorage.$default({
                game: {},
                deletedGame: {},
                players: {},
                map: {},
                entities: {},
                items:
                        {t1: {
                                id: "t1",
                                icon: "fa-wrench",
                                label: "spanner"
                            },
                            t2: {
                                id: "t2",
                                icon: "fa-umbrella",
                                label: "parasol"
                            }
                        }
            });
            var game = $storage.game;
            var init = function (props) {
                if (!game.id) {
                    game = {
                        id: Items.makeID(),
                        player: {},
                        map: {}
                    };
                }
                angular.extend(game, props);
            };
            this.get = function () {
                return game;
            };
            this.getEntities = function () {
                return $storage.entities;
            };
            this.getItem = function (id) {
                return id ? $storage.items[id] : $storage.items;
            };
            this.newEvent = function (evt) {
            };
            this.destroy = function () {
                if (confirm("We're talking irrevocable utter destruction of this game. Okay?")) {
                    $storage.deletedGame = angular.copy(game);
                    game = {};
                    init();
                }
            };
            init();
        })
        .service('PlayerService', function ($localStorage, Items) {
            var service = this;
            var $storage = $localStorage.$default({
                game: {},
                deletedGame: {},
                players: {}
            });
            var players = $storage.players;
            var currentPlayer;
            this.new = function (player) {
                var id = Items.makeID();
                player.id = id;
                players[id] = player;
                return id;
            };
            this.get = function (pid) {
                if (pid) {
                    return players[pid];
                } else if (currentPlayer) {
                    return currentPlayer;
                } else {
                    throw Error("No player ID provided and no currentPlayer");
                }
            };
            this.destroy = function (pid) {
                if (confirm("We're talking irrevocable utter destruction of this player. Okay?")) {
                    delete(players[pid]);
                }
            };
            this.select = function (pid) {
                return currentPlayer = players[pid];
            };
            this.getList = function () {
                return players;
            };
        })

        .directive();
