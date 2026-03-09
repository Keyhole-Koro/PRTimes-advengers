# Next.js実装（フロントエンド）

このディレクトリは Next.js（App Router）によるフロントエンド実装です。

バックエンドAPIの起動方法や全体構成は [webapp/README.md](../README.md) を参照してください。

## 前提条件

- Node.js 20 以上
- npm
- PostgreSQL 16（`webapp/docker-compose.yml` で起動）

## セットアップ

```bash
npm install
```

## データベース起動

`webapp` ディレクトリで以下を実行:

```bash
docker compose up -d db
```

初期化SQLは `webapp/sql/schema.sql` です。

## 起動

```bash
npm run dev
```

起動後、`http://localhost:3000` を開いてください。

## npmコマンド一覧

- `npm run dev`: 開発サーバーを起動
- `npm run build`: 本番用ビルドを作成
- `npm run start`: ビルド済みアプリを起動
- `npm run lint`: ESLintを実行

## 連携API

- `GET /press-releases/:id`
- `POST /press-releases/:id`

API仕様は [webapp/README.md](../README.md) を参照してください。
