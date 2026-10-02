// #131: the two vocabularies that never met.
//
// `pawn.behaviorState` is one slot, and two unrelated questions got written into
// it. The goal system answers "what am I doing" (`PawnGoals.setCurrentGoal` stamps
// a label whenever a goal starts); a handful of direct assignments in `Pawn.js`
// answer "what did I just swallow". Meanwhile `PawnNeeds.modifyRateForActivity()`
// compared that slot against fourteen strings, and nine of them could never be in
// it: `sleeping`, `building_shelter`, `in_shelter`, `threatened`, `isolated`,
// `completing_goal`, `improving_living`, `in_comfortable_space` - and `resting`,
// which only animals ever get (see `AnimalBehavior.js`). So a third of the need
// model was dead arithmetic, including the whole promise that shelter makes you
// safer and that a night's sleep is worth more than standing still.
//
// The nine are not all the same kind of mistake. `in_shelter`, `threatened`,
// `isolated` and `in_comfortable_space` are not activities at all; they are facts
// about where the pawn is standing, and a slot that is overwritten the moment the
// next goal starts was never going to hold them. So instead of inventing nine new
// assignments, the two vocabularies are written down separately here: what the
// goal system can say (`GOAL_BEHAVIOR_MAP` + `DIRECT_BEHAVIOR_STATES`), and what
// the world has to be read for (`SITUATION_STATES`, derived once per needs update
// by `PawnNeeds.readSituation()`).
//
// `solo/test/need-behaviors.test.js` fails if the need model asks for a name that
// neither list can produce, which is the actual bug here: two files agreeing on a
// string is not the same as two files checking they agree.

/**
 * Goal type -> the label the goal system stamps on `pawn.behaviorState`.
 * Exported so the guard test can tell "the map has an entry for this goal" apart
 * from "the map has an entry whose value nothing can read".
 */
export const GOAL_BEHAVIOR_MAP = {
    'find_food': 'seeking_food',
    'find_water': 'seeking_water',
    'rest': 'seeking_rest',
    'seek_shelter': 'seeking_shelter',
    'socialize': 'seeking_social',
    'negotiate_group': 'negotiating',
    'work': 'working',
    'explore': 'exploring',
    'build_structure': 'building',
    'establish_trade': 'trading',
    'map_territory': 'surveying',
    'train_skill': 'teaching',
    'teach_skill': 'teaching',
    'apprentice_skill': 'learning',
    'observe_skill': 'observing',
    'follow_leader': 'following',
    'protect_target': 'guarding',
    'escort_target': 'escorting',
    'mark_target': 'coordinating',
    'obey_leader': 'obeying',
    'craft_item': 'crafting',
    'craft_cordage': 'crafting',
    'craft_sharp_stone': 'crafting',
    'craft_poultice': 'crafting',
    'gather_materials': 'gathering',
    'stage_build_materials': 'hauling',
    'gather_specific': 'gathering',
    'soak_fiber': 'hauling',
    'search_resource': 'exploring',
    'collaborative_craft': 'collaborating',
    'accumulate_valuables': 'crafting'
}

/**
 * Labels written by code outside the goal system - the pawn swallowing food or
 * water, chatting, or standing with nothing to do. `gathering` is in both lists
 * because a gather goal stamps it and `Pawn.gatherFromResource` restamps it.
 */
export const DIRECT_BEHAVIOR_STATES = ['eating', 'drinking', 'socializing', 'gathering', 'idle']

/** Every value `pawn.behaviorState` can hold for a pawn. */
export const PAWN_BEHAVIOR_STATES = new Set([
    ...Object.values(GOAL_BEHAVIOR_MAP),
    ...DIRECT_BEHAVIOR_STATES
])

/**
 * Facts about the pawn's situation that no activity label can carry, because they
 * outlive the goal that was running when they became true. `PawnNeeds` derives
 * these from the world into `needs.situations`; they are never written to
 * `behaviorState`.
 */
export const SITUATION_STATES = [
    'resting',                 // lying at a rest site, asleep rather than heading for one
    'in_shelter',              // close enough to cover to count as under it
    'threatened',              // a predator within arm's reach
    'isolated',                // the only pawn around, and not by choice
    'in_comfortable_space'     // resting on something the pawn built well
]

/**
 * How far each situation reaches. The shelter figure is the one
 * `Pawn.registerRestOutcome()` already used to decide what a night's sleep was
 * worth, so resting and the need model agree about where the edge of a roof is.
 */
export const SITUATION_RADIUS = {
    shelter: 26,
    company: 30,
    threat: 24
}

/** A rest bonus is clamped the same way `Structure.createShelter()` clamps quality. */
export const REST_BONUS_RANGE = { min: 0.5, max: 2 }

/**
 * Entities carry `tags` as a Set (see `Structure`) or as an array (see the
 * generated flora) depending on who made them, so the one question every
 * "am I under cover?" reader asks needs a helper rather than a guess.
 */
export function hasTag(entity, tag) {
    const tags = entity?.tags
    if (!tags) return false
    if (Array.isArray(tags)) return tags.includes(tag)
    if (typeof tags.has === 'function') return tags.has(tag)
    return tags[tag] === true
}

/**
 * The label a goal stamps. Unknown goal types idle rather than keep the label of
 * the goal before them, which is the pre-existing behaviour of
 * `PawnGoals.getBehaviorForGoal()` and is preserved by moving it here.
 */
export function behaviorForGoal(goal) {
    if (!goal) return 'idle'
    return GOAL_BEHAVIOR_MAP[goal.type] || 'idle'
}

export default { GOAL_BEHAVIOR_MAP, DIRECT_BEHAVIOR_STATES, PAWN_BEHAVIOR_STATES, SITUATION_STATES, SITUATION_RADIUS, REST_BONUS_RANGE, behaviorForGoal, hasTag }
