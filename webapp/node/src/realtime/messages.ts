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
      type: 'document.steps'
      version: number
      steps: unknown[]
      content: PressReleaseContent
    }
  | {
      type: 'title.update'
      title: string
    }
  | {
      type: 'document.flush'
    }
  | ({
      type: 'presence.update'
    } & PresencePayload)

export type ServerRealtimeMessage =
  | {
      type: 'session.ready'
      clientId: string
      snapshot: Pick<PressReleaseResponse, 'title' | 'content' | 'version'>
      revision: number
      presence: PresencePayload[]
    }
  | {
      type: 'document.steps'
      sourceClientId: string
      steps: unknown[]
      clientIds: string[]
      revision: number
    }
  | {
      type: 'title.sync'
      title: string
    }
  | {
      type: 'document.saved'
      title: string
      content: PressReleaseContent
      version: number
    }
  | {
      type: 'document.resync'
      snapshot: Pick<PressReleaseResponse, 'title' | 'content' | 'version'>
      revision: number
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
