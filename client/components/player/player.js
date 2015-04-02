var Player = angular.module('tgPlayer', [
//    'tgInventory', // carried, worn, resources and creations
//    'tgAbilities', // skills, knowledge, stats
//    'tgHistory', // logs and memory
//    'tgActions', // methods for interaction
//    'tgReputation' // player personality and appearance to others
]);

//Player.service('PlayerService',function(Attributes,Reputation,Inventory,Information,Skills,Memory,Behavior){
//
//});
Player.service('Attributes',function(){
   // mutable characteristics relating to physical and mental state
    this.strength = 100;
    this.endurance = 100;
    this.focus = 100;
    this.health = 100;
    this.hunger = 0;
    this.thirst = 0;
});

Player.service('Reputation',function(){
    // noticable characteristics to other players, stored external to player
    this.alignment = 0;
    this.generosity = 0;
    this.aggression = 0;
    this.membership = 0;
    // this.label can be voluntarily given as well
});

Player.service('Inventory',function(ItemService){
   // carried and worn items
   // Items at the top level here are either discrete or containers
   // Items have size and weight
   this.items = [];
   this.weight = {
       current: 0,
       max: 30 // kilograms
   };
   // Worn items no longer impact carried volume and items that have 
   // been bundled together can reduce the effective carried volume.
   // Anything in a container does not have a carried volume and likely
   // has a reduction in effective weight.
   this.volume = {
       current: 0,
       max: 100 // cubic decimeters
   };
});

Player.service('Information', function (){
    this.vector = {
        speed: 0, // m/s movement at the end of last tick
        active: [] // current ongoing behavior[s]
    };
    this.label = ""; // self-appointed name
    this.titles = []; // earned titles, accolades, affiliations
    this.id = 0; // unique identifier
});

Player.service('Skills', function(){
   // Each skill refers up to a larger skill table. In this list,
   // just the id and proficiency is held, but the full skill resembles:
   // {
   //   id: unique code family-category-skill,
   //   label: human string like "exploring",
   //   description: extended memo of skill,
   //   proficiency: simple int,
   //   config: {} unknown, but sets effects and interactions with the skill
   // }
    this.list = []; 
    /*
     * Checks for current skill and returns proficiency.
     * @param skill int Identifier for skill
     * @return proficiency int Rating for skill
     */
    this.skillCheck = function(skill) {
        var proficiency = 0;
        var num = this.list.length;
        for(var i=0;i<num;i++){
            if (this.list[i].id === skill) {
                proficiency = this.list[i].proficiency;
                break;
            }
        }
        return proficiency;
    };
});

Player.service('Memory',function(){
   // Impacts user interface and available options.
   // Memories have a persistence that fades in the short term, but
   // can be locked away for the long term.
   this.vault = [];
   this.recent = {
       // events have:
       // time, persistence, iteration, impact, label, type
       events: [],
       // skill may affect acces to these details, but locations have: 
       // coordinates, label, type, iteration, persistence
       locations: [],
       // people have: 
       // {Reputation} and hidden unique id and a possibly a shared label
       people: [],
       // Stories are complicated and I don't know what to do with them yet
       stories: []
   };
});

Player.service('Behavior', function(){
   // Guides the AI of the Player when not logged in as it does the actions
   // of all NPEs. As Player develops better planning, more options exist.
   
    // instincts override anything else and have: threshold, activity
    this.instincts = [];
    // priorities have: label, action or sequence, threshold
    this.priorities = [];
    // time:activity pair for things that happen through the day
    this.schedule = [];
    // interrupts default behavior with planning actions
    this.intent = [];
    // queue can be filled with planned tasks and will be executed until
    // the priority is overridden by something else
    this.queue = [];
});