import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { EMPTY_CONTENT } from "./features/pressReleaseEditor/constants";
import { PressReleaseEditorScreen } from "./features/pressReleaseEditor/presentation/PressReleaseEditorScreen";
import { BASE_URL, PRESS_RELEASE_LIST_QUERY_KEY } from "./features/pressReleaseEditor/constants";
import { usePressReleaseListQuery, usePressReleaseQuery } from "./features/pressReleaseEditor/hooks/usePressReleaseQueries";

function getPressReleaseIdFromLocation(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = new URLSearchParams(window.location.search).get("id");
  if (!raw) {
    return null;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function updateLocationForPressRelease(pressReleaseId: number | null) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (pressReleaseId === null) {
    url.searchParams.delete("id");
  } else {
    url.searchParams.set("id", String(pressReleaseId));
  }
  window.history.pushState({}, "", url);
}

export function App() {
  const queryClient = useQueryClient();
  const [selectedPressReleaseId, setSelectedPressReleaseId] = useState<number | null>(() => getPressReleaseIdFromLocation());
  const [isCreatingPressRelease, setIsCreatingPressRelease] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { data: pressReleases = [], error: listError, isError: isListError, isPending: isListPending } = usePressReleaseListQuery();
  const { data, error, isError, isPending } = usePressReleaseQuery(selectedPressReleaseId);

  const selectedPressRelease = useMemo(
    () => pressReleases.find((pressRelease) => pressRelease.id === selectedPressReleaseId) ?? null,
    [pressReleases, selectedPressReleaseId],
  );

  const openPressRelease = (pressReleaseId: number) => {
    setSelectedPressReleaseId(pressReleaseId);
    updateLocationForPressRelease(pressReleaseId);
  };

  const returnToList = () => {
    setSelectedPressReleaseId(null);
    updateLocationForPressRelease(null);
  };

  const handleCreatePressRelease = async () => {
    setIsCreatingPressRelease(true);
    setCreateError(null);

    try {
      const response = await fetch(`${BASE_URL}/press-releases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "無題のプレスリリース",
          content: EMPTY_CONTENT,
        }),
      });

      if (!response.ok) {
        throw new Error(`新規作成に失敗しました (${response.status})`);
      }

      const created = (await response.json()) as { id: number };
      await queryClient.invalidateQueries({ queryKey: PRESS_RELEASE_LIST_QUERY_KEY });
      openPressRelease(created.id);
    } catch (createPressReleaseError) {
      setCreateError(createPressReleaseError instanceof Error ? createPressReleaseError.message : "新規作成に失敗しました");
    } finally {
      setIsCreatingPressRelease(false);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setSelectedPressReleaseId(getPressReleaseIdFromLocation());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (selectedPressReleaseId === null) {
    return (
      <div className="appShell">
        <section className="pressReleaseListScreen">
          <header className="pressReleaseListHeader">
            <div>
              <p className="pressReleaseListEyebrow">Press Releases</p>
              <h1 className="pressReleaseListTitle">記事一覧</h1>
              <p className="pressReleaseListDescription">既存の記事を開くか、新しい記事を作成してください。</p>
            </div>
            <button
              type="button"
              className="pressReleaseCreateButton"
              onClick={() => void handleCreatePressRelease()}
              disabled={isCreatingPressRelease}
            >
              {isCreatingPressRelease ? "作成中..." : "新規作成"}
            </button>
          </header>

          {createError && <p className="pressReleaseListError">{createError}</p>}

          {isListPending && (
            <div className="statusScreen">
              <p>記事一覧を読み込み中です...</p>
            </div>
          )}

          {isListError && (
            <div className="errorState">
              <h1>記事一覧を読み込めません</h1>
              <p>{listError.message}</p>
            </div>
          )}

          {!isListPending && !isListError && (
            <div className="pressReleaseCardList">
              {pressReleases.map((pressRelease) => (
                <button
                  key={pressRelease.id}
                  type="button"
                  className={`pressReleaseCard${selectedPressRelease?.id === pressRelease.id ? " is-active" : ""}`}
                  onClick={() => openPressRelease(pressRelease.id)}
                >
                  <div className="pressReleaseCardMetaRow">
                    <span className="pressReleaseCardMeta">#{pressRelease.id}</span>
                    <span className="pressReleaseCardMeta">v{pressRelease.version}</span>
                  </div>
                  <strong className="pressReleaseCardTitle">{pressRelease.title}</strong>
                  <p className="pressReleaseCardSnippet">
                    {typeof pressRelease.updated_at === "string" ? `更新: ${pressRelease.updated_at}` : "更新日時なし"}
                  </p>
                </button>
              ))}
              {pressReleases.length === 0 && (
                <div className="pressReleaseEmptyState">
                  <p>まだ記事がありません。最初の1件を作成してください。</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="statusScreen">
        <p>読み込み中です...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="errorState">
        <h1>エディターを読み込めません</h1>
        <p>{error.message}</p>
        <p>バックエンドの起動状態を確認してください。</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="statusScreen">
        <p>データがありません</p>
        <button type="button" className="pressReleaseBackButton" onClick={returnToList}>
          一覧へ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="appShell">
      <div className="editorTopBar">
        <button type="button" className="pressReleaseBackButton" onClick={returnToList}>
          一覧へ戻る
        </button>
      </div>
      <PressReleaseEditorScreen
        pressReleaseId={selectedPressReleaseId}
        title={data.title}
        content={data.content ?? EMPTY_CONTENT}
        version={data.version}
      />
    </div>
  );
}
