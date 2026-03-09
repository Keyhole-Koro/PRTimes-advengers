import { commentRepository } from '../repositories/commentRepository.js'
import type {
  CommentThreadRecord,
  CommentMessageRecord,
  CommentThreadResponse,
  CommentMessageResponse,
  CreateCommentThreadInput,
  CreateCommentReplyInput,
} from '../types/comment.js'
import { formatTimestamp } from '../utils/formatTimestamp.js'

export class CommentThreadNotFoundError extends Error {}

function toMessageResponse(message: CommentMessageRecord): CommentMessageResponse {
  return {
    id: message.id,
    thread_id: message.threadId,
    body: message.body,
    created_by: message.createdBy,
    created_at: formatTimestamp(message.createdAt),
  }
}

function toThreadResponse(
  thread: CommentThreadRecord,
  messages: CommentMessageRecord[],
): CommentThreadResponse {
  return {
    id: thread.id,
    press_release_id: thread.pressReleaseId,
    anchor_from: thread.anchorFrom,
    anchor_to: thread.anchorTo,
    quote: thread.quote,
    is_resolved: thread.isResolved,
    created_by: thread.createdBy,
    created_at: formatTimestamp(thread.createdAt),
    resolved_at: thread.resolvedAt ? formatTimestamp(thread.resolvedAt) : null,
    messages: messages
      .filter((m) => m.threadId === thread.id)
      .map(toMessageResponse),
  }
}

export class CommentService {
  async getComments(
    pressReleaseId: number,
    includeResolved: boolean,
  ): Promise<CommentThreadResponse[]> {
    const threads = await commentRepository.findThreadsByPressReleaseId(
      pressReleaseId,
      includeResolved,
    )

    if (threads.length === 0) {
      return []
    }

    const threadIds = threads.map((t) => t.id)
    const messages = await commentRepository.findMessagesByThreadIds(threadIds)

    return threads.map((thread) => toThreadResponse(thread, messages))
  }

  async createThread(
    pressReleaseId: number,
    input: CreateCommentThreadInput,
  ): Promise<CommentThreadResponse> {
    const { thread, message } = await commentRepository.createThread(
      pressReleaseId,
      input,
    )

    return toThreadResponse(thread, [message])
  }

  async addReply(
    threadId: number,
    input: CreateCommentReplyInput,
  ): Promise<CommentMessageResponse> {
    const message = await commentRepository.addReply(threadId, input)
    if (!message) {
      throw new CommentThreadNotFoundError()
    }

    return toMessageResponse(message)
  }

  async resolveThread(threadId: number): Promise<CommentThreadResponse> {
    const thread = await commentRepository.resolveThread(threadId)
    if (!thread) {
      throw new CommentThreadNotFoundError()
    }

    const messages = await commentRepository.findMessagesByThreadIds([threadId])
    return toThreadResponse(thread, messages)
  }

  async unresolveThread(threadId: number): Promise<CommentThreadResponse> {
    const thread = await commentRepository.unresolveThread(threadId)
    if (!thread) {
      throw new CommentThreadNotFoundError()
    }

    const messages = await commentRepository.findMessagesByThreadIds([threadId])
    return toThreadResponse(thread, messages)
  }
}

export const commentService = new CommentService()
