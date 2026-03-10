import { pressReleaseService, type PressReleaseService } from '../../services/pressReleaseService.js'

export async function getPressRelease(id: number, service: PressReleaseService = pressReleaseService) {
  return service.getPressRelease(id)
}
