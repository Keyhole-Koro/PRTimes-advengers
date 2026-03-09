import { ensureDatabaseSchema } from '../db/schemaSetup.js'
import { pressReleaseRepository } from '../repositories/pressReleaseRepository.js'
import type {
  PressReleaseRecord,
  PressReleaseResponse,
  UpdatePressReleaseInput,
} from '../types/pressRelease.js'
import { formatTimestamp } from '../utils/formatTimestamp.js'

export class PressReleaseNotFoundError extends Error {}

export class PressReleaseVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Press release version conflict')
  }
}

export class PressReleaseService {
  async getPressRelease(id: number): Promise<PressReleaseResponse> {
    await ensureDatabaseSchema()

    const pressRelease = await pressReleaseRepository.findById(id)
    if (!pressRelease) {
      throw new PressReleaseNotFoundError()
    }

    return toResponse(pressRelease)
  }

  async updatePressRelease(id: number, input: UpdatePressReleaseInput): Promise<PressReleaseResponse> {
    await ensureDatabaseSchema()

    const result = await pressReleaseRepository.update(id, input)
    if (result.status === 'not_found') {
      throw new PressReleaseNotFoundError()
    }

    if (result.status === 'version_conflict') {
      throw new PressReleaseVersionConflictError(result.pressRelease.version)
    }

    return toResponse(result.pressRelease)
  }
}

function toResponse(pressRelease: PressReleaseRecord): PressReleaseResponse {
  return {
    id: pressRelease.id,
    title: pressRelease.title,
    content: pressRelease.content,
    version: pressRelease.version,
    created_at: formatTimestamp(pressRelease.createdAt),
    updated_at: formatTimestamp(pressRelease.updatedAt),
  }
}

export const pressReleaseService = new PressReleaseService()
