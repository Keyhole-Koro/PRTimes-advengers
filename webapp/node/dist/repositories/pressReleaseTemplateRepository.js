import { getPool } from '../db/pool.js';
export class PressReleaseTemplateRepository {
    async findAll() {
        const pool = getPool();
        const result = await pool.query(`
        SELECT id, name, title, content, created_at, updated_at
        FROM press_release_templates
        ORDER BY updated_at DESC, id DESC
      `);
        return result.rows.map(mapRow);
    }
    async findById(id) {
        const pool = getPool();
        const result = await pool.query(`
        SELECT id, name, title, content, created_at, updated_at
        FROM press_release_templates
        WHERE id = $1
      `, [id]);
        if (result.rows.length === 0) {
            return null;
        }
        return mapRow(result.rows[0]);
    }
    async create(input) {
        const pool = getPool();
        const result = await pool.query(`
        INSERT INTO press_release_templates (name, title, content, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, name, title, content, created_at, updated_at
      `, [input.name, input.title, JSON.stringify(input.content)]);
        return mapRow(result.rows[0]);
    }
}
function mapRow(row) {
    return {
        id: row.id,
        name: row.name,
        title: row.title,
        content: row.content,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
export const pressReleaseTemplateRepository = new PressReleaseTemplateRepository();
