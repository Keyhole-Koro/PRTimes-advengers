import test from 'node:test'
import assert from 'node:assert/strict'
import { createHealthRoutes } from './health.js'

test('GET /health returns 200 when database check succeeds', async () => {
  const app = createHealthRoutes({
    checkDatabase: async () => {},
  })

  const response = await app.request('http://localhost/health')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('GET /health returns 503 when database check fails', async () => {
  const originalConsoleError = console.error
  console.error = () => {}

  try {
    const app = createHealthRoutes({
      checkDatabase: async () => {
        throw new Error('database unavailable')
      },
    })

    const response = await app.request('http://localhost/health')

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { status: 'error' })
  } finally {
    console.error = originalConsoleError
  }
})
