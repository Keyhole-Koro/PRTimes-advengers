export type PressReleaseContent = Record<string, unknown>

export type PressReleaseRecord = {
  id: number
  title: string
  content: PressReleaseContent
  version: number
  createdAt: Date
  updatedAt: Date
}

export type PressReleaseRevisionRecord = {
  id: number
  pressReleaseId: number
  version: number
  title: string
  content: PressReleaseContent
  createdAt: Date
}

export type PressReleaseTemplateRecord = {
  id: number
  name: string
  title: string
  content: PressReleaseContent
  createdAt: Date
  updatedAt: Date
}

export type PressReleaseResponse = {
  id: number
  title: string
  content: PressReleaseContent
  version: number
  created_at: string
  updated_at: string
}

export type CreatePressReleaseInput = {
  title: string
  content: PressReleaseContent
}

export type PressReleaseRevisionResponse = {
  id: number
  press_release_id: number
  version: number
  title: string
  content: PressReleaseContent
  created_at: string
}

export type PressReleaseTemplateResponse = {
  id: number
  name: string
  title: string
  content: PressReleaseContent
  created_at: string
  updated_at: string
}

export type UpdatePressReleaseInput = {
  title: string
  content: PressReleaseContent
  version?: number
}

export type RequestAiEditInput = {
  prompt: string
  title: string
  content: PressReleaseContent
  conversation_history?: ConversationHistoryEntry[]
  ai_settings?: AiEditSettings
}

export type AiEditSettings = {
  target_audience?: string
  writing_style?: string
  tone?: string
  brand_voice?: string
  focus_points?: string[]
  priority_checks?: string[]
}

export type ConversationHistoryEntry = {
  role: 'user' | 'assistant'
  text: string
  created_at: string
}

export type AgentDocumentBlock = {
  id: string
  type: 'heading' | 'paragraph' | 'bullet_list' | 'ordered_list' | 'blockquote'
  text: string
  attrs?: Record<string, unknown>
}

export type AgentDocumentEditOperation =
  | {
      op: 'add'
      after_block_id: string | null
      block: AgentDocumentBlock
      reason?: string
    }
  | {
      op: 'remove'
      block_id: string
      removed_block?: AgentDocumentBlock
      reason?: string
    }
  | {
      op: 'modify'
      block_id: string
      before?: AgentDocumentBlock
      after: AgentDocumentBlock
      reason?: string
    }
  | {
      op: 'title_modify'
      before_title?: string
      after_title: string
      reason?: string
    }

export type AgentDocumentSuggestionCategory =
  | 'title'
  | 'lede'
  | 'structure'
  | 'readability'
  | 'keyword'
  | 'tag'
  | 'risk'
  | 'body'

export type AgentDocumentEditSuggestion = {
  id: string
  presentation?: "block" | "inline"
  category: AgentDocumentSuggestionCategory
  summary: string
  reason?: string
  operations: AgentDocumentEditOperation[]
}

export type AgentDocumentEditResult = {
  summary: string
  assistant_message: string
  navigation_label: string
  suggestions: AgentDocumentEditSuggestion[]
  notes?: string[]
}

export type CreatePressReleaseTemplateInput = {
  name: string
  title: string
  content: PressReleaseContent
}
