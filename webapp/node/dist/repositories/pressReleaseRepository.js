import { getPool } from '../db/pool.js';
export class PressReleaseRepository {
    async findById(id) {
        const pool = getPool();
        const result = await pool.query('SELECT id, title, content, version, created_at, updated_at FROM press_releases WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return null;
        }
        return mapRow(result.rows[0]);
    }
    async update(id, input) {
        const pool = getPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const current = await this.findByIdForUpdate(client, id);
            if (!current) {
                await client.query('ROLLBACK');
                return { status: 'not_found' };
            }
            if (input.version !== undefined && current.version !== input.version) {
                await client.query('ROLLBACK');
                return { status: 'version_conflict', pressRelease: current };
            }
            const result = await client.query(`
          UPDATE press_releases
          SET title = $1,
              content = $2::jsonb,
              version = version + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING id, title, content, version, created_at, updated_at
        `, [input.title, JSON.stringify(input.content), id]);
            const updated = mapRow(result.rows[0]);
            await client.query(`
          INSERT INTO press_release_revisions (press_release_id, version, title, content, created_at)
          VALUES ($1, $2, $3, $4::jsonb, $5)
          ON CONFLICT (press_release_id, version) DO NOTHING
        `, [updated.id, updated.version, updated.title, JSON.stringify(updated.content), updated.updatedAt]);
            await client.query('COMMIT');
            return { status: 'updated', pressRelease: updated };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async findByIdForUpdate(client, id) {
        const result = await client.query(`
        SELECT id, title, content, version, created_at, updated_at
        FROM press_releases
        WHERE id = $1
        FOR UPDATE
      `, [id]);
        if (result.rows.length === 0) {
            return null;
        }
        return mapRow(result.rows[0]);
    }
}
function mapRow(row) {
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        version: row.version,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
export const pressReleaseRepository = new PressReleaseRepository();
