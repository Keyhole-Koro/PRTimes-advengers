import { pressReleaseService, type PressReleaseService } from '../../services/pressReleaseService.js'
import type { CreatePressReleaseInput } from '../../domain/pressRelease/entities.js'

export async function createPressRelease(
  input: CreatePressReleaseInput,
  service: PressReleaseService = pressReleaseService,
) {
  return service.createPressRelease(input)
}
