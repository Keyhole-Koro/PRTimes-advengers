import { Hono } from 'hono'
import {
  UploadNotFoundError,
  UploadService,
  UploadValidationError,
  uploadService,
} from '../services/uploadService.js'

export function createUploadRoutes(service: UploadService = uploadService): Hono {
  const routes = new Hono()

  routes.post('/uploads/images', async (c) => {
    let formData: FormData
    try {
      formData = await c.req.raw.formData()
    } catch {
      return c.json({ code: 'INVALID_FORM_DATA', message: 'Invalid form data' }, 400)
    }

    const uploaded = formData.get('file')
    if (!(uploaded instanceof File)) {
      return c.json({ code: 'MISSING_FILE', message: 'Image file is required' }, 400)
    }

    try {
      const { filename } = await service.saveImage(uploaded)
      const origin = new URL(c.req.url).origin
      return c.json({ url: `${origin}/uploads/${filename}` }, 201)
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return c.json({ code: error.code, message: error.message }, 400)
      }

      console.error('Upload error:', error)
      return c.json({ code: 'UPLOAD_FAILED', message: 'Failed to upload image' }, 500)
    }
  })

  routes.get('/uploads/:filename', async (c) => {
    const filename = c.req.param('filename')

    try {
      const { buffer, contentType } = await service.getImage(filename)
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: { 'Content-Type': contentType },
      })
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return c.json({ code: error.code, message: error.message }, 400)
      }

      if (error instanceof UploadNotFoundError) {
        return c.json({ code: 'FILE_NOT_FOUND', message: 'File not found' }, 404)
      }

      console.error('File read error:', error)
      return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    }
  })

  return routes
}

export const uploadRoutes = createUploadRoutes()
