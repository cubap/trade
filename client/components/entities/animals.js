var Animals = angular.module('tgAnimals', ['tgElements']);

Animals.service('Turn', function($filter,$q,Action,Measure) {
    // Animal actions, full turn
    var act = this;
    var eat = function(critter, detection) {
        var deferred = $q.defer();
        Search.find('food', critter.loc, detection).then(function(food) {
            if (food.length) {
                food = Measure.risk(food, critter, detection);
                // TODO: move to and eat nearest low risk food
                deferred.resolve(critter);
            } else {
                deferred.reject("No food");
            }
        },function(err){
            deferred.reject("Failed to eat:" + err);
        });
        return deferred.promise;
    };
    var drink = function(critter, detection) {
        var deferred = $q.defer();
        Search.find('water', critter.loc, detection).then(function(water) {
            if (water.length) {
                water = Measure.risk(water, critter, detection);
                deferred.resolve(critter);
            } else {
                deferred.reject("No water");
            }
        });
        return deferred.promise;
    };
    var indexNotMoreThan = function(array, val) {
        for (var i = 0; i < array.length; i++) {
            if (val > array[i]) {
                continue;
            }
            return i;
        }
    };
    var updatePriorities = function(critter, config) {
        // check for hunger, thirst, sex, security, health, endurance
        var queue = critter.queue = [];
        // hunger
        var hungerIndex = indexNotMoreThan(critter.tolerates.hunger.thresholds, critter.drives.hunger);
        critter.queue.push({
            priority: critter.tolerates.hunger.priority[hungerIndex],
            action: critter.tolerates.hunger.action
        });
        // thirst
        var thirstIndex = indexNotMoreThan(critter.tolerates.thirst.thresholds, critter.drives.thirst);
        critter.queue.push({
            priority: critter.tolerates.thirst.priority[thirstIndex],
            action: critter.tolerates.thirst.action
        });
        // rest
        var restIndex = indexNotMoreThan(critter.tolerates.rest.thresholds, critter.drives.rest);
        critter.queue.push({
            priority: critter.tolerates.rest.priority[restIndex],
            action: critter.tolerates.rest.action
        });
        // sex
        var sexIndex = indexNotMoreThan(critter.tolerates.sex.thresholds, critter.drives.sex);
        critter.queue.push({
            priority: critter.tolerates.sex.priority[sexIndex],
            action: critter.tolerates.sex.action
        });
        // security
        var securityIndex = indexNotMoreThan(critter.tolerates.security.thresholds, critter.drives.security);
        critter.queue.push({
            priority: critter.tolerates.security.priority[securityIndex],
            action: critter.tolerates.security.action
        });
        // health
        var healthIndex = indexNotMoreThan(critter.tolerates.health.thresholds, critter.trait.health / critter.trait.healthMax);
        critter.queue.push({
            priority: critter.tolerates.health.priority[healthIndex],
            action: critter.tolerates.health.action
        });
        // endurance
        var enduranceIndex = indexNotMoreThan(critter.tolerates.endurance.thresholds, critter.trait.endurance / critter.trait.enduranceMax);
        critter.queue.push({
            priority: critter.tolerates.endurance.priority[enduranceIndex],
            action: critter.tolerates.endurance.action
        });
    };
    this.nextAction = function(critter) {
        var deferred = $q.defer();
        if (critter.queue.length) {
            critter.queue = $filter('orderBy')(critter.queue.sort, 'priority');
        } else {
            critter.queue = [{
                priority: 20,
                action: act.idle
            }];
        }
        var doing = critter.queue.pop();
        doing.action(critter,doing.config).then(function(critter){
            deferred.resolve(critter);
        },function(err){
            deferred.reject(err);
        });
        return deferred.promise;
    };
    this.forage = function(critter, config) {
        var deferred = $q.defer();
        // careful movement
        // speed is 70%, detection is high, notices food 
        // and drink and predators spiral search and consume until full
        var speed = config && config.speed || .7;
        var detection = config && config.speed || 1;
        // if food, drink, pursue
        // movement or action
        var f = (critter.drive.hunger > critter.drive.thirst)
                ? [eat, drink] : [drink, eat];
        f[0](critter, detection).then(function() {
            },function(rejected){
                console.log(rejected);
            f[1](critter, detection);
        }).then(function() {
            // Pursued food, finish action
                Action.tick(critter);
            },function(err){
            // No food or drink, move on
            console.lot(err);
            // Movement to new Tile (consider predator, trail, speed)
        }).finally(function() {
            // update priorities
            updatePriorites(critter)
        });

        // once moved, update priorities
        if (Search.predator().distance(critter.loc) < 2 * critter.movement) {
            // raise priority
            critter.drive.security += 100;
        }
        if (critter.drive.hunger + critter.drive.thirst === 0) {
            // sated, go idle
        }
        return deferred.promise;
    };
    this.idle = function(critter,config) {
        // no movement
        // priority is 20, so hunger, injury or encroachment will cause
        // response as hideHeal is 40, idle time will always seek cover 
        if (Action.override(critter.queue)) {
            // check for other priorities
            critter.queue[0].action(); // do new priority
        }
        if (Search.cover().distance < 2 * critter.movement / (100 - critter.security) / 100) {
            // move to cover
        }
        // pass time
    };
    this.wander = function(critter,config) {
//                    intentional movement
//		speed is 100%, detection is medium, notices cover, food, and predators
//	radial search from last shelter, stay within 200m
//	explore more when finding regions between 2 and 20 peers
//	priority 80 until completely explored within two days
    };
    this.shelter = function(critter,config) {
//move at regular speed until arriving, then idle
//		speed is 100%, detection is medium, notices cover, food, and predators
//	priority begins at 40, but grows quickly
//	cycle through memory list of cover from best to worst
//	reevaluate each for suitability upon arriving
//		check cover value		// 1:exposed - 100:completely hidden
//		check max population		// 8 squirrels in a tree, 3 in a bush
//		check environment		// nearby predators will deter, food/water improves
//		check memory		// a previous shelter will be more well liked
    };
    this.sleep = function(critter,config) {
//	no movement, but must be sheltered
//	detection is very low, predators and attacks only
//	wakes on a schedule or on event
//	time from last sleep can cause problems
    };
});

Animals.service('Prey', function(Turn, Search) {
    // Prey are mobile animals which gather food and avoid being hunted
    this.new = function(tid) {
        var critter = this;
        return {
            home: null, // home tile for animal, must be sought out
            growthRate: 0, // TODO: include growth and life stages for animals
            loc: tid, // this tile id, new animals always start somewhere
            holds: [], // stored items for drops
            queue: [], // actions to complete
            drive: {// behavior motivators
                hunger: 0, // food need
                thirst: 0, // water need
                rest: 0, // sleep need
                sex: 0, // reproduction need
                security: 0 // cover need
            },
            trait: {// action modifiers
                healthMax: 10, // alive hitpoints
                health: 10, // current
                enduranceMax: 10, // fatigue hitpoints
                endurance: 10, // current
                stealth: 15, // hideability modifier
                movement: 2.00 // speed modifier
            },
            tolerates: {
                // each priority-changing possibility with
                // thresholds - array of points of inflection (in 100%)
                // priorities - matched array of priority at thresholds
                // action - remedy sought when priority is high
                hunger: {
                    thresholds: [0, 30, 60, 90, 100],
                    priorities: [0, 15, 50, 80, 100],
                    action: act.forage
                },
                thirst: {
                    thresholds: [0, 30, 50, 80, 100],
                    priorities: [0, 15, 50, 80, 100],
                    action: act.forage
                },
                rest: {
                    thresholds: [0, 75, 85, 95, 100],
                    priorities: [0, 20, 40, 60, 100],
                    action: act.sleep
                },
                sex: {
                    thresholds: [0, 90, 100],
                    priorities: [0, 60, 80],
                    action: act.reproduce
                },
                security: {
                    thresholds: [0, 30, 60, 100],
                    priorities: [0, 50, 85, 100],
                    action: act.shelter
                },
                health: {// of 100% current/max
                    thresholds: [0, 30, 60, 100],
                    priorities: [0, 50, 85, 100],
                    action: act.hideHeal
                },
                endurance: {// of 100% current/max
                    thresholds: [0, 30, 60, 100],
                    priorities: [0, 50, 85, 100],
                    action: act.hideHeal
                }
            }
        };
    };
});

Animals.service('Predator', function(Action, Search) {

});