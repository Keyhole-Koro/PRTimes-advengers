import { Hono } from 'hono'
import {
  LinkPreviewFetchError,
  LinkPreviewNotFoundError,
  LinkPreviewService,
  linkPreviewService,
} from '../services/linkPreviewService.js'

export function createLinkPreviewRoutes(service: LinkPreviewService = linkPreviewService): Hono {
  const routes = new Hono()

  routes.get('/link-previews', async (c) => {
    const urlParam = c.req.query('url')
    if (!urlParam) {
      return c.json({ code: 'MISSING_URL', message: 'URL is required' }, 400)
    }

    try {
      const preview = await service.fetchPreview(urlParam)
      return c.json(preview)
    } catch (error) {
      if (error instanceof LinkPreviewFetchError) {
        return c.json(
          { code: error.statusCode === 502 ? 'FETCH_FAILED' : 'INVALID_URL', message: error.message },
          error.statusCode as 400 | 502,
        )
      }

      if (error instanceof LinkPreviewNotFoundError) {
        return c.json({ code: 'PREVIEW_NOT_FOUND', message: error.message }, 404)
      }

      console.error('Link preview error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  return routes
}

export const linkPreviewRoutes = createLinkPreviewRoutes()
