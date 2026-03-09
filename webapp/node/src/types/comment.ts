export type CommentThreadRecord = {
  id: number
  pressReleaseId: number
  anchorFrom: number
  anchorTo: number
  quote: string
  isResolved: boolean
  createdBy: string
  createdAt: Date
  resolvedAt: Date | null
}

export type CommentMessageRecord = {
  id: number
  threadId: number
  body: string
  createdBy: string
  createdAt: Date
}

export type CommentThreadResponse = {
  id: number
  press_release_id: number
  anchor_from: number
  anchor_to: number
  quote: string
  is_resolved: boolean
  created_by: string
  created_at: string
  resolved_at: string | null
  messages: CommentMessageResponse[]
}

export type CommentMessageResponse = {
  id: number
  thread_id: number
  body: string
  created_by: string
  created_at: string
}

export type CreateCommentThreadInput = {
  anchorFrom: number
  anchorTo: number
  quote: string
  body: string
  createdBy: string
}

export type CreateCommentReplyInput = {
  body: string
  createdBy: string
}
