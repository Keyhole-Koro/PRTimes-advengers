import { getPool } from './pool.js';
let schemaInitialization = null;
export function ensureDatabaseSchema() {
    if (!schemaInitialization) {
        schemaInitialization = setupDatabaseSchema().catch((error) => {
            schemaInitialization = null;
            throw error;
        });
    }
    return schemaInitialization;
}
async function setupDatabaseSchema() {
    const pool = getPool();
    await pool.query(`
    CREATE TABLE IF NOT EXISTS press_releases (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
    await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'press_releases'
          AND column_name = 'content'
          AND data_type = 'text'
      ) THEN
        ALTER TABLE press_releases
          ALTER COLUMN content TYPE JSONB
          USING content::jsonb;
      END IF;
    END $$;
  `);
    await pool.query(`
    ALTER TABLE press_releases
      ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
  `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS press_release_revisions (
      id SERIAL PRIMARY KEY,
      press_release_id INTEGER NOT NULL REFERENCES press_releases(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      content JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (press_release_id, version)
    );
  `);
    await pool.query(`
    INSERT INTO press_releases (id, title, content, version, created_at, updated_at)
    VALUES (
      1,
      '年収550万円以上で即内定！技術×ビジネス思考を磨く27・28卒向けハッカソン受付開始',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"プレスリリース配信サービス「PR TIMES」等を運営する株式会社PR TIMES（東京都港区、代表取締役：山口拓己、東証プライム、名証プレミア：3922）は、2026年3月9日（月）、10日（火）、11日（水）の3日間、2027・28年卒業予定のエンジニア志望学生(*1)を対象とした「PR TIMES HACKATHON 2026 Spring」をPR TIMES本社（赤坂インターシティ）で開催します。"}]},{"type":"paragraph","content":[{"type":"text","text":"一次募集締切は2026年2月1日（日） 23:59まで、下記フォームより本日からエントリー受付を開始いたします。"}]}]}'::jsonb,
      1,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO NOTHING;
  `);
    await pool.query(`
    INSERT INTO press_release_revisions (press_release_id, version, title, content, created_at)
    SELECT id, version, title, content, updated_at
    FROM press_releases
    ON CONFLICT (press_release_id, version) DO NOTHING;
  `);
}
