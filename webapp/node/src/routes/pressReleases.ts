import { Hono } from 'hono'
import { getPool } from '../db/pool.js'
import { PressReleaseInputSchema } from '../schemas/pressRelease.js'
import { formatTimestamp } from '../utils/formatTimestamp.js'

export const pressReleaseRoutes = new Hono()

pressReleaseRoutes.get('/press-releases/:id', async (c) => {
  const idParam = c.req.param('id')

  if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
    return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400)
  }

  const id = parseInt(idParam, 10)

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
    return c.json({
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: formatTimestamp(new Date(row.created_at)),
      updated_at: formatTimestamp(new Date(row.updated_at)),
    })
  } catch (error) {
    console.error('Database error:', error)
    return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
  }
})

pressReleaseRoutes.post('/press-releases/:id', async (c) => {
  const idParam = c.req.param('id')

  if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
    return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400)
  }

  const id = parseInt(idParam, 10)

  let bodyText: string
  try {
    bodyText = await c.req.text()
  } catch {
    return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
  }

  if (bodyText.trim() === '') {
    return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
  }

  let data: unknown
  try {
    data = JSON.parse(bodyText)
  } catch {
    return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
  }

  const parsed = PressReleaseInputSchema.safeParse(data)
  if (!parsed.success) {
    return c.json(
      { code: 'MISSING_REQUIRED_FIELDS', message: 'Title and content are required' },
      400
    )
  }

  const { title, content } = parsed.data

  try {
    const pool = getPool()
    const checkResult = await pool.query('SELECT id FROM press_releases WHERE id = $1', [id])

    if (checkResult.rows.length === 0) {
      return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404)
    }

    await pool.query(
      'UPDATE press_releases SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [title, content, id]
    )

    const result = await pool.query(
      'SELECT id, title, content, created_at, updated_at FROM press_releases WHERE id = $1',
      [id]
    )

    const row = result.rows[0]
    return c.json({
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: formatTimestamp(new Date(row.created_at)),
      updated_at: formatTimestamp(new Date(row.updated_at)),
    })
  } catch (error) {
    console.error('Database error:', error)
    return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
  }
})
