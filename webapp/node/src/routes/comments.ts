import { Hono } from 'hono'
import { CreateCommentThreadSchema, CreateCommentReplySchema } from '../schemas/comment.js'
import { CommentService, CommentThreadNotFoundError, commentService } from '../services/commentService.js'

export function createCommentRoutes(service: CommentService = commentService): Hono {
  const routes = new Hono()

  // GET /press-releases/:id/comments?includeResolved=true
  routes.get('/press-releases/:id/comments', async (c) => {
    const idParam = c.req.param('id')
    if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
      return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400)
    }

    const pressReleaseId = parseInt(idParam, 10)
    const includeResolved = c.req.query('includeResolved') === 'true'

    try {
      const comments = await service.getComments(pressReleaseId, includeResolved)
      return c.json(comments)
    } catch (error) {
      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  // POST /press-releases/:id/comments — create new thread
  routes.post('/press-releases/:id/comments', async (c) => {
    const idParam = c.req.param('id')
    if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
      return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400)
    }

    const pressReleaseId = parseInt(idParam, 10)

    let data: unknown
    try {
      data = await c.req.json()
    } catch {
      return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
    }

    const parsed = CreateCommentThreadSchema.safeParse(data)
    if (!parsed.success) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.format() }, 400)
    }

    try {
      const thread = await service.createThread(pressReleaseId, parsed.data)
      return c.json(thread, 201)
    } catch (error) {
      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  // POST /comments/:threadId/replies — add reply
  routes.post('/comments/:threadId/replies', async (c) => {
    const threadIdParam = c.req.param('threadId')
    if (!/^\d+$/.test(threadIdParam) || parseInt(threadIdParam, 10) <= 0) {
      return c.json({ code: 'INVALID_ID', message: 'Invalid thread ID' }, 400)
    }

    const threadId = parseInt(threadIdParam, 10)

    let data: unknown
    try {
      data = await c.req.json()
    } catch {
      return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
    }

    const parsed = CreateCommentReplySchema.safeParse(data)
    if (!parsed.success) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.format() }, 400)
    }

    try {
      const message = await service.addReply(threadId, parsed.data)
      return c.json(message, 201)
    } catch (error) {
      if (error instanceof CommentThreadNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Comment thread not found' }, 404)
      }
      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  // PATCH /comments/:threadId/resolve
  routes.patch('/comments/:threadId/resolve', async (c) => {
    const threadIdParam = c.req.param('threadId')
    if (!/^\d+$/.test(threadIdParam) || parseInt(threadIdParam, 10) <= 0) {
      return c.json({ code: 'INVALID_ID', message: 'Invalid thread ID' }, 400)
    }

    const threadId = parseInt(threadIdParam, 10)

    try {
      const thread = await service.resolveThread(threadId)
      return c.json(thread)
    } catch (error) {
      if (error instanceof CommentThreadNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Comment thread not found' }, 404)
      }
      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  // PATCH /comments/:threadId/unresolve
  routes.patch('/comments/:threadId/unresolve', async (c) => {
    const threadIdParam = c.req.param('threadId')
    if (!/^\d+$/.test(threadIdParam) || parseInt(threadIdParam, 10) <= 0) {
      return c.json({ code: 'INVALID_ID', message: 'Invalid thread ID' }, 400)
    }

    const threadId = parseInt(threadIdParam, 10)

    try {
      const thread = await service.unresolveThread(threadId)
      return c.json(thread)
    } catch (error) {
      if (error instanceof CommentThreadNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Comment thread not found' }, 404)
      }
      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  return routes
}

export const commentRoutes = createCommentRoutes()
