import type {
  AgentDocumentBlock,
  AgentDocumentEditResult,
  PressReleaseContent,
  RequestAiEditInput,
} from '../types/pressRelease.js'

export class AiEditServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: 502,
  ) {
    super(message)
  }
}

function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return ''
  }

  const record = node as { text?: unknown; content?: unknown[] }
  if (typeof record.text === 'string') {
    return record.text
  }

  if (!Array.isArray(record.content)) {
    return ''
  }

  return record.content
    .map((child) => extractText(child))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapNodeType(type: unknown): AgentDocumentBlock['type'] | null {
  switch (type) {
    case 'heading':
      return 'heading'
    case 'paragraph':
      return 'paragraph'
    case 'bulletList':
      return 'bullet_list'
    case 'orderedList':
      return 'ordered_list'
    case 'blockquote':
      return 'blockquote'
    default:
      return null
  }
}

function buildAgentBlocks(content: PressReleaseContent): AgentDocumentBlock[] {
  const nodes = Array.isArray(content.content) ? content.content : []
  const blocks: AgentDocumentBlock[] = []

  nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object') {
      return
    }

    const record = node as { type?: unknown; attrs?: unknown }
    const type = mapNodeType(record.type)
    if (!type) {
      return
    }

    const text = extractText(node)
    if (!text && type !== 'paragraph') {
      return
    }

    blocks.push({
      id: `block-${index + 1}`,
      type,
      text,
      attrs: record.attrs && typeof record.attrs === 'object' ? (record.attrs as Record<string, unknown>) : undefined,
    })
  })

  if (blocks.length > 0) {
    return blocks
  }

  return [{ id: 'block-1', type: 'paragraph', text: '' }]
}

export class AiEditService {
  constructor(private readonly agentBaseUrl = process.env.AGENT_BASE_URL || 'http://agent:5000') {}

  async requestDocumentEdit(input: RequestAiEditInput): Promise<AgentDocumentEditResult> {
    const response = await fetch(`${this.agentBaseUrl}/agent/tasks/document_edit:run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          reference_docs: [],
          uploaded_materials: [],
        },
        document: {
          title: input.title,
          blocks: buildAgentBlocks(input.content),
        },
        instructions: {
          goal: input.prompt,
          language: 'ja',
        },
      }),
    })

    const payload = await response.json().catch(() => null) as
      | { result?: AgentDocumentEditResult; message?: string }
      | null

    if (!response.ok || !payload?.result) {
      throw new AiEditServiceError(
        payload?.message ?? `Agent request failed with status ${response.status}`,
        'AGENT_REQUEST_FAILED',
        502,
      )
    }

    return payload.result
  }
}

export const aiEditService = new AiEditService()
