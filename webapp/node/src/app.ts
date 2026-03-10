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
  const frontendUrl = process.env.APP_FRONTEND_URL || 'http://pr-times-4.s3-website-ap-northeast-1.amazonaws.com'
  let allowedFrontendOrigin: string;

  try {
    allowedFrontendOrigin = new URL(frontendUrl).origin
  } catch {
    // 万が一URLパースに失敗した場合の安全なフォールバック
    allowedFrontendOrigin = 'http://pr-times-4.s3-website-ap-northeast-1.amazonaws.com'
  }

  // リクエストのoriginを動的に評価して許可するかどうかを返す
  return (origin: string) => {
    // originが存在しない場合（同一オリジンや一部のツールからのアクセス等）はundefinedを返す
    if (!origin) return undefined

    // 1. ローカル開発環境 (localhost) を許可
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return origin
    }

    // 2. フロントエンドのURLを許可
    if (origin === allowedFrontendOrigin) {
      return origin
    }

    // 上記以外は許可しない
    return undefined
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