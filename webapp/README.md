# プレスリリースエディター - バックエンドAPI

プレスリリースエディターのバックエンドAPI実装です。

## 構成

- **データベース**: PostgreSQL 16
- **バックエンド**: 複数言語による参考実装（デフォルトはPHP）
  - ✅ PHP 8.5
  - ✅ Python 3.14
  - ✅ Go 1.25
  - ✅ Node.js（Hono）

## クイックスタート

### 1. Docker環境の起動

```bash
cd webapp
docker compose up -d
```

デフォルトでは PHP 実装（`build: ./php`）が起動します。他の言語実装を使用する場合は後述の「他の言語実装を使う場合」を参照してください。

### 2. 動作確認

```bash
# プレスリリースの取得
curl http://localhost:8080/press-releases/1

# プレスリリースの保存
curl -X POST http://localhost:8080/press-releases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "新しいタイトル",
    "content": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"テキスト内容\"}]}]}"
  }'
```

### 3. 停止

```bash
docker compose down
```

### 他の言語実装を使う場合

`docker-compose.yml` の `app` サービスの `build` を切り替えて再ビルドしてください。

```yaml
# PHP実装を使う場合
app:
  build: ./php

# Python実装を使う場合
app:
  build: ./python

# Go実装を使う場合
app:
  build: ./go

# Node.js実装を使う場合
app:
  build: ./node
```

切り替え後に以下を実行します。

```bash
cd webapp
docker compose down
docker compose build app
docker compose up -d
```

## API仕様

### GET /press-releases/:id

プレスリリースを取得します。

**レスポンス例:**
```json
{
  "id": 1,
  "title": "サンプルプレスリリース",
  "content": "{\"type\":\"doc\",\"content\":[{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"Sample Press Release\"}]},{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"This is a sample press release content.\"}]}]}",
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
  "content": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"本文\"}]}]}"
}
```

**注意**: `content`フィールドはTipTap形式のJSON**文字列**です。JSONオブジェクトではなく、文字列としてエスケープして送信してください。

**レスポンス（更新されたPressReleaseオブジェクト）:**
```json
{
  "id": 1,
  "title": "新しいタイトル",
  "content": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"本文\"}]}]}",
  "created_at": "2026-02-13T06:14:04.732533",
  "updated_at": "2026-02-16T15:30:00.123456"
}
```

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
| content | TEXT | TipTap形式のJSON文字列 |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |
