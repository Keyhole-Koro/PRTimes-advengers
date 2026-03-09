import { ensureDatabaseSchema } from '../db/schemaSetup.js';
import { pressReleaseTemplateRepository } from '../repositories/pressReleaseTemplateRepository.js';
import { formatTimestamp } from '../utils/formatTimestamp.js';
export class PressReleaseTemplateNotFoundError extends Error {
}
export class PressReleaseTemplateService {
    async getTemplates() {
        await ensureDatabaseSchema();
        const templates = await pressReleaseTemplateRepository.findAll();
        return templates.map(toResponse);
    }
    async createTemplate(input) {
        await ensureDatabaseSchema();
        const template = await pressReleaseTemplateRepository.create(input);
        return toResponse(template);
    }
    async getTemplate(id) {
        await ensureDatabaseSchema();
        const template = await pressReleaseTemplateRepository.findById(id);
        if (!template) {
            throw new PressReleaseTemplateNotFoundError();
        }
        return toResponse(template);
    }
}
function toResponse(template) {
    return {
        id: template.id,
        name: template.name,
        title: template.title,
        content: template.content,
        created_at: formatTimestamp(template.createdAt),
        updated_at: formatTimestamp(template.updatedAt),
    };
}
export const pressReleaseTemplateService = new PressReleaseTemplateService();
