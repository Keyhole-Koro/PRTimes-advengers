# プレスリリースエディター - バックエンド / Agent

プレスリリースエディターのバックエンド API と AI エージェント実装です。

## 設計ドキュメント

- [DBスキーマと保存フロー](./docs/db-schema-and-flow.md)

## 構成

- **データベース**: PostgreSQL 16
- **バックエンド API**: Node.js + TypeScript + Hono
- **AI エージェント**: Python + Flask + google-adk

## クイックスタート

### 1. Docker環境の起動

```bash
cd webapp
docker compose up -d
```

`docker-compose.yml` は現在、以下の 3 サービスを起動します。

- `postgresql`: PostgreSQL 16
- `app`: Node.js API サーバー（ポート `8080`）
- `agent`: Python/Flask 製 AI エージェント（ポート `5001` -> コンテナ内 `5000`）

### 2. 動作確認

```bash
# ヘルスチェック
curl http://localhost:8080/health
curl http://localhost:5001/health

# プレスリリースの取得
curl http://localhost:8080/press-releases/1

# プレスリリースの保存
curl -X POST http://localhost:8080/press-releases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "新しいタイトル",
    "content": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "テキスト内容" }
          ]
        }
      ]
    },
    "version": 1
  }'
```

### 3. 停止

```bash
docker compose down
```

## AI Agent E2E

AI エージェントの E2E は、Node バックエンド、Agent、PostgreSQL、Vite フロントエンドがそろって起動している前提です。現在の E2E は AI 提案が対象段落だけに適用されることを確認します。

### ローカルで実行する手順

1. バックエンド群を起動します。

```bash
cd webapp
docker compose up -d --build postgresql agent app
```

2. ヘルスチェックが返ることを確認します。

```bash
curl http://127.0.0.1:5001/health
curl http://127.0.0.1:8080/health
```

3. フロントエンド依存関係と Playwright ブラウザを入れます。

```bash
cd webapp/frontend/react
npm ci
npx playwright install --with-deps chromium
```

4. フロントエンドを起動します。

```bash
cd webapp/frontend/react
npm run dev -- --host 0.0.0.0
```

5. 別ターミナルで E2E を実行します。

```bash
cd webapp/frontend/react
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e:ai-agent
```

AI エージェント関連の Node 側テストだけを確認したい場合は、以下を使います。

```bash
cd webapp/node
npm test -- aiEditService.test.ts
```

### CI での実行

GitHub Actions では [ai-agent-e2e.yml](../.github/workflows/ai-agent-e2e.yml) が同じ流れで以下を行います。

- `docker compose up -d --build postgresql agent app`
- `http://127.0.0.1:5001/health` と `http://127.0.0.1:8080/health` の待機
- Vite 開発サーバーの起動
- `npm run test:e2e`

失敗時は `webapp/frontend/react/playwright-report` と `webapp/frontend/react/test-results` が artifact として保存されます。

## API仕様

### GET /health

Node バックエンドとデータベース接続のヘルスチェックを行います。

**正常時レスポンス例:**
```json
{
  "status": "ok"
}
```

**異常時レスポンス例:**
```json
{
  "status": "error"
}
```

### GET /press-releases/:id

プレスリリースを取得します。

**レスポンス例:**
```json
{
  "id": 1,
  "title": "サンプルプレスリリース",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "heading",
        "attrs": { "level": 1 },
        "content": [{ "type": "text", "text": "Sample Press Release" }]
      }
    ]
  },
  "version": 1,
  "created_at": "2026-02-13T06:14:04.732533",
  "updated_at": "2026-02-13T06:14:04.732533"
}
```

### POST /press-releases/:id

既存のプレスリリースを更新します（指定IDが存在しない場合は404）。

**リクエストボディ:**
```json
{
  "title": "タイトル",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "本文" }]
      }
    ]
  },
  "version": 1
}
```

`content` フィールドは TipTap 形式の JSON オブジェクトです。共同編集に備えて `version` を返し、更新時はその値を送ります。

**レスポンス（更新されたPressReleaseオブジェクト）:**
```json
{
  "id": 1,
  "title": "新しいタイトル",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "本文" }]
      }
    ]
  },
  "version": 2,
  "created_at": "2026-02-13T06:14:04.732533",
  "updated_at": "2026-02-16T15:30:00.123456"
}
```

## そのほかの主要 API

- `GET /press-releases`: プレスリリース一覧を取得
- `POST /press-releases`: 新規プレスリリースを作成
- `GET /press-releases/:id/revisions`: リビジョン履歴を取得
- `POST /press-releases/:id/revisions/:revisionId/restore`: 指定リビジョンを復元
- `GET /press-releases/:id/comments`: コメント一覧を取得
- `POST /press-releases/:id/comments`: コメントスレッドを作成
- `POST /comments/:threadId/replies`: コメント返信を追加
- `PATCH /comments/:threadId/resolve`: コメントスレッドを解決
- `PATCH /comments/:threadId/unresolve`: コメントスレッドの解決を解除
- `GET /press-release-templates`: テンプレート一覧を取得
- `GET /press-release-templates/:id`: テンプレート詳細を取得
- `POST /press-release-templates`: テンプレートを作成
- `POST /press-releases/:id/ai-edit`: AI 文章編集を実行
- `POST /press-releases/:id/ai-tags`: AI タグ提案を実行
- `POST /press-releases/:id/ai-settings-suggestions`: AI 設定提案を実行

## データベース

### 初期データ

起動時に ID=1 の初期プレスリリースが自動的に作成されます（内容は `sql/schema.sql` を参照）。

### テーブル構成

詳細は `sql/schema.sql` を参照してください。

**press_releases テーブル:**
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL | プライマリキー |
| title | VARCHAR(255) | タイトル |
| content | JSONB | TipTap形式のJSONオブジェクト |
| version | INTEGER | 楽観ロック用バージョン |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |
