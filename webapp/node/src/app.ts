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

app.use(
  '*',
  cors({
    origin: (origin) => {
      // 1. S3のフロントエンドからのアクセスを無条件で許可
      if (origin === 'http://pr-times-4.s3-website-ap-northeast-1.amazonaws.com') {
        return origin
      }
      // 2. ローカル開発環境 (localhost) からのアクセスを許可
      if (origin && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin
      }
      // 3. 環境変数で動的に設定されたURLからのアクセスを許可
      if (origin && process.env.APP_FRONTEND_URL === origin) {
        return origin
      }
      // どれにも一致しない場合のフォールバック（確実化のためS3のURLを返す）
      return 'http://pr-times-4.s3-website-ap-northeast-1.amazonaws.com'
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'], // 今後のためAuthorizationも追加推奨
    credentials: true, // フロントエンドからのFetchに必要になるケースが多いです
  })
)

app.use('/uploads/*', serveStatic({ root: './' }))
app.route('/', healthRoutes)
app.route('/', linkPreviewRoutes)
app.route('/', pressReleaseTemplateRoutes)
app.route('/', pressReleaseRoutes)
app.route('/', uploadRoutes)
app.route('/', commentRoutes)