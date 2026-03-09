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

export type PressReleaseResponse = {
  id: number
  title: string
  content: PressReleaseContent
  version: number
  created_at: string
  updated_at: string
}

export type PressReleaseRevisionResponse = {
  id: number
  press_release_id: number
  version: number
  title: string
  content: PressReleaseContent
  created_at: string
}

export type UpdatePressReleaseInput = {
  title: string
  content: PressReleaseContent
  version?: number
}
