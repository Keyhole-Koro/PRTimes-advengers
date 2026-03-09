import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { healthRoutes } from './routes/health.js';
import { pressReleaseRoutes } from './routes/pressReleases.js';
import { uploadRoutes } from './routes/uploads.js';
export const app = new Hono();
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
}));
app.use('/uploads/*', serveStatic({ root: './' }));
app.route('/', healthRoutes);
app.route('/', pressReleaseRoutes);
app.route('/', uploadRoutes);
