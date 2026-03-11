# hackathon2026-spring-press-release-editor

Hackathon 2026 Spring 向けに開発された、**プレスリリース作成を支援するエディターアプリケーション**です。

AIエージェントがバックグラウンドで動作し、機能の提案・文章の改善を自動実行します。ITリテラシーを問わず、誰でも質の高いPR記事を執筆できる高ユーザビリティなエディターを目指して設計されました。

---

## 特徴

### エージェント機能による自動サポート
AIがバックグラウンドで動作し、エディターの機能提案や文章の補完・改善を自動実行します。ユーザーが操作に迷うことなく、常に最適なアシストを受けられます。

### 誰でも使える高ユーザビリティなUX
60代のベテランから若手担当者まで、あらゆるユーザーを想定したインターフェース設計です。機能が隠れず、直感的に操作できるUXを実装しています。

### 質の高いPR記事をワンストップで
文章の構成提案から表現の改善まで、PR記事執筆に必要なサポートを一つのエディター内で完結します。

---

## 技術スタック

| レイヤー | 選択肢 |
|---|---|
| **データベース** | PostgreSQL 16 |
| **バックエンド** | PHP 8.5（Slim Framework 4）/ Python 3.14（FastAPI）/ Go 1.25（Chi + pgx）/ Node.js（Hono） |
| **フロントエンド** | React + Vite / Vue + Vite / Next.js |

バックエンドはデフォルトで **PHP** が起動します。切り替え手順は [`webapp/README.md`](./webapp/README.md) を参照してください。

---

## インフラ構成

<img width="2816" height="1536" alt="インフラ構成図" src="https://github.com/user-attachments/assets/23802a1f-f06f-4d75-ae19-ae68cf95d201" />

---

## クイックスタート

### 1. バックエンド（Docker）を起動

```bash
cd webapp
docker compose up -d
```

### 2. フロントエンドを起動

使用するフレームワークに合わせていずれか1つを選んで実行してください。

**React 版**

```bash
cd webapp/frontend/react
npm install
npm run dev
```

**Vue 版**

```bash
cd webapp/frontend/vue
npm install
npm run dev
```

**Next.js 版**

```bash
cd webapp/nextjs
npm install
npm run dev
```

---

## プロジェクト構成

```
.
├── webapp/
│   ├── docker-compose.yml
│   ├── README.md               # バックエンドAPI仕様・切り替え手順
│   ├── docs/
│   │   └── db-schema-and-flow.md
│   └── frontend/
│       ├── react/
│       └── vue/
└── nextjs/
```

---

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [webapp/README.md](./webapp/README.md) | バックエンドAPI仕様・実装切り替え手順 |
| [DBスキーマと保存フロー](./webapp/docs/db-schema-and-flow.md) | テーブル定義・データの流れ |
