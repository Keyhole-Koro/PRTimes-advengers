import { getPool } from '../db/pool.js'
import type {
  CommentThreadRecord,
  CommentMessageRecord,
  CreateCommentThreadInput,
  CreateCommentReplyInput,
} from '../types/comment.js'

type CommentThreadRow = {
  id: number
  press_release_id: number
  anchor_from: number
  anchor_to: number
  quote: string
  is_resolved: boolean
  created_by: string
  created_at: Date
  resolved_at: Date | null
}

type CommentMessageRow = {
  id: number
  thread_id: number
  body: string
  created_by: string
  created_at: Date
}

function mapThreadRow(row: CommentThreadRow): CommentThreadRecord {
  return {
    id: row.id,
    pressReleaseId: row.press_release_id,
    anchorFrom: row.anchor_from,
    anchorTo: row.anchor_to,
    quote: row.quote,
    isResolved: row.is_resolved,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
  }
}

function mapMessageRow(row: CommentMessageRow): CommentMessageRecord {
  return {
    id: row.id,
    threadId: row.thread_id,
    body: row.body,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  }
}

export class CommentRepository {
  async findThreadsByPressReleaseId(
    pressReleaseId: number,
    includeResolved: boolean,
  ): Promise<CommentThreadRecord[]> {
    const pool = getPool()
    const query = includeResolved
      ? `SELECT * FROM comment_threads WHERE press_release_id = $1 ORDER BY created_at ASC`
      : `SELECT * FROM comment_threads WHERE press_release_id = $1 AND is_resolved = FALSE ORDER BY created_at ASC`

    const result = await pool.query<CommentThreadRow>(query, [pressReleaseId])
    return result.rows.map(mapThreadRow)
  }

  async findMessagesByThreadIds(threadIds: number[]): Promise<CommentMessageRecord[]> {
    if (threadIds.length === 0) {
      return []
    }

    const pool = getPool()
    const placeholders = threadIds.map((_, i) => `$${i + 1}`).join(', ')
    const result = await pool.query<CommentMessageRow>(
      `SELECT * FROM comment_messages WHERE thread_id IN (${placeholders}) ORDER BY created_at ASC`,
      threadIds,
    )
    return result.rows.map(mapMessageRow)
  }

  async createThread(
    pressReleaseId: number,
    input: CreateCommentThreadInput,
  ): Promise<{ thread: CommentThreadRecord; message: CommentMessageRecord }> {
    const pool = getPool()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const threadResult = await client.query<CommentThreadRow>(
        `INSERT INTO comment_threads (press_release_id, anchor_from, anchor_to, quote, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [pressReleaseId, input.anchorFrom, input.anchorTo, input.quote, input.createdBy],
      )

      const thread = mapThreadRow(threadResult.rows[0])

      const messageResult = await client.query<CommentMessageRow>(
        `INSERT INTO comment_messages (thread_id, body, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [thread.id, input.body, input.createdBy],
      )

      const message = mapMessageRow(messageResult.rows[0])

      await client.query('COMMIT')
      return { thread, message }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async addReply(
    threadId: number,
    input: CreateCommentReplyInput,
  ): Promise<CommentMessageRecord | null> {
    const pool = getPool()

    const threadExists = await pool.query(
      'SELECT id FROM comment_threads WHERE id = $1',
      [threadId],
    )
    if (threadExists.rows.length === 0) {
      return null
    }

    const result = await pool.query<CommentMessageRow>(
      `INSERT INTO comment_messages (thread_id, body, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [threadId, input.body, input.createdBy],
    )

    return mapMessageRow(result.rows[0])
  }

  async resolveThread(threadId: number): Promise<CommentThreadRecord | null> {
    const pool = getPool()
    const result = await pool.query<CommentThreadRow>(
      `UPDATE comment_threads
       SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [threadId],
    )

    if (result.rows.length === 0) {
      return null
    }

    return mapThreadRow(result.rows[0])
  }

  async unresolveThread(threadId: number): Promise<CommentThreadRecord | null> {
    const pool = getPool()
    const result = await pool.query<CommentThreadRow>(
      `UPDATE comment_threads
       SET is_resolved = FALSE, resolved_at = NULL
       WHERE id = $1
       RETURNING *`,
      [threadId],
    )

    if (result.rows.length === 0) {
      return null
    }

    return mapThreadRow(result.rows[0])
  }
}

export const commentRepository = new CommentRepository()
