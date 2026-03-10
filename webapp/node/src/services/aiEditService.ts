import type {
  AiEditSettings,
  AgentDocumentBlock,
  AgentDocumentEditResult,
  ConversationHistoryEntry,
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

function normalizeSettingList(values: string[] | undefined): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined
  }

  const normalized = values
    .map((value) => value.trim())
    .filter((value, index, array) => value !== '' && array.indexOf(value) === index)

  return normalized.length > 0 ? normalized : undefined
}

function buildAgentInstructions(prompt: string, settings: AiEditSettings | undefined): Record<string, unknown> {
  return {
    goal: prompt,
    language: 'ja',
    audience: settings?.target_audience?.trim() || undefined,
    style: settings?.writing_style?.trim() || undefined,
    tone: settings?.tone?.trim() || undefined,
    brand_voice: settings?.brand_voice?.trim() || undefined,
    focus_points: normalizeSettingList(settings?.focus_points),
    priority_checks: normalizeSettingList(settings?.priority_checks),
  }
}

type DeterministicInstruction = {
  paragraphIndex: number
  position: 'prefix' | 'suffix'
  token: string
}

function parseInstruction(prompt: string): Omit<DeterministicInstruction, 'paragraphIndex'> & { paragraphIndex?: number } | null {
  const match = prompt.match(/(?:(\d+)つ目の段落|同じ段落)の(先頭|末尾)に「([^」]+)」(?:を)?(?:も)?追加してください。?/) 
  if (!match) {
    return null
  }

  return {
    paragraphIndex: match[1] ? Number.parseInt(match[1], 10) : undefined,
    position: match[2] === '先頭' ? 'prefix' : 'suffix',
    token: match[3],
  }
}

function resolveParagraphIndex(
  prompt: string,
  conversationHistory: ConversationHistoryEntry[] | undefined,
): DeterministicInstruction | null {
  const currentInstruction = parseInstruction(prompt)
  if (!currentInstruction) {
    return null
  }

  if (typeof currentInstruction.paragraphIndex === 'number') {
    return currentInstruction as DeterministicInstruction
  }

  const previousUserInstruction = [...(conversationHistory ?? [])]
    .reverse()
    .find((entry) => entry.role === 'user' && /\d+つ目の段落/.test(entry.text))

  if (!previousUserInstruction) {
    return null
  }

  const previousInstruction = parseInstruction(previousUserInstruction.text)
  if (!previousInstruction || typeof previousInstruction.paragraphIndex !== 'number') {
    return null
  }

  return {
    paragraphIndex: previousInstruction.paragraphIndex,
    position: currentInstruction.position,
    token: currentInstruction.token,
  }
}

function buildDeterministicEditResult(input: RequestAiEditInput): AgentDocumentEditResult | null {
  const instruction = resolveParagraphIndex(input.prompt, input.conversation_history)
  if (!instruction) {
    return null
  }

  const paragraphBlocks = buildAgentBlocks(input.content).filter((block) => block.type === 'paragraph')
  const targetBlock = paragraphBlocks[instruction.paragraphIndex - 1]
  if (!targetBlock) {
    return null
  }

  const nextText = instruction.position === 'prefix'
    ? `${instruction.token}${targetBlock.text}`
    : `${targetBlock.text}${instruction.token}`

  const positionLabel = instruction.position === 'prefix' ? '先頭' : '末尾'
  const summary = `${instruction.paragraphIndex}つ目の段落の${positionLabel}に「${instruction.token}」を追加します。`

  return {
    summary,
    suggestions: [
      {
        id: `deterministic-${instruction.paragraphIndex}-${instruction.position}-${instruction.token}`,
        category: 'body',
        summary,
        reason: '単純な追記指示のため、決定的な編集提案を返しました。',
        operations: [
          {
            op: 'modify',
            block_id: targetBlock.id,
            before: targetBlock,
            after: {
              ...targetBlock,
              text: nextText,
            },
            reason: `段落の${positionLabel}に指定文字列を追加します。`,
          },
        ],
      },
    ],
  }
}

export class AiEditService {
  constructor(private readonly agentBaseUrl = process.env.AGENT_BASE_URL || 'http://agent:5000') {}

  async requestDocumentEdit(input: RequestAiEditInput): Promise<AgentDocumentEditResult> {
    const deterministicResult = buildDeterministicEditResult(input)
    if (deterministicResult) {
      return deterministicResult
    }

    let response: Response
    try {
      response = await fetch(`${this.agentBaseUrl}/agent/tasks/document_edit:run`, {
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
          instructions: buildAgentInstructions(input.prompt, input.ai_settings),
        }),
      })
    } catch (error) {
      throw new AiEditServiceError(
        error instanceof Error ? error.message : 'Agent request failed.',
        'AGENT_REQUEST_FAILED',
        502,
      )
    }

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
