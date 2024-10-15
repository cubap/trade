import { Server } from 'socket.io'
import Entity from './models/Entity.js'
import Feature from './models/Feature.js'

const setupGameLogic = (server) => {
  const io = new Server(server)

  const simulateWorld = async () => {
    // Example: Move entities, update features
    const entities = await Entity.find()
    for (const entity of entities) {
      // Example logic to update entity state
      entity.attributes.energy -= 1
      await entity.save()
    }
    setTimeout(simulateWorld, 1000) // Simulate every second
  }

  io.on('connection', (socket) => {
    console.log('New player connected')

    // Handle player actions
    socket.on('playerAction', async (action) => {
      const entity = await Entity.findById(action.entityId)
      if (entity) {
        // Process player action (example: move entity)
        entity.position = action.newPosition
        await entity.save()

        // Broadcast updated game state
        io.emit('gameState', { entities: await Entity.find() })
      }
    })

    socket.on('disconnect', () => {
      console.log('Player disconnected')
    })
  })

  // Start the world simulation
  simulateWorld()
}

export default setupGameLogic
