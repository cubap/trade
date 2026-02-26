import test, { after } from 'node:test'
import assert from 'node:assert'
import request from 'supertest'
import mongoose from 'mongoose'
import { app, server } from '../server.js'

after(async () => {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
})

test('GET / should return "Server is running"', async () => {
  const res = await request(app).get('/')
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.text, 'Server is running')
})
