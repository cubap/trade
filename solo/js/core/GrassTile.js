import {
    createGrassProfileStocks,
    GRASS_PROFILE_IDS,
    GRASS_SOURCE_PROFILES
} from './GrassSourceProfiles.js'

const HARVEST_UNITS = 9
const PROPERTY_NAMES = [
    'durability',
    'rotResistance',
    'flexibility',
    'edibility',
    'medicine',
    'length',
    'mass'
]

const PROFILE_TYPE_IDS = {
    thatch: GRASS_PROFILE_IDS.THATCH,
    flowers: GRASS_PROFILE_IDS.FLOWERS,
    biomass: GRASS_PROFILE_IDS.BIOMASS
}

class GrassTile {
    constructor({ id, capacity, biome, stocks, humidity, shaded, seed, x, y }) {
        this.id = id
        this.capacity = capacity
        this.stocks = stocks
            ? Object.fromEntries(Object.entries(stocks).map(([type, stock]) => [
                PROFILE_TYPE_IDS[type] ?? type,
                stock
            ]))
            : createGrassProfileStocks({
                capacity,
                biome,
                humidity,
                shaded,
                seed,
                x,
                y
            })
        this.harvestCount = 0
    }

    interact({
        use = 'material',
        targetType = 'fiber',
        targetProfile,
        recognizedProfiles,
        skill = 0
    } = {}) {
        if (use !== 'material' && use !== 'forage') return null
        const selectedType = targetProfile
            ? recognizedProfiles?.has?.(targetProfile) ? targetProfile : null
            : targetType === 'fiber'
                ? GRASS_PROFILE_IDS.THATCH
                : PROFILE_TYPE_IDS[targetType] ?? targetType

        const available = Object.entries(this.stocks).filter(([, stock]) => stock > 0)
        if (available.length === 0) return null

        const skillLevel = Number.isFinite(skill) ? Math.max(0, Math.min(10, skill)) : 0
        const targetBias = 1 + (3 * skillLevel) / (skillLevel + 3)
        const preference = available.map(([type, stock]) => {
            const preferenceFactor = type === selectedType ? targetBias : 1
            return {
                type,
                stock,
                preferenceFactor,
                weight: stock * preferenceFactor
            }
        })
        const selected = []

        for (let unit = 0; unit < HARVEST_UNITS; unit++) {
            if (preference.length === 0) break
            let roll = Math.random() * preference.reduce((sum, item) => sum + item.weight, 0)
            let chosen = preference[preference.length - 1]
            for (const candidate of preference) {
                roll -= candidate.weight
                if (roll < 0) {
                    chosen = candidate
                    break
                }
            }

            const take = Math.min(1, this.stocks[chosen.type])
            if (take <= 0) continue
            this.stocks[chosen.type] -= take
            chosen.stock -= take
            chosen.weight = chosen.stock * chosen.preferenceFactor
            selected.push({ type: chosen.type, amount: take })
            if (chosen.stock <= 0) {
                preference.splice(preference.indexOf(chosen), 1)
            }
        }

        if (selected.length === 0) return null

        const quantity = selected.reduce((sum, portion) => sum + portion.amount, 0)
        const properties = Object.fromEntries(PROPERTY_NAMES.map(name => {
            const weightedValue = selected.reduce(
                (sum, portion) => sum + GRASS_SOURCE_PROFILES[portion.type][name] * portion.amount,
                0
            )
            return [name, weightedValue / quantity]
        }))
        this.harvestCount++

        if (use === 'forage') {
            return { use, nutrition: properties.edibility / 100, properties, quantity }
        }

        return {
            id: `${this.id}_bundle_${this.harvestCount}`,
            type: 'grass',
            name: 'Grass Bundle',
            quantity: 1,
            tags: ['material', 'plant_fiber'],
            properties,
            weight: 1,
            size: 1
        }
    }
}

export default GrassTile
