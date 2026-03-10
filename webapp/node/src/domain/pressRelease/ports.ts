import type {
  PressReleaseRecord,
  PressReleaseRevisionRecord,
  UpdatePressReleaseInput,
} from './entities.js'

export type PressReleaseUpdateResult =
  | { status: 'updated'; pressRelease: PressReleaseRecord }
  | { status: 'not_found' }
  | { status: 'version_conflict'; pressRelease: PressReleaseRecord }

export interface PressReleaseRepositoryPort {
  findById(id: number): Promise<PressReleaseRecord | null>
  update(id: number, input: UpdatePressReleaseInput): Promise<PressReleaseUpdateResult>
  findRevisionsByPressReleaseId(id: number): Promise<PressReleaseRevisionRecord[]>
  findRevisionById(pressReleaseId: number, revisionId: number): Promise<PressReleaseRevisionRecord | null>
}
