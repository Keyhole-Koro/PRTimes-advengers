# PRTimes Editor DBスキーマ解説

このドキュメントは、現在のDB設計（PostgreSQL）をMermaid図で可視化しつつ、
テーブル間の関係と保存フローをまとめたものです。

## 1. 全体ER図

```mermaid
erDiagram
  press_releases ||--o{ press_release_revisions : has
  press_releases ||--o{ comment_threads : has
  comment_threads ||--o{ comment_messages : has

  press_releases {
    int id PK
    varchar title
    jsonb content
    int version
    timestamp created_at
    timestamp updated_at
  }

  press_release_revisions {
    int id PK
    int press_release_id FK
    int version
    varchar title
    jsonb content
    timestamp created_at
  }

  press_release_templates {
    int id PK
    varchar name
    varchar title
    jsonb content
    timestamp created_at
    timestamp updated_at
  }

  comment_threads {
    int id PK
    int press_release_id FK
    int anchor_from
    int anchor_to
    text quote
    bool is_resolved
    varchar created_by
    timestamp created_at
    timestamp resolved_at
  }

  comment_messages {
    int id PK
    int thread_id FK
    text body
    varchar created_by
    timestamp created_at
  }
```

## 2. press_releases と press_release_revisions の関係

`press_releases` は「最新状態」を持つテーブル、`press_release_revisions` は「履歴スナップショット」を持つテーブルです。

- `press_releases` は1レコード1記事の現在値
- 保存（更新）ごとに `version` が進む
- 保存時にその時点の内容が `press_release_revisions` に追記される
- `press_release_revisions.press_release_id` で親記事を参照

### 図: 最新状態と履歴の住み分け

```mermaid
flowchart LR
  A[press_releases\n最新の title/content/version] -->|保存時にスナップショット追加| B[press_release_revisions\n過去バージョン一覧]
  B -->|復元対象を選択| C[restore API]
  C -->|最新テーブルを書き戻し| A
```

## 3. コメント系テーブルの関係

コメント機能は「スレッド」と「メッセージ」の2層です。

- `comment_threads`: 本文のどこに対するコメントか（アンカー）を保持
- `comment_messages`: スレッド内の会話（初回コメント + 返信）

### 図: コメント構造

```mermaid
flowchart TD
  PR[press_releases.id]
  TH[comment_threads\nanchor_from/anchor_to\nquote\nis_resolved]
  MSG[comment_messages\nbody\ncreated_by]

  PR -->|1:N| TH
  TH -->|1:N| MSG
```

## 4. 保存フロー（通常編集）

通常保存では、楽観ロック（version）を使って競合を防ぎます。

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as Node API
  participant DB as PostgreSQL

  FE->>API: POST /press-releases/:id\n(title, content, version)
  API->>DB: version一致でUPDATE
  alt 一致
    DB-->>API: 更新成功 + 新version
    API->>DB: revisionsへ履歴INSERT
    API-->>FE: 200 OK (最新データ)
  else 不一致
    DB-->>API: version conflict
    API-->>FE: 409 VERSION_CONFLICT
  end
```

## 5. コメント保存フロー

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as Node API
  participant DB as PostgreSQL

  FE->>API: POST /press-releases/:id/comments\n(anchorFrom, anchorTo, quote, body)
  API->>DB: comment_threads INSERT
  API->>DB: comment_messages INSERT (初回コメント)
  API-->>FE: 201 Created (thread + messages)

  FE->>API: POST /comments/:threadId/replies
  API->>DB: comment_messages INSERT
  API-->>FE: 201 Created (message)

  FE->>API: PATCH /comments/:threadId/resolve
  API->>DB: comment_threads UPDATE is_resolved=true
  API-->>FE: 200 OK
```

## 6. 設計上のポイント

- `press_releases` と `press_release_revisions` を分離しているため、一覧取得は軽く、履歴も失わない
- `version` による競合検知で同時編集時の上書き事故を抑制
- コメントのアンカー情報（`anchor_from`, `anchor_to`）で本文上の位置と紐づけ可能
- コメント解決は物理削除ではなく `is_resolved` で論理的に非表示制御
- `resolved_at` を持つので、解決タイミングの監査にも対応しやすい

## 7. 補足: テンプレートテーブル

`press_release_templates` は記事本体とは独立した再利用コンテンツです。

- 記事本体のversion管理には関与しない
- 任意タイミングでエディタに適用するための雛形データを保持
