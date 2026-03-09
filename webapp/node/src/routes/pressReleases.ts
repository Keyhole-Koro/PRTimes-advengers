import { Hono } from 'hono'
import { PressReleaseInputSchema } from '../schemas/pressRelease.js'
import {
  PressReleaseNotFoundError,
  PressReleaseRevisionNotFoundError,
  PressReleaseService,
  PressReleaseVersionConflictError,
  pressReleaseService,
} from '../services/pressReleaseService.js'
import { invalidIdResponse, invalidJsonResponse, parseIdParam, parseJsonBody } from '../utils/requestHelpers.js'

export function createPressReleaseRoutes(service: PressReleaseService = pressReleaseService): Hono {
  const pressReleaseRoutes = new Hono()

  pressReleaseRoutes.get('/press-releases/:id', async (c) => {
    const id = parseIdParam(c, 'id')
    if (id === null) {
      return invalidIdResponse(c)
    }

    try {
      return c.json(await service.getPressRelease(id))
    } catch (error) {
      if (error instanceof PressReleaseNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404)
      }

      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  pressReleaseRoutes.get('/press-releases/:id/revisions', async (c) => {
    const id = parseIdParam(c, 'id')
    if (id === null) {
      return invalidIdResponse(c)
    }

    try {
      return c.json(await service.getPressReleaseRevisions(id))
    } catch (error) {
      if (error instanceof PressReleaseNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404)
      }

      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  pressReleaseRoutes.post('/press-releases/:id', async (c) => {
    const id = parseIdParam(c, 'id')
    if (id === null) {
      return invalidIdResponse(c)
    }

    const data = await parseJsonBody(c)
    if (data === null) {
      return invalidJsonResponse(c)
    }

    const parsed = PressReleaseInputSchema.safeParse(data)
    if (!parsed.success) {
      console.error('Validation error:', JSON.stringify(parsed.error.format(), null, 2))
      return c.json(
        { code: 'MISSING_REQUIRED_FIELDS', message: 'Title and content are required' },
        400
      )
    }

    try {
      const pressRelease = await service.updatePressRelease(id, parsed.data)
      return c.json(pressRelease)
    } catch (error) {
      if (error instanceof PressReleaseNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404)
      }

      if (error instanceof PressReleaseVersionConflictError) {
        return c.json(
          {
            code: 'VERSION_CONFLICT',
            message: 'Press release has been updated by another session',
            currentVersion: error.currentVersion,
          },
          409
        )
      }

      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  pressReleaseRoutes.post('/press-releases/:id/revisions/:revisionId/restore', async (c) => {
    const id = parseIdParam(c, 'id')
    if (id === null) {
      return invalidIdResponse(c)
    }

    const revisionId = parseIdParam(c, 'revisionId')
    if (revisionId === null) {
      return invalidIdResponse(c, 'revision ID')
    }

    try {
      const pressRelease = await service.restorePressReleaseRevision(id, revisionId)
      return c.json(pressRelease)
    } catch (error) {
      if (error instanceof PressReleaseNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404)
      }

      if (error instanceof PressReleaseRevisionNotFoundError) {
        return c.json({ code: 'REVISION_NOT_FOUND', message: 'Revision not found' }, 404)
      }

      if (error instanceof PressReleaseVersionConflictError) {
        return c.json(
          {
            code: 'VERSION_CONFLICT',
            message: 'Press release has been updated by another session',
            currentVersion: error.currentVersion,
          },
          409
        )
      }

      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  return pressReleaseRoutes
}

export const pressReleaseRoutes = createPressReleaseRoutes()
