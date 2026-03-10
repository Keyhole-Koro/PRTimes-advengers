# PRTimes Editor ドキュメント一覧

このディレクトリのドキュメントを、DB と AI agent の責務ごとに分割しました。
入口としてこのファイルを残し、詳細は以下の各ファイルにまとめています。

## DB 関連

- [DB スキーマ概要](./db-schema.md)
- [保存フローとコメントフロー](./db-write-flows.md)

## AI Agent 関連

- [AI Agent アーキテクチャ概要](./agent-overview.md)
- [AI Agent の task 別フロー](./agent-task-flows.md)

## 使い分け

- DB のテーブル設計や関係だけ見たいときは `db-schema.md`
- 保存、履歴、コメントの動きを追いたいときは `db-write-flows.md`
- agent の API、レイヤ構成、validation、ADK 実行を見たいときは `agent-overview.md`
- `document_edit` と `checklist_generate` の入出力や後処理まで見たいときは `agent-task-flows.md`
