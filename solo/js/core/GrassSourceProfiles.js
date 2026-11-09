export const GRASS_PROFILE_IDS = Object.freeze({
    THATCH: 'grass_thatch',
    FLOWERS: 'grass_flowers',
    BIOMASS: 'grass_biomass'
})

const PROFILE_IDS = Object.values(GRASS_PROFILE_IDS)
const PROFILE_RECOGNITION_RMS_THRESHOLD = 0.22
const PROFILE_RECOGNITION_MIN_MARGIN = 0.01

export const GRASS_SOURCE_PROFILES = Object.freeze({
    [GRASS_PROFILE_IDS.THATCH]: Object.freeze({
        durability: 50,
        rotResistance: 60,
        flexibility: 15,
        edibility: 5,
        medicine: 0,
        length: 90,
        mass: 30
    }),
    [GRASS_PROFILE_IDS.FLOWERS]: Object.freeze({
        durability: 5,
        rotResistance: 8,
        flexibility: 40,
        edibility: 70,
        medicine: 25,
        length: 15,
        mass: 10
    }),
    [GRASS_PROFILE_IDS.BIOMASS]: Object.freeze({
        durability: 20,
        rotResistance: 25,
        flexibility: 20,
        edibility: 10,
        medicine: 5,
        length: 45,
        mass: 80
    })
})

const GRASS_TRAITS = Object.keys(GRASS_SOURCE_PROFILES[GRASS_PROFILE_IDS.THATCH])

export function identifyGrassSourceProfile(properties) {
    if (!properties || !GRASS_TRAITS.every(name => Number.isFinite(properties[name]))) return null

    const ranked = PROFILE_IDS.map(profileId => {
        const score = GRASS_TRAITS.reduce((total, trait) => {
            const difference = (properties[trait] - GRASS_SOURCE_PROFILES[profileId][trait]) / 100
            return total + difference * difference
        }, 0) / GRASS_TRAITS.length
        return { profileId, score }
    }).sort((a, b) => a.score - b.score)

    const [closest, next] = ranked
    if (
        Math.sqrt(closest.score) > PROFILE_RECOGNITION_RMS_THRESHOLD ||
        next.score - closest.score < PROFILE_RECOGNITION_MIN_MARGIN
    ) return null
    return closest.profileId
}

const BIOME_WEIGHTS = {
    plains: { [GRASS_PROFILE_IDS.THATCH]: 0.2, [GRASS_PROFILE_IDS.FLOWERS]: 0.5, [GRASS_PROFILE_IDS.BIOMASS]: 0.3 },
    forest: { [GRASS_PROFILE_IDS.THATCH]: 0.15, [GRASS_PROFILE_IDS.FLOWERS]: 0.3, [GRASS_PROFILE_IDS.BIOMASS]: 0.55 },
    hills: { [GRASS_PROFILE_IDS.THATCH]: 0.25, [GRASS_PROFILE_IDS.FLOWERS]: 0.2, [GRASS_PROFILE_IDS.BIOMASS]: 0.55 },
    wetland: { [GRASS_PROFILE_IDS.THATCH]: 0.35, [GRASS_PROFILE_IDS.FLOWERS]: 0.4, [GRASS_PROFILE_IDS.BIOMASS]: 0.25 }
}

function tileVariation(seed, x, y, index) {
    let value = Math.trunc(seed) | 0
    value ^= Math.imul(Math.trunc(x) + 1, 0x9e3779b1)
    value ^= Math.imul(Math.trunc(y) + 1, 0x85ebca6b)
    value ^= Math.imul(index + 1, 0xc2b2ae35)
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
    value ^= value >>> 16
    return (value >>> 0) / 0xffffffff
}

export function createGrassProfileStocks({
    capacity,
    biome,
    humidity = 50,
    shaded = false,
    seed = 0,
    x = 0,
    y = 0
}) {
    const weights = { ...(BIOME_WEIGHTS[biome] ?? BIOME_WEIGHTS.plains) }
    const dampness = Math.max(0, Math.min(1, humidity / 100))
    weights[GRASS_PROFILE_IDS.FLOWERS] *= 0.8 + dampness * 0.4
    weights[GRASS_PROFILE_IDS.BIOMASS] *= 1.2 - dampness * 0.4
    if (shaded) {
        weights[GRASS_PROFILE_IDS.FLOWERS] *= 0.9
        weights[GRASS_PROFILE_IDS.BIOMASS] *= 1.1
    }

    for (const [index, profileId] of PROFILE_IDS.entries()) {
        weights[profileId] *= 0.88 + tileVariation(seed, x, y, index) * 0.24
    }

    const totalWeight = PROFILE_IDS.reduce((sum, id) => sum + weights[id], 0)
    return Object.fromEntries(PROFILE_IDS.map(profileId => [
        profileId,
        capacity * weights[profileId] / totalWeight
    ]))
}
