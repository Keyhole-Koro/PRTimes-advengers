import { ensureDatabaseSchema } from '../db/schemaSetup.js';
import { pressReleaseRepository } from '../repositories/pressReleaseRepository.js';
import { formatTimestamp } from '../utils/formatTimestamp.js';
export class PressReleaseNotFoundError extends Error {
}
export class PressReleaseRevisionNotFoundError extends Error {
}
export class PressReleaseVersionConflictError extends Error {
    currentVersion;
    constructor(currentVersion) {
        super('Press release version conflict');
        this.currentVersion = currentVersion;
    }
}
export class PressReleaseService {
    async getPressRelease(id) {
        await ensureDatabaseSchema();
        const pressRelease = await pressReleaseRepository.findById(id);
        if (!pressRelease) {
            throw new PressReleaseNotFoundError();
        }
        return toResponse(pressRelease);
    }
    async updatePressRelease(id, input) {
        await ensureDatabaseSchema();
        const result = await pressReleaseRepository.update(id, input);
        if (result.status === 'not_found') {
            throw new PressReleaseNotFoundError();
        }
        if (result.status === 'version_conflict') {
            throw new PressReleaseVersionConflictError(result.pressRelease.version);
        }
        return toResponse(result.pressRelease);
    }
    async getPressReleaseRevisions(id) {
        await ensureDatabaseSchema();
        const pressRelease = await pressReleaseRepository.findById(id);
        if (!pressRelease) {
            throw new PressReleaseNotFoundError();
        }
        const revisions = await pressReleaseRepository.findRevisionsByPressReleaseId(id);
        return revisions.map(toRevisionResponse);
    }
    async restorePressReleaseRevision(id, revisionId) {
        await ensureDatabaseSchema();
        const pressRelease = await pressReleaseRepository.findById(id);
        if (!pressRelease) {
            throw new PressReleaseNotFoundError();
        }
        const revision = await pressReleaseRepository.findRevisionById(id, revisionId);
        if (!revision) {
            throw new PressReleaseRevisionNotFoundError();
        }
        return this.updatePressRelease(id, {
            title: revision.title,
            content: revision.content,
            version: pressRelease.version,
        });
    }
}
function toResponse(pressRelease) {
    return {
        id: pressRelease.id,
        title: pressRelease.title,
        content: pressRelease.content,
        version: pressRelease.version,
        created_at: formatTimestamp(pressRelease.createdAt),
        updated_at: formatTimestamp(pressRelease.updatedAt),
    };
}
export const pressReleaseService = new PressReleaseService();
function toRevisionResponse(revision) {
    return {
        id: revision.id,
        press_release_id: revision.pressReleaseId,
        version: revision.version,
        title: revision.title,
        content: revision.content,
        created_at: formatTimestamp(revision.createdAt),
    };
}
