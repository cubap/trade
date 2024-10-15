import { configDotenv } from 'dotenv'
configDotenv()
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import connectDB from './config/db.js'

const app = express()
const server = createServer(app)
const io = new Server(server)

// Middleware
app.use(cors())
app.use(express.json())

// Connect to MongoDB
connectDB()

// Basic route
app.get('/', (req, res) => {
  res.send('Server is running')
})

// Start server
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

export { app }
