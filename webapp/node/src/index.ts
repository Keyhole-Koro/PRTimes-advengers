import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pkg from 'pg'
import { z } from 'zod'
const { Pool } = pkg

// Zod schema for press release input validation
const PressReleaseInputSchema = z.object({
  title: z.string(),
  content: z.string(),
})

// Database connection pool (singleton pattern)
let pool: pkg.Pool | null = null

function getPool(): pkg.Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgresql',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'press_release_db',
      user: process.env.DB_USER || 'press_release',
      password: process.env.DB_PASSWORD || 'press_release',
    })
  }
  return pool
}

// Format timestamp to ISO 8601 format with microseconds
function formatTimestamp(timestamp: Date): string {
  const year = timestamp.getFullYear()
  const month = String(timestamp.getMonth() + 1).padStart(2, '0')
  const day = String(timestamp.getDate()).padStart(2, '0')
  const hours = String(timestamp.getHours()).padStart(2, '0')
  const minutes = String(timestamp.getMinutes()).padStart(2, '0')
  const seconds = String(timestamp.getSeconds()).padStart(2, '0')
  const microseconds = String(timestamp.getMilliseconds() * 1000).padStart(6, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${microseconds}`
}

const app = new Hono()

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// GET /press-releases/:id
app.get('/press-releases/:id', async (c) => {
  const idParam = c.req.param('id')

  // Validate ID
  if (!/^\d+$/.test(idParam) || parseInt(idParam) <= 0) {
    return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400)
  }

  const id = parseInt(idParam)

  try {
    const pool = getPool()
    const result = await pool.query(
      'SELECT id, title, content, created_at, updated_at FROM press_releases WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404)
    }

    const row = result.rows[0]
    const data = {
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: formatTimestamp(new Date(row.created_at)),
      updated_at: formatTimestamp(new Date(row.updated_at)),
    }

    return c.json(data)
  } catch (error) {
    console.error('Database error:', error)
    return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
  }
})

// POST /press-releases/:id
app.post('/press-releases/:id', async (c) => {
  const idParam = c.req.param('id')

  // Validate ID
  if (!/^\d+$/.test(idParam) || parseInt(idParam) <= 0) {
    return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400)
  }

  const id = parseInt(idParam)

  // Get request body
  let bodyText: string
  try {
    bodyText = await c.req.text()
  } catch (error) {
    return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
  }

  // Check for empty body
  if (bodyText.trim() === '') {
    return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(bodyText)
  } catch (error) {
    return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
  }

  // Validate with Zod
  const result = PressReleaseInputSchema.safeParse(data)
  if (!result.success) {
    return c.json({ code: 'MISSING_REQUIRED_FIELDS', message: 'Title and content are required' }, 400)
  }

  const { title, content } = result.data

  try {
    const pool = getPool()

    // Check if press release exists
    const checkResult = await pool.query('SELECT id FROM press_releases WHERE id = $1', [id])

    if (checkResult.rows.length === 0) {
      return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404)
    }

    // Update press release
    await pool.query(
      'UPDATE press_releases SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [title, content, id]
    )

    // Get updated data
    const result = await pool.query(
      'SELECT id, title, content, created_at, updated_at FROM press_releases WHERE id = $1',
      [id]
    )

    const row = result.rows[0]
    const responseData = {
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: formatTimestamp(new Date(row.created_at)),
      updated_at: formatTimestamp(new Date(row.updated_at)),
    }

    return c.json(responseData)
  } catch (error) {
    console.error('Database error:', error)
    return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
  }
})

serve({
  fetch: app.fetch,
  port: 8080
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
