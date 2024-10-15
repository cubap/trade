import 'dotenv/config'
import { io } from 'socket.io-client'
import mongoose from 'mongoose'

const socket = io('http://localhost:5000')

// Use a valid ObjectId
const validObjectId = process.env.TEST_PAWN
// const validObjectId = new mongoose.Types.ObjectId().toString()

socket.on('connect', () => {
  console.log('Connected to server')

  // Example player action with a valid ObjectId
  socket.emit('playerAction', { entityId: validObjectId, newPosition: { x: 10, y: 20 } })

  // Listen for game state updates
  socket.on('gameState', (state) => {
    console.log('Updated game state:', state)
  })
})

socket.on('disconnect', () => {
  console.log('Disconnected from server')
})
