import { pressReleaseRepository } from '../repositories/pressReleaseRepository.js'
import type {
  CreatePressReleaseInput,
  PressReleaseRecord,
  PressReleaseRevisionRecord,
  PressReleaseRevisionResponse,
  PressReleaseResponse,
  UpdatePressReleaseInput,
} from '../types/pressRelease.js'
import { formatTimestamp } from '../utils/formatTimestamp.js'

export class PressReleaseNotFoundError extends Error {}
export class PressReleaseRevisionNotFoundError extends Error {}

export class PressReleaseVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Press release version conflict')
  }
}

export class PressReleaseService {
  private onSaved: ((pressRelease: PressReleaseResponse) => void) | null = null

  /** Register a callback that fires after a press release is saved */
  onPressReleaseSaved(callback: (pressRelease: PressReleaseResponse) => void): void {
    this.onSaved = callback
  }

  async listPressReleases(): Promise<PressReleaseResponse[]> {
    const pressReleases = await pressReleaseRepository.findAll()
    return pressReleases.map(toResponse)
  }

  async getPressRelease(id: number): Promise<PressReleaseResponse> {
    const pressRelease = await pressReleaseRepository.findById(id)
    if (!pressRelease) {
      throw new PressReleaseNotFoundError()
    }

    return toResponse(pressRelease)
  }

  async updatePressRelease(
    id: number,
    input: UpdatePressReleaseInput,
    options: { notifySaved?: boolean } = {}
  ): Promise<PressReleaseResponse> {
    const result = await pressReleaseRepository.update(id, input)
    if (result.status === 'not_found') {
      throw new PressReleaseNotFoundError()
    }

    if (result.status === 'version_conflict') {
      throw new PressReleaseVersionConflictError(result.pressRelease.version)
    }

    const response = toResponse(result.pressRelease)
    if (options.notifySaved !== false) {
      this.onSaved?.(response)
    }
    return response
  }

  async createPressRelease(input: CreatePressReleaseInput): Promise<PressReleaseResponse> {
    const response = toResponse(await pressReleaseRepository.create(input))
    this.onSaved?.(response)
    return response
  }

  async getPressReleaseRevisions(id: number): Promise<PressReleaseRevisionResponse[]> {
    const pressRelease = await pressReleaseRepository.findById(id)
    if (!pressRelease) {
      throw new PressReleaseNotFoundError()
    }

    const revisions = await pressReleaseRepository.findRevisionsByPressReleaseId(id)
    return revisions.map(toRevisionResponse)
  }

  async restorePressReleaseRevision(id: number, revisionId: number): Promise<PressReleaseResponse> {
    const pressRelease = await pressReleaseRepository.findById(id)
    if (!pressRelease) {
      throw new PressReleaseNotFoundError()
    }

    const revision = await pressReleaseRepository.findRevisionById(id, revisionId)
    if (!revision) {
      throw new PressReleaseRevisionNotFoundError()
    }

    return this.updatePressRelease(id, {
      title: revision.title,
      content: revision.content,
      version: pressRelease.version,
    })
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

function toRevisionResponse(revision: PressReleaseRevisionRecord): PressReleaseRevisionResponse {
  return {
    id: revision.id,
    press_release_id: revision.pressReleaseId,
    version: revision.version,
    title: revision.title,
    content: revision.content,
    created_at: formatTimestamp(revision.createdAt),
  }
}
