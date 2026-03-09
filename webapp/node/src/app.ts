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

const resolveCorsOrigin = () => {
  if (appEnv === 'local') {
    // Allow all localhost origins with any port
    return (origin: string) => {
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin
      }
      return undefined
    }
  }

  const baseApiUrl = process.env.APP_BASE_API_URL
  console.log(`CORS configuration for environment "${appEnv}":`, { baseApiUrl })
  if (!baseApiUrl) {
    return (origin: string) => {
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin
      }
      return undefined
    }
  }

  try {
    const allowedOrigin = new URL(baseApiUrl).origin
    return allowedOrigin
  } catch {
    return (origin: string) => {
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin
      }
      return undefined
    }
  }
}

const corsOrigin = resolveCorsOrigin()

app.use(
  '*',
  cors({
    origin: corsOrigin,
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
