import { ensureDatabaseSchema } from '../db/schemaSetup.js'
import { pressReleaseTemplateRepository } from '../repositories/pressReleaseTemplateRepository.js'
import type {
  CreatePressReleaseTemplateInput,
  PressReleaseTemplateRecord,
  PressReleaseTemplateResponse,
} from '../types/pressRelease.js'
import { formatTimestamp } from '../utils/formatTimestamp.js'

export class PressReleaseTemplateNotFoundError extends Error {}

export class PressReleaseTemplateService {
  async getTemplates(): Promise<PressReleaseTemplateResponse[]> {
    await ensureDatabaseSchema()
    const templates = await pressReleaseTemplateRepository.findAll()
    return templates.map(toResponse)
  }

  async createTemplate(input: CreatePressReleaseTemplateInput): Promise<PressReleaseTemplateResponse> {
    await ensureDatabaseSchema()
    const template = await pressReleaseTemplateRepository.create(input)
    return toResponse(template)
  }

  async getTemplate(id: number): Promise<PressReleaseTemplateResponse> {
    await ensureDatabaseSchema()
    const template = await pressReleaseTemplateRepository.findById(id)
    if (!template) {
      throw new PressReleaseTemplateNotFoundError()
    }

    return toResponse(template)
  }
}

function toResponse(template: PressReleaseTemplateRecord): PressReleaseTemplateResponse {
  return {
    id: template.id,
    name: template.name,
    title: template.title,
    content: template.content,
    created_at: formatTimestamp(template.createdAt),
    updated_at: formatTimestamp(template.updatedAt),
  }
}

export const pressReleaseTemplateService = new PressReleaseTemplateService()
