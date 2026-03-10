export function presentNotFound(message = 'Press release not found') {
  return { code: 'NOT_FOUND', message }
}

export function presentRevisionNotFound() {
  return { code: 'REVISION_NOT_FOUND', message: 'Revision not found' }
}

export function presentVersionConflict(currentVersion: number) {
  return {
    code: 'VERSION_CONFLICT',
    message: 'Press release has been updated by another session',
    currentVersion,
  }
}

export function presentInternalError() {
  return { code: 'INTERNAL_ERROR', message: 'Internal server error' }
}

export function presentInvalidPressReleasePayload() {
  return { code: 'MISSING_REQUIRED_FIELDS', message: 'Title and content are required' }
}

export function presentInvalidAiPayload() {
  return { code: 'MISSING_REQUIRED_FIELDS', message: 'Prompt, title and content are required' }
}
