import type { Context } from 'hono'
import { PressReleaseAiEditRequestSchema, PressReleaseAiTagSuggestRequestSchema, PressReleaseInputSchema } from '../../../schemas/pressRelease.js'
import { requestDocumentEdit, requestTagSuggestions } from '../../../application/ai/requestDocumentEdit.js'
import { createPressRelease } from '../../../application/pressRelease/createPressRelease.js'
import { getPressRelease } from '../../../application/pressRelease/getPressRelease.js'
import { getPressReleaseRevisions } from '../../../application/pressRelease/getPressReleaseRevisions.js'
import { listPressReleases } from '../../../application/pressRelease/listPressReleases.js'
import { restoreRevision } from '../../../application/pressRelease/restoreRevision.js'
import { updatePressRelease } from '../../../application/pressRelease/updatePressRelease.js'
import { EMPTY_CONTENT } from '../../../interfaces/http/presenters/pressReleaseViewDefaults.js'
import {
  PressReleaseNotFoundError,
  PressReleaseRevisionNotFoundError,
  PressReleaseVersionConflictError,
} from '../../../domain/pressRelease/errors.js'
import { AiEditServiceError } from '../../../services/aiEditService.js'
import {
  presentInternalError,
  presentInvalidCreatePressReleasePayload,
  presentInvalidAiPayload,
  presentInvalidPressReleasePayload,
  presentNotFound,
  presentRevisionNotFound,
  presentVersionConflict,
} from '../presenters/pressReleasePresenter.js'

export async function listPressReleasesAction(c: Context) {
  try {
    return c.json(await listPressReleases())
  } catch (error) {
    console.error('Database error:', error)
    return c.json(presentInternalError(), 500)
  }
}

export async function createPressReleaseAction(c: Context, data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return c.json(presentInvalidCreatePressReleasePayload(), 400)
  }

  const record = data as { title?: unknown; content?: unknown }
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  if (title === '') {
    return c.json(presentInvalidCreatePressReleasePayload(), 400)
  }

  try {
    return c.json(
      await createPressRelease({
        title,
        content: record.content && typeof record.content === 'object' ? (record.content as Record<string, unknown>) : EMPTY_CONTENT,
      }),
      201
    )
  } catch (error) {
    console.error('Database error:', error)
    return c.json(presentInternalError(), 500)
  }
}

export async function getPressReleaseAction(c: Context, id: number) {
  try {
    return c.json(await getPressRelease(id))
  } catch (error) {
    if (error instanceof PressReleaseNotFoundError) {
      return c.json(presentNotFound(), 404)
    }

    console.error('Database error:', error)
    return c.json(presentInternalError(), 500)
  }
}

export async function getPressReleaseRevisionsAction(c: Context, id: number) {
  try {
    return c.json(await getPressReleaseRevisions(id))
  } catch (error) {
    if (error instanceof PressReleaseNotFoundError) {
      return c.json(presentNotFound(), 404)
    }

    console.error('Database error:', error)
    return c.json(presentInternalError(), 500)
  }
}

export async function updatePressReleaseAction(c: Context, id: number, data: unknown) {
  const parsed = PressReleaseInputSchema.safeParse(data)
  if (!parsed.success) {
    console.error('Validation error:', JSON.stringify(parsed.error.format(), null, 2))
    return c.json(presentInvalidPressReleasePayload(), 400)
  }

  try {
    return c.json(await updatePressRelease(id, parsed.data))
  } catch (error) {
    if (error instanceof PressReleaseNotFoundError) {
      return c.json(presentNotFound(), 404)
    }

    if (error instanceof PressReleaseVersionConflictError) {
      return c.json(presentVersionConflict(error.currentVersion), 409)
    }

    console.error('Database error:', error)
    return c.json(presentInternalError(), 500)
  }
}

export async function requestAiEditAction(c: Context, id: number, data: unknown) {
  const parsed = PressReleaseAiEditRequestSchema.safeParse(data)
  if (!parsed.success) {
    return c.json(presentInvalidAiPayload(), 400)
  }

  try {
    await getPressRelease(id)
    return c.json(await requestDocumentEdit(parsed.data))
  } catch (error) {
    if (error instanceof PressReleaseNotFoundError) {
      return c.json(presentNotFound(), 404)
    }

    if (error instanceof AiEditServiceError) {
      return c.json({ code: error.code, message: error.message }, error.statusCode)
    }

    console.error('AI edit error:', error)
    return c.json(presentInternalError(), 500)
  }
}

export async function requestAiTagSuggestAction(c: Context, id: number, data: unknown) {
  const parsed = PressReleaseAiTagSuggestRequestSchema.safeParse(data)
  if (!parsed.success) {
    return c.json(presentInvalidAiPayload(), 400)
  }

  try {
    await getPressRelease(id)
    return c.json(await requestTagSuggestions({
      prompt: 'タグ候補を提案してください。',
      title: parsed.data.title,
      content: parsed.data.content,
      ai_settings: parsed.data.ai_settings,
    }))
  } catch (error) {
    if (error instanceof PressReleaseNotFoundError) {
      return c.json(presentNotFound(), 404)
    }

    if (error instanceof AiEditServiceError) {
      return c.json({ code: error.code, message: error.message }, error.statusCode)
    }

    console.error('AI tag suggest error:', error)
    return c.json(presentInternalError(), 500)
  }
}

export async function restoreRevisionAction(c: Context, id: number, revisionId: number) {
  try {
    return c.json(await restoreRevision(id, revisionId))
  } catch (error) {
    if (error instanceof PressReleaseNotFoundError) {
      return c.json(presentNotFound(), 404)
    }

    if (error instanceof PressReleaseRevisionNotFoundError) {
      return c.json(presentRevisionNotFound(), 404)
    }

    if (error instanceof PressReleaseVersionConflictError) {
      return c.json(presentVersionConflict(error.currentVersion), 409)
    }

    console.error('Database error:', error)
    return c.json(presentInternalError(), 500)
  }
}
