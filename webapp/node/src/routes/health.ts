import { Hono } from 'hono'
import { getPool } from '../db/pool.js'

type HealthDependencies = {
  checkDatabase?: () => Promise<void>
}

async function defaultCheckDatabase(): Promise<void> {
  const pool = getPool()
  await pool.query('SELECT 1')
}

export function createHealthRoutes(dependencies: HealthDependencies = {}): Hono {
  const healthRoutes = new Hono()
  const checkDatabase = dependencies.checkDatabase ?? defaultCheckDatabase

  healthRoutes.get('/health', async (c) => {
    try {
      await checkDatabase()
      return c.json({ status: 'ok' }, 200)
    } catch (error) {
      console.error('Health check failed:', error)
      return c.json({ status: 'error' }, 503)
    }
  })

  return healthRoutes
}

export const healthRoutes = createHealthRoutes()
