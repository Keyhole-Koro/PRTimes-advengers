# PRTimes Editor 保存フローとコメントフロー

このドキュメントは、DB へどう保存されるかという観点で、通常編集とコメント操作の流れをまとめたものです。

## 1. 通常保存フロー

通常保存では、楽観ロックとして `version` を使って競合を防ぎます。

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

### 保存時のポイント

- `press_releases` には常に最新状態だけを保持する
- 更新成功時に `press_release_revisions` へ履歴を追加する
- `version` が一致しない場合は 409 を返して上書き事故を防ぐ

## 2. コメント保存フロー

コメントは、スレッド作成とメッセージ追加を分けて扱います。

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

### コメント時のポイント

- コメント作成時は、まず `comment_threads` を作る
- 初回コメント本文は `comment_messages` に入る
- 返信は `comment_messages` の追加だけで表現する
- 解決は削除ではなく `is_resolved=true` の更新で扱う

## 3. 関連ドキュメント

- テーブル構造は [DB スキーマ概要](./db-schema.md)
- AI agent 側の処理は [AI Agent アーキテクチャ概要](./agent-overview.md)
