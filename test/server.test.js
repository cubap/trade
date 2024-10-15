import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';

test('GET / should return "Server is running"', async () => {
  const res = await request(app).get('/');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'Server is running');
});
