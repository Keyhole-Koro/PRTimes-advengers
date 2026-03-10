import { pressReleaseService, type PressReleaseService } from '../../services/pressReleaseService.js'

export async function listPressReleases(service: PressReleaseService = pressReleaseService) {
  return service.listPressReleases()
}
