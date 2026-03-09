export class PresenceStore {
    state = new Map();
    upsert(presence) {
        const nextState = {
            ...presence,
            updatedAt: Date.now(),
        };
        this.state.set(this.key(presence.pressReleaseId, presence.userId), nextState);
        return nextState;
    }
    remove(pressReleaseId, userId) {
        this.state.delete(this.key(pressReleaseId, userId));
    }
    listByPressRelease(pressReleaseId) {
        return [...this.state.values()].filter((presence) => presence.pressReleaseId === pressReleaseId);
    }
    key(pressReleaseId, userId) {
        return `${pressReleaseId}:${userId}`;
    }
}
export const presenceStore = new PresenceStore();
