import { Hono } from 'hono'
import {
  getPressReleaseAction,
  getPressReleaseRevisionsAction,
  requestAiEditAction,
  restoreRevisionAction,
  updatePressReleaseAction,
} from '../controllers/pressReleaseController.js'
import { invalidIdResponse, invalidJsonResponse, parseIdParam, parseJsonBody } from '../../../utils/requestHelpers.js'

export function createPressReleaseRoutes(): Hono {
  const pressReleaseRoutes = new Hono()

  pressReleaseRoutes.get('/press-releases/:id', async (c) => {
    const id = parseIdParam(c, 'id')
    if (id === null) {
      return invalidIdResponse(c)
    }

    return getPressReleaseAction(c, id)
  })

  pressReleaseRoutes.get('/press-releases/:id/revisions', async (c) => {
    const id = parseIdParam(c, 'id')
    if (id === null) {
      return invalidIdResponse(c)
    }

    return getPressReleaseRevisionsAction(c, id)
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

    return updatePressReleaseAction(c, id, data)
  })

  pressReleaseRoutes.post('/press-releases/:id/ai-edit', async (c) => {
    const id = parseIdParam(c, 'id')
    if (id === null) {
      return invalidIdResponse(c)
    }

    const data = await parseJsonBody(c)
    if (data === null) {
      return invalidJsonResponse(c)
    }

    return requestAiEditAction(c, id, data)
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

    return restoreRevisionAction(c, id, revisionId)
  })

  return pressReleaseRoutes
}

export const pressReleaseRoutes = createPressReleaseRoutes()
