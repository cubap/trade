import mongoose from 'mongoose'
import { Server } from 'socket.io'
import Entity from './models/Entity.js'
import Pawn from './solo/js/models/entities/mobile/Pawn.js'

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

let gameTime = 0 // in seconds, advances by Pawn.TURN_GAME_SECONDS per tick

const simulateWorld = async () => {
  const entities = await Entity.find()
  for (const entity of entities) {
    entity.attributes.energy -= 1
    // If this entity is a pawn, update its time-based logic
    if (entity.type === 'pawn') {
      // You may need to adapt this if Pawn is not a direct instance
      // If using a class system, instantiate Pawn and call timeTick
      // Example assumes entity.attributes is compatible with Pawn
      const pawn = Object.setPrototypeOf(entity.attributes, Pawn.prototype)
      pawn.timeTick(gameTime)
      // Optionally, persist pawn state changes back to entity.attributes
      entity.attributes = { ...pawn }
    }
    await entity.save()
  }
  gameTime += Pawn.TURN_GAME_SECONDS
  setTimeout(simulateWorld, 1000 * Pawn.TURN_REAL_SECONDS)
}

export default setupGameLogic
