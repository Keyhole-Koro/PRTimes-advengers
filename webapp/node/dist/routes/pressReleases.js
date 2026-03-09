import { Hono } from 'hono';
import { collaborationHub } from '../realtime/collaborationHub.js';
import { PressReleaseInputSchema } from '../schemas/pressRelease.js';
import { PressReleaseNotFoundError, PressReleaseRevisionNotFoundError, PressReleaseService, PressReleaseVersionConflictError, pressReleaseService, } from '../services/pressReleaseService.js';
export function createPressReleaseRoutes(service = pressReleaseService) {
    const pressReleaseRoutes = new Hono();
    pressReleaseRoutes.get('/press-releases/:id', async (c) => {
        const idParam = c.req.param('id');
        if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
            return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400);
        }
        const id = parseInt(idParam, 10);
        try {
            return c.json(await service.getPressRelease(id));
        }
        catch (error) {
            if (error instanceof PressReleaseNotFoundError) {
                return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404);
            }
            console.error('Database error:', error);
            return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500);
        }
    });
    pressReleaseRoutes.get('/press-releases/:id/revisions', async (c) => {
        const idParam = c.req.param('id');
        if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
            return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400);
        }
        const id = parseInt(idParam, 10);
        try {
            return c.json(await service.getPressReleaseRevisions(id));
        }
        catch (error) {
            if (error instanceof PressReleaseNotFoundError) {
                return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404);
            }
            console.error('Database error:', error);
            return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500);
        }
    });
    pressReleaseRoutes.post('/press-releases/:id', async (c) => {
        const idParam = c.req.param('id');
        if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
            return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400);
        }
        const id = parseInt(idParam, 10);
        let data;
        try {
            data = await c.req.json();
        }
        catch {
            return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400);
        }
        const parsed = PressReleaseInputSchema.safeParse(data);
        if (!parsed.success) {
            console.error('Validation error:', JSON.stringify(parsed.error.format(), null, 2));
            return c.json({ code: 'MISSING_REQUIRED_FIELDS', message: 'Title and content are required' }, 400);
        }
        try {
            const pressRelease = await service.updatePressRelease(id, parsed.data);
            collaborationHub.publishSavedSnapshot(pressRelease);
            return c.json(pressRelease);
        }
        catch (error) {
            if (error instanceof PressReleaseNotFoundError) {
                return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404);
            }
            if (error instanceof PressReleaseVersionConflictError) {
                return c.json({
                    code: 'VERSION_CONFLICT',
                    message: 'Press release has been updated by another session',
                    currentVersion: error.currentVersion,
                }, 409);
            }
            console.error('Database error:', error);
            return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500);
        }
    });
    pressReleaseRoutes.post('/press-releases/:id/revisions/:revisionId/restore', async (c) => {
        const idParam = c.req.param('id');
        const revisionIdParam = c.req.param('revisionId');
        if (!/^\d+$/.test(idParam) || parseInt(idParam, 10) <= 0) {
            return c.json({ code: 'INVALID_ID', message: 'Invalid ID' }, 400);
        }
        if (!/^\d+$/.test(revisionIdParam) || parseInt(revisionIdParam, 10) <= 0) {
            return c.json({ code: 'INVALID_REVISION_ID', message: 'Invalid revision ID' }, 400);
        }
        const id = parseInt(idParam, 10);
        const revisionId = parseInt(revisionIdParam, 10);
        try {
            const pressRelease = await service.restorePressReleaseRevision(id, revisionId);
            collaborationHub.publishSavedSnapshot(pressRelease);
            return c.json(pressRelease);
        }
        catch (error) {
            if (error instanceof PressReleaseNotFoundError) {
                return c.json({ code: 'NOT_FOUND', message: 'Press release not found' }, 404);
            }
            if (error instanceof PressReleaseRevisionNotFoundError) {
                return c.json({ code: 'REVISION_NOT_FOUND', message: 'Revision not found' }, 404);
            }
            if (error instanceof PressReleaseVersionConflictError) {
                return c.json({
                    code: 'VERSION_CONFLICT',
                    message: 'Press release has been updated by another session',
                    currentVersion: error.currentVersion,
                }, 409);
            }
            console.error('Database error:', error);
            return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500);
        }
    });
    return pressReleaseRoutes;
}
export const pressReleaseRoutes = createPressReleaseRoutes();
