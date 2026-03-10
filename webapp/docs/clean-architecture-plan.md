# Clean Architecture Refactor Plan

## 目的

- 肥大化した画面・service・route から責務を分離する
- UI、ユースケース、外部I/O の境界を明確にする
- 機能追加時に「どこへ書くか」で迷いにくくする

## 現状の課題

### Frontend

- `frontend/react/src/features/pressReleaseEditor/PressReleaseEditorPage.tsx`
  - 画面描画
  - localStorage 永続化
  - WebSocket 連携
  - TipTap 初期化
  - AI提案適用
  - 保存状態管理
  - sidebar 幅管理
  - これらが 1 ファイルに集まっている
- `frontend/react/src/features/pressReleaseEditor/hooks/useAiAssistant.ts`
  - AIチャット UI state
  - localStorage
  - 自動レコメンド発火
  - API 呼び出し
  - レスポンス正規化
  - これらが混在している
- `frontend/react/src/App.css`
  - editor shell
  - sidebar
  - AI UI
  - suggestion decoration
  - 全部が 1 ファイルに入っている

### Node API

- `node/src/routes/pressReleases.ts`
  - route 定義
  - validation
  - error mapping
  - use case 呼び出し
  - 一部 controller 的責務まで持っている
- `node/src/services/aiEditService.ts`
  - agent request DTO 組み立て
  - deterministic fallback
  - response normalization
  - presentation 制御
  - 外部 API client と use case が混ざっている
- `node/src/realtime/collaborationHub.ts`
  - WebSocket room 管理
  - document sync
  - save scheduling
  - application service 呼び出し
  - infra と application が強く結合している

### Agent

- まだ規模は小さい
- 今は `tasks`, `services`, `schemas` の境界で十分
- ただし将来 task が増えるなら `application / domain / infra` に寄せられるよう命名だけは揃えておく

## 提案構成

### Frontend

```text
frontend/react/src/features/pressReleaseEditor/
  application/
    buildEditorToolbarGroups.ts
    useEditorSession.ts
    usePendingAiSuggestions.ts
    useSidebarPreferences.ts
  domain/
    pendingAiSuggestion.ts
    editorSession.ts
    aiSuggestion.ts
  infrastructure/
    ai/
      aiApi.ts
    collaboration/
      collaborationGateway.ts
    storage/
      editorStorage.ts
  presentation/
    PressReleaseEditorPage.tsx
    components/
  editor/
    extensions/
    adapters/
  hooks/
    useAssetActions.ts
    useCommentThreads.ts
    useRevisionHistory.ts
```

#### Frontend の責務

- `presentation`
  - React component
  - props の受け渡し
  - 画面構成
- `application`
  - feature 用 hook
  - ユースケースの進行管理
  - 複数 infra を束ねる
- `domain`
  - 純粋関数
  - 型ガード
  - suggestion の正規化
  - editor 状態の業務ルール
- `infrastructure`
  - fetch
  - WebSocket
  - localStorage
  - browser API

### Node API

```text
node/src/
  domain/
    pressRelease/
      entities.ts
      errors.ts
      ports.ts
    ai/
      entities.ts
      errors.ts
      ports.ts
  application/
    pressRelease/
      getPressRelease.ts
      updatePressRelease.ts
      restoreRevision.ts
      requestAiEdit.ts
    collaboration/
      flushRoom.ts
  infrastructure/
    db/
    repositories/
    agent/
      agentClient.ts
    realtime/
      collaborationHub.ts
  interfaces/
    http/
      routes/
      controllers/
      presenters/
    ws/
      handlers/
  shared/
    schemas/
    utils/
```

#### Node の責務

- `domain`
  - エンティティ
  - domain error
  - repository / gateway port
- `application`
  - use case 単位の orchestration
  - transaction / version conflict / policy の判断
- `infrastructure`
  - PostgreSQL
  - Agent HTTP client
  - WebSocket room 実装
- `interfaces`
  - Hono route
  - request parse
  - response mapping

### Agent

```text
agent/
  application/
    run_task.py
  domain/
    task_definition.py
    editorial_policy.py
  infrastructure/
    llm/
      adk_runner.py
    validation/
      validator.py
  interfaces/
    http/
      app.py
  tasks/
  schemas/
```

## 移行順

### Phase 1

- Frontend の localStorage / pure helper を `application`, `domain` に移す
- `PressReleaseEditorPage` を container に寄せる
- CSS を editor shell / AI / suggestion decoration に分割する

### Phase 2

- Frontend の collaboration 制御を `useEditorSession` に切り出す
- `useAiAssistant` を
  - `useAiChatState`
  - `useAiRecommendationRunner`
  - `aiApi`
  に分ける

### Phase 3

- Node の route から controller/usecase を分離する
- `aiEditService` を
  - `application/requestAiEdit`
  - `infrastructure/agent/agentClient`
  - `domain/ai/*`
  に分ける

### Phase 4

- `collaborationHub` の保存処理を use case 経由にする
- realtime を interface/infrastructure に閉じ込める

## すぐにやらないこと

- agent の全面再構成
- frontend 全 feature の一括整理
- DB repository の全面 generic 化

今は editor feature と Node API の境界整理を優先した方が効果が大きい。
