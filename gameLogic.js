import { Server } from 'socket.io'

const setupGameLogic = (server) => {
  const io = new Server(server)

  io.on('connection', (socket) => {
    console.log('New player connected')

    // Handle player actions
    socket.on('playerAction', (action) => {
      // Process player action
      console.log('Player action:', action)

      // Broadcast updated game state
      io.emit('gameState', { /* updated state */ })
    })

    socket.on('disconnect', () => {
      console.log('Player disconnected')
    })
  })
}

export default setupGameLogic
