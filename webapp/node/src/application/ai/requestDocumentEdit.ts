import { aiEditService, type AiEditService } from '../../services/aiEditService.js'
import type { RequestAiEditInput } from '../../domain/ai/entities.js'

export async function requestDocumentEdit(
  input: RequestAiEditInput,
  service: AiEditService = aiEditService,
) {
  return service.requestDocumentEdit(input)
}

export async function requestTagSuggestions(
  input: RequestAiEditInput,
  service: AiEditService = aiEditService,
) {
  return service.requestTagSuggestions(input)
}

export async function requestAiSettingSuggestions(
  input: RequestAiEditInput,
  service: AiEditService = aiEditService,
) {
  return service.requestAiSettingSuggestions(input)
}
