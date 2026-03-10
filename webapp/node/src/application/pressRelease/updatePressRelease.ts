import { pressReleaseService, type PressReleaseService } from '../../services/pressReleaseService.js'
import type { UpdatePressReleaseInput } from '../../domain/pressRelease/entities.js'

export async function updatePressRelease(
  id: number,
  input: UpdatePressReleaseInput,
  service: PressReleaseService = pressReleaseService,
) {
  return service.updatePressRelease(id, input)
}
