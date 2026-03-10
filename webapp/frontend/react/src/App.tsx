import { usePressReleaseQuery } from "./features/pressReleaseEditor/hooks/usePressReleaseQueries";
import { PressReleaseEditorPage } from "./features/pressReleaseEditor/PressReleaseEditorPage";

export function App() {
  const { data, error, isError, isPending } = usePressReleaseQuery();

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
      </div>
    );
  }

  return (
    <PressReleaseEditorPage
      title={data.title}
      content={data.content}
      version={data.version}
    />
  );
}