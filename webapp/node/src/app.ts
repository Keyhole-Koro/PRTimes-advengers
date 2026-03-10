import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { config } from './config.js'
import { healthRoutes } from './interfaces/http/routes/health.js'
import { linkPreviewRoutes } from './interfaces/http/routes/linkPreviews.js'
import { pressReleaseTemplateRoutes } from './interfaces/http/routes/pressReleaseTemplates.js'
import { pressReleaseRoutes } from './interfaces/http/routes/pressReleases.js'
import { uploadRoutes } from './interfaces/http/routes/uploads.js'
import { commentRoutes } from './interfaces/http/routes/comments.js'

export const app = new Hono()

app.use(
  '*',
  cors({
    origin: config.isAllowedCorsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
)

app.use('/uploads/*', serveStatic({ root: './' }))
app.route('/', healthRoutes)
app.route('/', linkPreviewRoutes)
app.route('/', pressReleaseTemplateRoutes)
app.route('/', pressReleaseRoutes)
app.route('/', uploadRoutes)
app.route('/', commentRoutes)
