import { Hono } from 'hono'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join, resolve } from 'node:path'

export const uploadRoutes = new Hono()

const UPLOAD_DIR = resolve(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

uploadRoutes.post('/uploads/images', async (c) => {
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

  if (!uploaded.type.startsWith('image/')) {
    return c.json({ code: 'INVALID_FILE_TYPE', message: 'Only image files are allowed' }, 400)
  }

  if (uploaded.size <= 0) {
    return c.json({ code: 'EMPTY_FILE', message: 'Uploaded file is empty' }, 400)
  }

  if (uploaded.size > MAX_FILE_SIZE) {
    return c.json({ code: 'FILE_TOO_LARGE', message: 'File size must be 10MB or less' }, 400)
  }

  const originalExt = extname(uploaded.name).toLowerCase()
  const ext = EXT_TO_MIME[originalExt] ? originalExt : (MIME_TO_EXT[uploaded.type] ?? '.bin')
  const filename = `${Date.now()}-${randomUUID()}${ext}`
  const filePath = join(UPLOAD_DIR, filename)

  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
    const buffer = Buffer.from(await uploaded.arrayBuffer())
    await writeFile(filePath, buffer)
  } catch {
    return c.json({ code: 'UPLOAD_FAILED', message: 'Failed to upload image' }, 500)
  }

  const origin = new URL(c.req.url).origin
  return c.json({ url: `${origin}/uploads/${filename}` }, 201)
})

uploadRoutes.get('/uploads/:filename', async (c) => {
  const filename = c.req.param('filename')
  if (!filename || filename.includes('/') || filename.includes('\\')) {
    return c.json({ code: 'INVALID_FILE_PATH', message: 'Invalid file path' }, 400)
  }

  const filePath = join(UPLOAD_DIR, filename)

  try {
    const fileBuffer = await readFile(filePath)
    const ext = extname(filename).toLowerCase()
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream'
    return new Response(fileBuffer, {
      status: 200,
      headers: { 'Content-Type': contentType },
    })
  } catch {
    return c.json({ code: 'FILE_NOT_FOUND', message: 'File not found' }, 404)
  }
})
