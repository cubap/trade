import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Pawn from '../js/models/entities/mobile/Pawn.js'
import { teach } from '../js/models/entities/mobile/PawnLearning.js'

// #108: #101 left the sim with two skill verbs and a rule for choosing between
// them - `useSkill` for practice at something the pawn did, `increaseSkill` for
// everything else (structure auras, item effects, growth rules, tests). The rule
// was worthless if nothing enforced it, because the primitive is the easier call
// to write: it is shorter, it is already imported by muscle memory, and it does
// exactly what you mean right up until the day practice needs a curve and forty
// call sites are still paying raw numbers. So this file reads the sources.
//
// A source check is the only check available here. There is no runtime signal
// that distinguishes a payment for an act from a payment for standing next to a
// workshop - both move the same number by the same amount - so the distinction
// lives entirely in which name the caller typed, and only the text can be read
// for it.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const ACTOR_FILES = [
    'solo/js/models/entities/mobile/Pawn.js',
    'solo/js/models/entities/mobile/PawnGoals.js',
    'solo/js/models/entities/mobile/PawnLearning.js',
    'solo/js/models/entities/mobile/PawnMercantile.js',
    'solo/js/models/entities/mobile/PawnCivic.js',
    // #111: the landmark half of memory. It pays no skill today, which is
    // precisely the sort of claim this guard cannot make about a file it never
    // opens - so the memory module is in its scope now. It is also where #95's
    // "a place on the zero axes is still a place" rule lives, and the resource
    // half of memory needed that same rule (see pawn-memory.test.js).
    'solo/js/models/entities/mobile/PawnMemory.js'
]

// Payments an actor file may make with the primitive, `file#method` keyed, each
// one a deliberate exception rather than an oversight.
const NON_ACT_PAYMENTS = new Set([
    // useSkill is one line on top of the primitive; it has to call it sometime.
    'solo/js/models/entities/mobile/Pawn.js#useSkill',
    // A tincture's buffs and a beer's confidence are properties of the item, not
    // of the drinking.
    'solo/js/models/entities/mobile/Pawn.js#consumeFoodOrDrink',
    // Keeping regular hours is a condition the pawn is in, not a thing it does.
    'solo/js/models/entities/mobile/Pawn.js#applyRegularHoursBonus',
    // #116: an unlock that grants a skill is a qualification, not practice. The
    // pawn did not repeat an action to earn the level; the table said it can now
    // do something requiring one, and every gate in the game reads pawn.skills.
    // Growth rules are exactly what this list exists for - deliberate, named, and
    // paid once per unlock rather than once per evaluation.
    'solo/js/models/entities/mobile/Pawn.js#qualifySkill'
])

const AURA_FILES = [
    'solo/js/models/entities/immobile/Guild.js',
    'solo/js/models/entities/immobile/School.js',
    'solo/js/models/entities/immobile/Workshop.js',
    'solo/js/models/entities/immobile/Market.js'
]

/**
 * Every skill-payment call site in a file, with the function it sits inside.
 * @param {string} rel - repo-relative path
 * @param {string} verb - 'useSkill' or 'increaseSkill'
 * @returns {Array<{line: number, owner: string, text: string}>}
 */
function payments(rel, verb) {
    const lines = fs.readFileSync(path.join(repoRoot, rel), 'utf8').split(/\r?\n/)
    const found = []
    // `x.useSkill(` and `x.useSkill?.(`, but never the method definition. The
    // optional-call spelling matters: the structure auras are written
    // `pawn.increaseSkill?.(...)` because occupants are looked up out of the
    // world map, and a guard that can't see that form guards nothing.
    const call = new RegExp(String.raw`[\w?\]]\.${verb}(\?\.)?\(`)
    const decl = /^\s{0,8}(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_]\w*)|([A-Za-z_]\w*)\s*\([^)]*\)\s*\{)/
    const notDecl = new Set(['if', 'for', 'while', 'switch', 'catch', 'return'])
    for (let i = 0; i < lines.length; i++) {
        if (!call.test(lines[i])) continue
        let owner = '<module>'
        for (let j = i; j >= 0; j--) {
            const m = lines[j].match(decl)
            const name = m && (m[1] ?? m[2])
            if (name && !notDecl.has(name)) { owner = name; break }
        }
        found.push({ line: i + 1, owner, text: lines[i].trim() })
    }
    return found
}

test('activity handlers pay practice with useSkill', () => {
    const offenders = []
    let practiceSites = 0
    for (const rel of ACTOR_FILES) {
        for (const p of payments(rel, 'increaseSkill')) {
            if (!NON_ACT_PAYMENTS.has(`${rel}#${p.owner}`)) offenders.push(`${rel}:${p.line} ${p.text}`)
        }
        practiceSites += payments(rel, 'useSkill').length
    }

    assert.deepEqual(offenders, [], 'these pay for an act through the primitive; #101 says useSkill')

    // The other half of the guard: an exception list is trivially satisfied by
    // routing everything *away* from the verbs. The sim does have acts, so it
    // must keep having sites that say so.
    assert.ok(practiceSites >= 50, `expected the practice verb at 50+ act sites, found ${practiceSites}`)
})

test('structures pay for presence with the primitive, never as practice', () => {
    // A pawn standing in a workshop is not practising; the room is carrying it.
    // If these ever switch to `useSkill`, a diminishing-returns curve in the
    // practice verb would silently cap what a building can teach - which is a
    // design decision, not a refactor, and belongs in its own issue.
    for (const rel of AURA_FILES) {
        const practice = payments(rel, 'useSkill')
        assert.deepEqual(practice, [], `${rel} pays for proximity, not for acts: ${practice.map(p => p.text).join(', ')}`)
    }

    const auras = AURA_FILES.flatMap(rel => payments(rel, 'increaseSkill').map(p => `${rel}#${p.owner}`))
    assert.ok(auras.length >= 4, 'the auras should still be there; if they moved, update this file too')
})

test('practice records when the act happened', () => {
    const pawn = new Pawn('Ada', 'Ada', 0, 0)
    pawn.world = { clock: { currentTick: 77 } }

    // `increasePlanningSkill` is an act - the pawn planned - so it goes through
    // the practice verb, and the practice verb is what tells decay the skill is
    // warm. This is the seam the source checks above are protecting.
    pawn.increasePlanningSkill()

    assert.equal(pawn.getSkill('planning'), 1)
    assert.equal(pawn.skillLastUsed.planning, 77, 'the practice log should carry the tick of the act')
})

test('a lesson a structure scheduled is still practice', () => {
    const teacher = new Pawn('Teacher', 'Teacher', 0, 0)
    const student = new Pawn('Student', 'Student', 0, 0)
    for (const p of [teacher, student]) p.world = { clock: { currentTick: 10 } }
    teacher.skills.knapping = 5

    teach(teacher, student, 'knapping')

    assert.ok(student.getSkill('knapping') > 0, 'the student attended, so the student practised')
    assert.equal(student.skillLastUsed.knapping, 10)
    assert.equal(teacher.skillLastUsed.teaching, 10, 'teaching is the act the teacher did')
})
