import type { Context } from 'hono'

/**
 * Parse and validate a numeric route parameter.
 * Returns the parsed number or null if invalid.
 */
export function parseIdParam(c: Context, paramName: string): number | null {
  const raw = c.req.param(paramName)
  if (!raw || !/^\d+$/.test(raw) || parseInt(raw, 10) <= 0) {
    return null
  }
  return parseInt(raw, 10)
}

/**
 * Safely parse the JSON body of a request.
 * Returns the parsed data or null if the body is not valid JSON.
 */
export async function parseJsonBody(c: Context): Promise<unknown | null> {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

/** Standard error response for an invalid numeric ID */
export function invalidIdResponse(c: Context, label = 'ID') {
  return c.json({ code: 'INVALID_ID', message: `Invalid ${label}` }, 400)
}

/** Standard error response for invalid JSON */
export function invalidJsonResponse(c: Context) {
  return c.json({ code: 'INVALID_JSON', message: 'Invalid JSON' }, 400)
}
