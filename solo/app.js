class Entity {
    constructor(name, x, y, speed) {
        this.name = name
        this.x = x
        this.y = y
        this.speed = speed
    }

    move() {
        this.x += (Math.random() - 0.5) * this.speed
        this.y += (Math.random() - 0.5) * this.speed
    }
}

class World {
    constructor(width, height) {
        this.width = width
        this.height = height
        this.entitiesMap = new Map()
    }

    addEntity(entity) {
        this.entitiesMap.set(entity.name, entity)
    }

    update() {
        for (const entity of this.entitiesMap.values()) {
            entity.move()
            this.keepEntityInBounds(entity)
        }
    }

    keepEntityInBounds(entity) {
        if (entity.x < 0) entity.x = 0
        if (entity.y < 0) entity.y = 0
        if (entity.x > this.width) entity.x = this.width
        if (entity.y > this.height) entity.y = this.height
    }
}

const world = new World(500, 500)

world.addEntity(new Entity('Entity1', 100, 100, 2))
world.addEntity(new Entity('Entity2', 200, 200, 3))

function simulationLoop() {
    world.update()
    console.log(world.entities) // Log entity positions for now
    // requestAnimationFrame(simulationLoop)
    simulationLoop()
}

simulationLoop()
