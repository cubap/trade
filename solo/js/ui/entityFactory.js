import { Pawn, Animal } from '../models/entities/index.js'

export function createEntity(type, world) {
    const entityCount = world.entitiesMap.size + 1
    let entity
    if (type === 'pawn') {
        const pawnRoles = ['Explorer', 'Builder', 'Scout', 'Trader']
        const role = pawnRoles[Math.floor(Math.random() * pawnRoles.length)]
        entity = new Pawn(
            `pawn${entityCount}`,
            `${role} ${entityCount}`,
            Math.random() * world.width,
            Math.random() * world.height
        )
        entity.role = role.toLowerCase()
    } else if (type === 'animal') {
        const animalSpecies = ['rabbit', 'fox', 'deer', 'wolf']
        const species = animalSpecies[Math.floor(Math.random() * animalSpecies.length)]
        entity = new Animal(
            `animal${entityCount}`,
            `${species.charAt(0).toUpperCase() + species.slice(1)} ${entityCount}`,
            Math.random() * world.width,
            Math.random() * world.height
        )
        entity.species = species
        if (species === 'rabbit' || species === 'deer') {
            entity.diet = 'herbivore'
            entity.predator = false
            entity.moveRange = 40 + Math.random() * 10
            entity.drives.security = 30
        } else {
            entity.diet = 'carnivore'
            entity.predator = true
            entity.moveRange = 60 + Math.random() * 15
            entity.drives.hunger = 40
        }
        const states = ['idle', 'foraging', 'seeking_water', 'resting']
        entity.behaviorState = states[Math.floor(Math.random() * states.length)]
    }
    return entity
}
