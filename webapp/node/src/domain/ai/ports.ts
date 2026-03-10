import type { AgentDocumentEditResult, RequestAiEditInput } from './entities.js'

export interface AiDocumentEditPort {
  requestDocumentEdit(input: RequestAiEditInput): Promise<AgentDocumentEditResult>
}
