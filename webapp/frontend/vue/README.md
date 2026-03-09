# Vue実装（フロントエンド）

このディレクトリは Vue 3 + Vite + TypeScript によるフロントエンド実装です。

バックエンドAPIの起動方法や全体構成は [webapp/README.md](../../README.md) を参照してください。

## 前提条件

- Node.js 20 以上
- npm

## セットアップ

```bash
npm install
```

## 起動

```bash
npm run dev
```

起動後、ブラウザで表示されたURL（通常 `http://localhost:5173`）にアクセスしてください。

## npmコマンド一覧

- `npm run dev`: 開発サーバーを起動
- `npm run build`: 型チェック付きで本番ビルドを作成
- `npm run preview`: ビルド結果をローカル確認
- `npm run lint`: `oxlint` と `eslint` を実行
- `npm run format`: `src/` 配下を整形
- `npm run type-check`: TypeScript型チェックのみ実行
