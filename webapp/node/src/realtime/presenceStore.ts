export type PresenceSelection = {
  from: number
  to: number
}

export type PresenceState = {
  pressReleaseId: number
  userId: string
  name: string
  color: string
  selection: PresenceSelection
  updatedAt: number
}

export class PresenceStore {
  private readonly state = new Map<string, PresenceState>()

  upsert(presence: Omit<PresenceState, 'updatedAt'>): PresenceState {
    const nextState: PresenceState = {
      ...presence,
      updatedAt: Date.now(),
    }

    this.state.set(this.key(presence.pressReleaseId, presence.userId), nextState)
    return nextState
  }

  remove(pressReleaseId: number, userId: string): void {
    this.state.delete(this.key(pressReleaseId, userId))
  }

  listByPressRelease(pressReleaseId: number): PresenceState[] {
    return [...this.state.values()].filter((presence) => presence.pressReleaseId === pressReleaseId)
  }

  private key(pressReleaseId: number, userId: string): string {
    return `${pressReleaseId}:${userId}`
  }
}

export const presenceStore = new PresenceStore()
