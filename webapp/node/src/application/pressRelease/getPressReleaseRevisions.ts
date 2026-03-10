import { pressReleaseService, type PressReleaseService } from '../../services/pressReleaseService.js'

export async function getPressReleaseRevisions(
  id: number,
  service: PressReleaseService = pressReleaseService,
) {
  return service.getPressReleaseRevisions(id)
}
