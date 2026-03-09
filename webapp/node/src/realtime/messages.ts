import type { PressReleaseContent, PressReleaseResponse } from '../types/pressRelease.js'

export type PresencePayload = {
  userId: string
  name: string
  color: string
  selection: {
    from: number
    to: number
  }
}

export type ClientRealtimeMessage =
  | {
      type: 'document.update'
      title: string
      content: PressReleaseContent
      version: number
    }
  | ({
      type: 'presence.update'
    } & PresencePayload)

export type ServerRealtimeMessage =
  | {
      type: 'session.ready'
      clientId: string
      snapshot: Pick<PressReleaseResponse, 'title' | 'content' | 'version'>
      presence: PresencePayload[]
    }
  | {
      type: 'document.sync'
      sourceClientId: string
      title: string
      content: PressReleaseContent
      version: number
    }
  | {
      type: 'document.saved'
      title: string
      content: PressReleaseContent
      version: number
    }
  | {
      type: 'presence.snapshot'
      users: PresencePayload[]
    }

export function parseClientRealtimeMessage(rawMessage: string): ClientRealtimeMessage | null {
  try {
    return JSON.parse(rawMessage) as ClientRealtimeMessage
  } catch {
    return null
  }
}
