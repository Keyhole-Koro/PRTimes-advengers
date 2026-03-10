import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { healthRoutes } from './routes/health.js'
import { linkPreviewRoutes } from './routes/linkPreviews.js'
import { pressReleaseTemplateRoutes } from './routes/pressReleaseTemplates.js'
import { pressReleaseRoutes } from './routes/pressReleases.js'
import { uploadRoutes } from './routes/uploads.js'
import { commentRoutes } from './routes/comments.js'

export const app = new Hono()

const appEnv = process.env.APP_ENV === 'prod' ? 'prod' : 'local'

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return ''
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin
      if (origin === 'http://pr-times-4.s3-website-ap-northeast-1.amazonaws.com') return origin
      if (process.env.APP_FRONTEND_URL && origin === process.env.APP_FRONTEND_URL) return origin
      return undefined
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)

app.use('/uploads/*', serveStatic({ root: './' }))
app.route('/', healthRoutes)
app.route('/', linkPreviewRoutes)
app.route('/', pressReleaseTemplateRoutes)
app.route('/', pressReleaseRoutes)
app.route('/', uploadRoutes)
app.route('/', commentRoutes)