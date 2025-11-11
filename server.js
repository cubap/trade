import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static('.'))

// Basic route
app.get('/', (req, res) => {
  res.send('Server is running')
})

// MongoDB and game logic are optional - comment out if not needed
// import setupGameLogic from './gameLogic.js'
// import connectDB from './config/db.js'
// connectDB()
// setupGameLogic(server)

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Solo game: http://localhost:${PORT}/solo/index.html`)
  })
}

export { app }
