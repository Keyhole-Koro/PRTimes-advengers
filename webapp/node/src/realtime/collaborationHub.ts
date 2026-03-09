import WebSocket from 'ws'
import { presenceStore } from './presenceStore.js'
import type {
  ClientRealtimeMessage,
  PresencePayload,
  ServerRealtimeMessage,
} from './messages.js'
import { pressReleaseService } from '../services/pressReleaseService.js'
import type { PressReleaseContent, PressReleaseResponse } from '../types/pressRelease.js'

type ClientIdentity = {
  clientId: string
  pressReleaseId: number
  userId: string
  name: string
  color: string
  socket: WebSocket
}

type RoomState = {
  snapshot: Pick<PressReleaseResponse, 'title' | 'content' | 'version'>
  clients: Map<string, ClientIdentity>
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

    if (message.type === 'document.update') {
      room.snapshot = {
        title: message.title,
        content: message.content,
        version: message.version,
      }

      this.broadcast(client.pressReleaseId, {
        type: 'document.sync',
        sourceClientId: client.clientId,
        title: message.title,
        content: message.content,
        version: message.version,
      }, client.clientId)
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

    this.broadcast(pressRelease.id, {
      type: 'document.saved',
      title: pressRelease.title,
      content: pressRelease.content,
      version: pressRelease.version,
    })
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
      clients: new Map(),
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
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }
}

export const collaborationHub = new CollaborationHub()
