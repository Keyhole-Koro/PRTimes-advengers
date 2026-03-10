export type AppEnv = 'local' | 'prod'

type EnvironmentConfig = {
  frontendUrl: string
  port: number
}

type AppConfig = EnvironmentConfig & {
  env: AppEnv
  isAllowedCorsOrigin: (origin: string) => string | undefined
  corsAllowedFrontendOrigin: string
}

const environmentDefaults: Record<AppEnv, EnvironmentConfig> = {
  local: {
    frontendUrl: 'http://localhost:5173',
    port: 8080,
  },
  prod: {
    frontendUrl: 'http://pr-times-4.s3-website-ap-northeast-1.amazonaws.com',
    port: 8080,
  },
}

function resolveAppEnv(value: string | undefined): AppEnv {
  return value === 'prod' ? 'prod' : 'local'
}

function resolveOrigin(url: string, fallbackUrl: string): string {
  try {
    return new URL(url).origin
  } catch {
    return new URL(fallbackUrl).origin
  }
}

const env = resolveAppEnv(process.env.APP_ENV)
const defaults = environmentDefaults[env]
const corsAllowedFrontendOrigin = resolveOrigin(
  process.env.APP_FRONTEND_URL || defaults.frontendUrl,
  defaults.frontendUrl,
)

export const config: AppConfig = {
  env,
  frontendUrl: process.env.APP_FRONTEND_URL || defaults.frontendUrl,
  port: Number.parseInt(process.env.PORT || String(defaults.port), 10),
  corsAllowedFrontendOrigin,
  isAllowedCorsOrigin: (origin: string) => {
    if (!origin) {
      return undefined
    }

    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return origin
    }

    if (origin === corsAllowedFrontendOrigin) {
      return origin
    }

    return undefined
  },
}

export const environmentConfigs = {
  local: {
    ...environmentDefaults.local,
    frontendUrl: env === 'local' ? config.frontendUrl : environmentDefaults.local.frontendUrl,
    port: env === 'local' ? config.port : environmentDefaults.local.port,
  },
  prod: {
    ...environmentDefaults.prod,
    frontendUrl: env === 'prod' ? config.frontendUrl : environmentDefaults.prod.frontendUrl,
    port: env === 'prod' ? config.port : environmentDefaults.prod.port,
  },
} satisfies Record<AppEnv, EnvironmentConfig>
