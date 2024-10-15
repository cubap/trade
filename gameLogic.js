import mongoose from 'mongoose'
import { Server } from 'socket.io'
import Entity from './models/Entity.js'

const setupGameLogic = (server) => {
  const io = new Server(server)

  io.on('connection', (socket) => {
    console.log('New player connected')

    socket.on('playerAction', async (action) => {
      console.log(`Received action: ${JSON.stringify(action)}`)

      if (!mongoose.Types.ObjectId.isValid(action.entityId)) {
        console.log(`Invalid entity ID: ${action.entityId}`)
        return
      }

      const entity = await Entity.findById(action.entityId)
      if (!entity) {
        console.log(`Entity not found for ID: ${action.entityId}`)
        return
      }

      console.log(`Entity found: ${entity}`)
      entity.position = action.newPosition
      await entity.save()
      io.emit('gameState', { entities: await Entity.find() })
    })

    socket.on('disconnect', () => {
      console.log('Player disconnected')
    })
  })

  simulateWorld()
}

const simulateWorld = async () => {
  const entities = await Entity.find()
  for (const entity of entities) {
    entity.attributes.energy -= 1
    await entity.save()
  }
  setTimeout(simulateWorld, 1000)
}

export default setupGameLogic
