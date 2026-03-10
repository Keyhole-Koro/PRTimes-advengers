import { pressReleaseService, type PressReleaseService } from '../../services/pressReleaseService.js'

export async function restoreRevision(
  pressReleaseId: number,
  revisionId: number,
  service: PressReleaseService = pressReleaseService,
) {
  return service.restorePressReleaseRevision(pressReleaseId, revisionId)
}
