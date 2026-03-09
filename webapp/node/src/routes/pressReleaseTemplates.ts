import { Hono } from 'hono'
import { PressReleaseTemplateInputSchema } from '../schemas/pressReleaseTemplate.js'
import {
  PressReleaseTemplateNotFoundError,
  PressReleaseTemplateService,
  pressReleaseTemplateService,
} from '../services/pressReleaseTemplateService.js'

export function createPressReleaseTemplateRoutes(
  service: PressReleaseTemplateService = pressReleaseTemplateService
): Hono {
  const templateRoutes = new Hono()

  templateRoutes.get('/press-release-templates', async (c) => {
    try {
      return c.json(await service.getTemplates())
    } catch (error) {
      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  templateRoutes.get('/press-release-templates/:id', async (c) => {
    const idParam = c.req.param('id')
    if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
      return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400)
    }

    try {
      return c.json(await service.getTemplate(parseInt(idParam, 10)))
    } catch (error) {
      if (error instanceof PressReleaseTemplateNotFoundError) {
        return c.json({ code: 'NOT_FOUND', message: 'Template not found' }, 404)
      }

      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  templateRoutes.post('/press-release-templates', async (c) => {
    let data: unknown
    try {
      data = await c.req.json()
    } catch {
      return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
    }

    const parsed = PressReleaseTemplateInputSchema.safeParse(data)
    if (!parsed.success) {
      return c.json({ code: 'INVALID_TEMPLATE', message: 'Template name, title and content are required' }, 400)
    }

    try {
      return c.json(await service.createTemplate(parsed.data), 201)
    } catch (error) {
      console.error('Database error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  return templateRoutes
}

export const pressReleaseTemplateRoutes = createPressReleaseTemplateRoutes()
