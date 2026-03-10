import { aiEditService, type AiEditService } from '../../services/aiEditService.js'
import type { RequestAiEditInput } from '../../domain/ai/entities.js'

export async function requestDocumentEdit(
  input: RequestAiEditInput,
  service: AiEditService = aiEditService,
) {
  return service.requestDocumentEdit(input)
}
