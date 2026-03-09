import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.png', '.gif']);
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);
export const uploadRoutes = new Hono();
uploadRoutes.post('/uploads/images', async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
        return c.json({ code: 'INVALID_FILE', message: 'Image file is required' }, 400);
    }
    const extension = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        return c.json({ code: 'UNSUPPORTED_EXTENSION', message: 'Only .jpg/.png/.gif are supported' }, 400);
    }
    if (!ALLOWED_TYPES.has(file.type)) {
        return c.json({ code: 'UNSUPPORTED_TYPE', message: 'Only image/jpeg, image/png, image/gif are supported' }, 400);
    }
    if (file.size > MAX_FILE_SIZE) {
        return c.json({ code: 'FILE_TOO_LARGE', message: 'File size must be 5MB or less' }, 400);
    }
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const filePath = join(UPLOAD_DIR, fileName);
    try {
        await mkdir(UPLOAD_DIR, { recursive: true });
        const bytes = new Uint8Array(await file.arrayBuffer());
        await writeFile(filePath, bytes);
    }
    catch (error) {
        console.error('Failed to upload image:', error);
        return c.json({ code: 'UPLOAD_FAILED', message: 'Failed to upload image' }, 500);
    }
    const url = new URL(c.req.url);
    const publicUrl = `${url.protocol}//${url.host}/uploads/${fileName}`;
    return c.json({ url: publicUrl }, 201);
});
