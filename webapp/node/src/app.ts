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
    return (origin: string) => {
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin
      }
      return undefined
    }
  }

  const frontendUrl = process.env.APP_FRONTEND_URL || 'http://pr-times-4.s3-website-ap-northeast-1.amazonaws.com'
  console.log(`CORS configuration for environment "${appEnv}":`, { frontendUrl })
  if (!frontendUrl) {
    return (origin: string) => {
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin
      }
      return undefined
    }
  }

  try {
    const allowedOrigin = new URL(frontendUrl).origin
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