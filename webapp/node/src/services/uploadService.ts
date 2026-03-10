import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join, resolve } from 'node:path'

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

export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
  }
}

export class UploadNotFoundError extends Error {}

export class UploadService {
  async saveImage(file: File): Promise<{ filename: string }> {
    this.validateImage(file)

    const originalExt = extname(file.name).toLowerCase()
    const ext = EXT_TO_MIME[originalExt] ? originalExt : (MIME_TO_EXT[file.type] ?? '.bin')
    const filename = `${Date.now()}-${randomUUID()}${ext}`
    const filePath = join(UPLOAD_DIR, filename)

    try {
      await mkdir(UPLOAD_DIR, { recursive: true })
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)
    } catch {
      throw new Error('Failed to upload image')
    }

    return { filename }
  }

  async getImage(filename: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!filename || filename.includes('/') || filename.includes('\\')) {
      throw new UploadValidationError('Invalid file path', 'INVALID_FILE_PATH')
    }

    const filePath = join(UPLOAD_DIR, filename)

    try {
      const fileBuffer = await readFile(filePath)
      const ext = extname(filename).toLowerCase()
      const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream'
      return { buffer: fileBuffer, contentType }
    } catch {
      throw new UploadNotFoundError('File not found')
    }
  }

  private validateImage(file: File): void {
    if (!file.type.startsWith('image/')) {
      throw new UploadValidationError('Only image files are allowed', 'INVALID_FILE_TYPE')
    }

    if (file.size <= 0) {
      throw new UploadValidationError('Uploaded file is empty', 'EMPTY_FILE')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new UploadValidationError('File size must be 10MB or less', 'FILE_TOO_LARGE')
    }
  }
}

export const uploadService = new UploadService()
