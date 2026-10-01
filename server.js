// Node 22+ loads .env via --env-file flag
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { syncThree } from './scripts/sync-vendor-three.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json())

// Basic route (declared before static so '/' isn't shadowed by solo/index.html)
app.get('/', (req, res) => {
  res.send('Server is running')
})

app.use(express.static('solo'))
// The solo client loads three.js as plain ES modules with no bundler. Serving
// node_modules would expose every installed package (CodeQL
// js/exposure-of-private-files), so only the allowlisted subset the client
// imports is materialised into vendor/three - generated on boot, never
// committed - and that directory is what gets served.
try {
  const result = syncThree()
  if (result.status === 'skipped') {
    console.warn(`three.js vendor: skipped (${result.reason}); /vendor/three will 404 until three is installed`)
  }
} catch (err) {
  console.warn('three.js vendor sync failed:', err.message)
}
app.use('/vendor', express.static(path.join(__dirname, 'vendor')))

app.get('/favicon.ico', (req, res) => {
  res.status(204).end()
})

// MongoDB and game logic are optional - comment out if not needed
import setupGameLogic from './gameLogic.js'
import connectDB from './config/db.js'

const initializeServer = async () => {
  if (process.env.NODE_ENV === 'test') return
  await connectDB()
  setupGameLogic(server)
}

const startServer = async () => {
  await initializeServer()

  const PORT = process.env.PORT || 3000

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`Solo game: http://localhost:${PORT}/index.html`)
      resolve()
    })
  })

  return server
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  startServer().catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}

// Dev logging endpoint for client-side test hooks
app.post('/_dev/log', (req, res) => {
  try {
    const payload = req.body || {}
    // Only print dev logs when explicitly allowed (reduce noise).
    const tag = String(payload.tag || '')
    const shouldLog = process.env.NODE_ENV === 'development' || process.env.DEV_LOG === '1' || tag.startsWith('test-') || tag.includes('craft') || tag.startsWith('dev')
    if (shouldLog) console.log('[DEV LOG]', payload.tag || 'client', payload.message || payload)
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Failed to process /_dev/log:', err)
    res.status(500).json({ ok: false })
  }
})

export { app, server, startServer }
