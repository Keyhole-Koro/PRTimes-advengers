# Team Avengers

Hackathon 2026 Spring 向けに開発された、プレスリリース作成支援アプリです。

このプロダクトは、PR TIMES が開催した「PR TIMES HACKATHON 2026 Spring」で制作したものです。

- チーム賞を受賞
- [@Keyhole-Koro](https://github.com/Keyhole-Koro) が個人賞を受賞

ハッカソン概要:

- [年収550万円以上で即内定！技術×ビジネス思考を磨く27・28卒向けハッカソン受付開始 | 株式会社PR TIMES](https://prtimes.jp/main/html/rd/p/000001614.000000112.html)

## 主な機能

- プレスリリースの作成・保存・一覧表示
- リビジョン履歴の取得と復元
- コメントスレッドの作成、返信、解決
- AI による文章編集、タグ提案、設定提案
- WebSocket を使った共同編集向けのリアルタイム連携

## 技術スタック

| レイヤー | 実装 |
| --- | --- |
| フロントエンド | React 19 + Vite + TypeScript |
| バックエンドAPI | Node.js + TypeScript + Hono |
| AI エージェント | Python + Flask |
| データベース | PostgreSQL 16 |

## クイックスタート

### 1. バックエンド群を起動

```bash
cd webapp
docker compose up -d --build
```

起動後、以下で疎通確認できます。

```bash
curl http://localhost:8080/health
curl http://localhost:5001/health
```

### 2. フロントエンドを起動

```bash
cd webapp/frontend/react
npm install
npm run dev
```

通常は `http://localhost:5173` で確認できます。

## ディレクトリ構成

```text
.
├── README.md
├── webapp/
│   ├── README.md
│   ├── docker-compose.yml
│   ├── agent/           # Flask 製 AI エージェント
│   ├── node/            # Hono 製 API サーバー
│   ├── frontend/react/  # React + Vite フロントエンド
│   ├── sql/             # DB 初期化 SQL
│   └── docs/            # 補足ドキュメント
└── .github/
```

## ドキュメント

- [webapp/README.md](./webapp/README.md): バックエンドと AI エージェントの起動方法、API 概要
- [webapp/docs/db-schema-and-flow.md](./webapp/docs/db-schema-and-flow.md): DB スキーマと保存フロー
- [webapp/docs/agent-overview.md](./webapp/docs/agent-overview.md): AI エージェント構成
