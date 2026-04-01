# プレスリリースエディター バックエンド

このディレクトリには、API サーバー、AI エージェント、DB、フロントエンド関連コードが含まれています。

現状の Docker 構成で起動するバックエンド実装は以下です。

- API サーバー: Node.js + Hono
- AI エージェント: Python + Flask
- データベース: PostgreSQL 16

## 起動

```bash
cd webapp
docker compose up -d --build
```

起動後のエンドポイント:

- API: `http://localhost:8080`
- Agent: `http://localhost:5001`
- PostgreSQL: `localhost:5432`

停止:

```bash
docker compose down
```

## 動作確認

```bash
curl http://localhost:8080/health
curl http://localhost:8080/press-releases
curl http://localhost:5001/health
```

## フロントエンド

React フロントエンドは別プロセスで起動します。

```bash
cd webapp/frontend/react
npm install
npm run dev
```

通常は `http://localhost:5173` で確認できます。

## 主要 API

- `GET /health`
- `GET /press-releases`
- `POST /press-releases`
- `GET /press-releases/:id`
- `POST /press-releases/:id`
- `GET /press-releases/:id/revisions`
- `POST /press-releases/:id/revisions/:revisionId/restore`
- `POST /press-releases/:id/ai-edit`
- `POST /press-releases/:id/ai-tags`
- `POST /press-releases/:id/ai-settings-suggestions`
- `GET /press-releases/:id/comments`
- `POST /press-releases/:id/comments`
- `POST /comments/:threadId/replies`
- `PATCH /comments/:threadId/resolve`
- `PATCH /comments/:threadId/unresolve`
- `GET /link-previews?url=...`
- `GET /press-release-templates`
- `GET /press-release-templates/:id`
- `POST /press-release-templates`

## AI Agent E2E

AI エージェントの E2E は、API、Agent、PostgreSQL、React フロントエンドが起動している前提です。

```bash
cd webapp
docker compose up -d --build
```

```bash
cd webapp/frontend/react
npm ci
npx playwright install --with-deps chromium
npm run dev -- --host 0.0.0.0
```

別ターミナルで実行:

```bash
cd webapp/frontend/react
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e:ai-agent
```

Node 側テスト:

```bash
cd webapp/node
npm test -- aiEditService.test.ts
```

## ドキュメント

- [docs/db-schema-and-flow.md](./docs/db-schema-and-flow.md)
- [docs/db-schema.md](./docs/db-schema.md)
- [docs/agent-overview.md](./docs/agent-overview.md)
- [docs/agent-task-flows.md](./docs/agent-task-flows.md)
