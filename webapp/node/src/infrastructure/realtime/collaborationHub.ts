import WebSocket from 'ws'
import { pressReleaseService } from '../../services/pressReleaseService.js'
import type { PressReleaseResponse } from '../../types/pressRelease.js'
import type {
  ClientRealtimeMessage,
  PresencePayload,
  ServerRealtimeMessage,
} from './messages.js'
import { presenceStore } from './presenceStore.js'

type ClientIdentity = {
  clientId: string
  pressReleaseId: number
  userId: string
  name: string
  color: string
  socket: WebSocket
}

type RoomStep = {
  step: unknown
  clientId: string
}

type RoomState = {
  snapshot: Pick<PressReleaseResponse, 'title' | 'content' | 'version'>
  revision: number
  steps: RoomStep[]
  clients: Map<string, ClientIdentity>
  pendingSaveTimer: ReturnType<typeof setTimeout> | null
  isSaving: boolean
  saveQueued: boolean
}

export class CollaborationHub {
  private readonly rooms = new Map<number, RoomState>()

  async connect(socket: WebSocket, metadata: Omit<ClientIdentity, 'socket'>): Promise<void> {
    const room = await this.getOrCreateRoom(metadata.pressReleaseId)
    const client: ClientIdentity = { ...metadata, socket }
    room.clients.set(client.clientId, client)

    this.send(socket, {
      type: 'session.ready',
      clientId: client.clientId,
      snapshot: room.snapshot,
      revision: room.revision,
      presence: this.listPresence(metadata.pressReleaseId),
    })
  }

  handleMessage(clientId: string, message: ClientRealtimeMessage): void {
    const client = this.findClient(clientId)
    if (!client) {
      return
    }

    const room = this.rooms.get(client.pressReleaseId)
    if (!room) {
      return
    }

    if (message.type === 'document.steps') {
      this.handleDocumentSteps(client, room, message)
      return
    }

    if (message.type === 'title.update') {
      room.snapshot = {
        ...room.snapshot,
        title: message.title,
      }

      this.broadcast(
        client.pressReleaseId,
        {
          type: 'title.sync',
          title: message.title,
        },
        client.clientId
      )
      this.scheduleSave(client.pressReleaseId)
      return
    }

    if (message.type === 'document.flush') {
      void this.flushRoom(client.pressReleaseId)
      return
    }

    presenceStore.upsert({
      pressReleaseId: client.pressReleaseId,
      userId: message.userId,
      name: message.name,
      color: message.color,
      selection: message.selection,
    })
    this.broadcastPresenceSnapshot(client.pressReleaseId)
  }

  disconnect(clientId: string): void {
    const client = this.findClient(clientId)
    if (!client) {
      return
    }

    const room = this.rooms.get(client.pressReleaseId)
    if (room) {
      room.clients.delete(client.clientId)
      if (room.clients.size === 0) {
        if (room.pendingSaveTimer) {
          clearTimeout(room.pendingSaveTimer)
        }
        this.rooms.delete(client.pressReleaseId)
      }
    }

    presenceStore.remove(client.pressReleaseId, client.userId)
    this.broadcastPresenceSnapshot(client.pressReleaseId)
  }

  publishSavedSnapshot(pressRelease: Pick<PressReleaseResponse, 'id' | 'title' | 'content' | 'version'>): void {
    const room = this.rooms.get(pressRelease.id)
    if (!room) {
      return
    }

    room.snapshot = {
      title: pressRelease.title,
      content: pressRelease.content,
      version: pressRelease.version,
    }
    room.revision = 0
    room.steps = []

    this.broadcast(pressRelease.id, {
      type: 'document.resync',
      snapshot: room.snapshot,
      revision: room.revision,
    })
  }

  async flushRoom(pressReleaseId: number): Promise<void> {
    const room = this.rooms.get(pressReleaseId)
    if (!room) {
      return
    }

    if (room.pendingSaveTimer) {
      clearTimeout(room.pendingSaveTimer)
      room.pendingSaveTimer = null
    }

    if (room.isSaving) {
      room.saveQueued = true
      return
    }

    room.isSaving = true

    try {
      const pressRelease = await pressReleaseService.updatePressRelease(
        pressReleaseId,
        {
          title: room.snapshot.title,
          content: room.snapshot.content,
          version: room.snapshot.version,
        },
        { notifySaved: false }
      )

      room.snapshot = {
        title: pressRelease.title,
        content: pressRelease.content,
        version: pressRelease.version,
      }

      this.broadcast(pressReleaseId, {
        type: 'document.saved',
        title: pressRelease.title,
        content: pressRelease.content,
        version: pressRelease.version,
      })
    } catch (error) {
      console.error('Failed to flush collaboration room:', error)

      const latest = await pressReleaseService.getPressRelease(pressReleaseId)
      room.snapshot = {
        title: latest.title,
        content: latest.content,
        version: latest.version,
      }
      room.revision = 0
      room.steps = []

      this.broadcast(pressReleaseId, {
        type: 'document.resync',
        snapshot: room.snapshot,
        revision: room.revision,
      })
    } finally {
      room.isSaving = false
      if (room.saveQueued) {
        room.saveQueued = false
        void this.flushRoom(pressReleaseId)
      }
    }
  }

  private handleDocumentSteps(
    client: ClientIdentity,
    room: RoomState,
    message: Extract<ClientRealtimeMessage, { type: 'document.steps' }>
  ): void {
    if (message.version > room.revision) {
      this.send(client.socket, {
        type: 'document.resync',
        snapshot: room.snapshot,
        revision: room.revision,
      })
      return
    }

    if (message.version < room.revision) {
      const missing = room.steps.slice(message.version)
      this.send(client.socket, {
        type: 'document.steps',
        sourceClientId: 'server',
        steps: missing.map((entry) => entry.step),
        clientIds: missing.map((entry) => entry.clientId),
        revision: room.revision,
      })
      return
    }

    if (message.steps.length === 0) {
      return
    }

    const nextSteps = message.steps.map((step) => ({
      step,
      clientId: client.clientId,
    }))

    room.steps.push(...nextSteps)
    room.revision += nextSteps.length
    room.snapshot = {
      ...room.snapshot,
      content: message.content,
    }

    this.broadcast(client.pressReleaseId, {
      type: 'document.steps',
      sourceClientId: client.clientId,
      steps: nextSteps.map((entry) => entry.step),
      clientIds: nextSteps.map((entry) => entry.clientId),
      revision: room.revision,
    })
    this.scheduleSave(client.pressReleaseId)
  }

  private async getOrCreateRoom(pressReleaseId: number): Promise<RoomState> {
    const existing = this.rooms.get(pressReleaseId)
    if (existing) {
      return existing
    }

    const pressRelease = await pressReleaseService.getPressRelease(pressReleaseId)
    const room: RoomState = {
      snapshot: {
        title: pressRelease.title,
        content: pressRelease.content,
        version: pressRelease.version,
      },
      revision: 0,
      steps: [],
      clients: new Map(),
      pendingSaveTimer: null,
      isSaving: false,
      saveQueued: false,
    }

    this.rooms.set(pressReleaseId, room)
    return room
  }

  private findClient(clientId: string): ClientIdentity | null {
    for (const room of this.rooms.values()) {
      const client = room.clients.get(clientId)
      if (client) {
        return client
      }
    }

    return null
  }

  private listPresence(pressReleaseId: number): PresencePayload[] {
    return presenceStore.listByPressRelease(pressReleaseId).map((presence) => ({
      userId: presence.userId,
      name: presence.name,
      color: presence.color,
      selection: presence.selection,
    }))
  }

  private broadcastPresenceSnapshot(pressReleaseId: number): void {
    this.broadcast(pressReleaseId, {
      type: 'presence.snapshot',
      users: this.listPresence(pressReleaseId),
    })
  }

  private scheduleSave(pressReleaseId: number): void {
    const room = this.rooms.get(pressReleaseId)
    if (!room) {
      return
    }

    if (room.pendingSaveTimer) {
      clearTimeout(room.pendingSaveTimer)
    }

    room.pendingSaveTimer = setTimeout(() => {
      room.pendingSaveTimer = null
      void this.flushRoom(pressReleaseId)
    }, 1200)
  }

  private broadcast(pressReleaseId: number, message: ServerRealtimeMessage, excludeClientId?: string): void {
    const room = this.rooms.get(pressReleaseId)
    if (!room) {
      return
    }

    const payload = JSON.stringify(message)
    for (const client of room.clients.values()) {
      if (client.clientId === excludeClientId) {
        continue
      }

      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(payload)
      }
    }
  }

  private send(socket: WebSocket, message: ServerRealtimeMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(JSON.stringify(message))
  }
}

export const collaborationHub = new CollaborationHub()
