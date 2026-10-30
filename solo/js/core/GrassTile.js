const GRASS_PROFILES = {
    thatch: {
        durability: 50,
        rotResistance: 60,
        flexibility: 15,
        edibility: 5,
        medicine: 0,
        length: 90,
        mass: 30
    },
    flowers: {
        durability: 5,
        rotResistance: 8,
        flexibility: 40,
        edibility: 70,
        medicine: 25,
        length: 15,
        mass: 10
    },
    biomass: {
        durability: 20,
        rotResistance: 25,
        flexibility: 20,
        edibility: 10,
        medicine: 5,
        length: 45,
        mass: 80
    }
}

const BIOME_RATIOS = {
    plains: { thatch: 0.2, flowers: 0.5, biomass: 0.3 },
    forest: { thatch: 0.15, flowers: 0.3, biomass: 0.55 },
    hills: { thatch: 0.25, flowers: 0.2, biomass: 0.55 },
    wetland: { thatch: 0.35, flowers: 0.4, biomass: 0.25 }
}

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

class GrassTile {
    constructor({ id, capacity, biome, stocks }) {
        this.id = id
        this.capacity = capacity
        const ratios = BIOME_RATIOS[biome] ?? BIOME_RATIOS.plains
        this.stocks = stocks ?? Object.fromEntries(
            Object.entries(ratios).map(([type, ratio]) => [type, capacity * ratio])
        )
        this.harvestCount = 0
    }

    interact({ use = 'material', targetType = 'fiber', skill = 0 } = {}) {
        if (use !== 'material' && use !== 'forage') return null
        const selectedType = targetType === 'fiber' ? 'thatch' : targetType

        const available = Object.entries(this.stocks).filter(([, stock]) => stock > 0)
        if (available.length === 0) return null

        const skillLevel = Number.isFinite(skill) ? Math.max(0, Math.min(10, skill)) : 0
        const preference = available.map(([type, stock]) => {
            const preferenceFactor = type === selectedType ? 1 + skillLevel * 0.9 : 1
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
                (sum, portion) => sum + GRASS_PROFILES[portion.type][name] * portion.amount,
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
