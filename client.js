import { io } from 'socket.io-client'

const socket = io('http://localhost:5000')

socket.on('connect', () => {
  console.log('Connected to server')

  // Example player action
  socket.emit('playerAction', { entityId: 'exampleEntityId', newPosition: { x: 10, y: 20 } })

  // Listen for game state updates
  socket.on('gameState', (state) => {
    console.log('Updated game state:', state)
  })
})

socket.on('disconnect', () => {
  console.log('Disconnected from server')
})
