export type LinkPreviewResult = {
  url: string
  title: string
  description: string
  image: string | null
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; PRTimesEditorBot/1.0; +https://example.com/link-preview)'

export class LinkPreviewFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
  }
}

export class LinkPreviewNotFoundError extends Error {}

export class LinkPreviewService {
  async fetchPreview(rawUrl: string): Promise<LinkPreviewResult> {
    const targetUrl = this.parseUrl(rawUrl)

    const response = await this.fetchHtml(targetUrl)
    const html = await response.text()
    const resolvedUrl = new URL(response.url)

    const preview = buildPreview(html, resolvedUrl)
    if (!preview.title) {
      throw new LinkPreviewNotFoundError('Could not extract preview information')
    }

    return preview
  }

  private parseUrl(rawUrl: string): URL {
    let targetUrl: URL
    try {
      targetUrl = new URL(rawUrl)
    } catch {
      throw new LinkPreviewFetchError('URL is invalid', 400)
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      throw new LinkPreviewFetchError('Only http and https URLs are supported', 400)
    }

    return targetUrl
  }

  private async fetchHtml(targetUrl: URL): Promise<Response> {
    let response: Response
    try {
      response = await fetch(targetUrl, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      })
    } catch {
      throw new LinkPreviewFetchError('Failed to fetch the URL', 502)
    }

    if (!response.ok) {
      throw new LinkPreviewFetchError(`Failed to fetch the URL: ${response.status}`, 502)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      throw new LinkPreviewFetchError('URL did not return an HTML document', 400)
    }

    return response
  }
}

function buildPreview(html: string, baseUrl: URL): LinkPreviewResult {
  const title =
    findMetaContent(html, 'property', 'og:title') ??
    findMetaContent(html, 'name', 'twitter:title') ??
    findTitleTag(html) ??
    baseUrl.hostname

  const description =
    findMetaContent(html, 'property', 'og:description') ??
    findMetaContent(html, 'name', 'description') ??
    findMetaContent(html, 'name', 'twitter:description') ??
    ''

  const imageValue =
    findMetaContent(html, 'property', 'og:image') ??
    findMetaContent(html, 'name', 'twitter:image') ??
    null

  const image = imageValue ? resolveMaybeRelativeUrl(imageValue, baseUrl) : null

  return {
    url: baseUrl.toString(),
    title: decodeHtml(title).trim(),
    description: decodeHtml(description).trim(),
    image,
  }
}

function findMetaContent(html: string, attributeName: 'property' | 'name', attributeValue: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]*${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]*>`,
      'i',
    ),
  ]

  for (const pattern of patterns) {
    const matched = html.match(pattern)
    if (matched?.[1]) {
      return matched[1]
    }
  }

  return null
}

function findTitleTag(html: string): string | null {
  const matched = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return matched?.[1] ?? null
}

function resolveMaybeRelativeUrl(value: string, baseUrl: URL): string | null {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const linkPreviewService = new LinkPreviewService()
