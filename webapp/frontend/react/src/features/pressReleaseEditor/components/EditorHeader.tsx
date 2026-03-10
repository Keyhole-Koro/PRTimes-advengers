import type { SaveStatus } from "../types";

type EditorHeaderProps = {
  remoteUserCount: number;
  saveStatus: SaveStatus;
  version: number;
};

export function EditorHeader({
  remoteUserCount,
  saveStatus,
  version,
}: EditorHeaderProps) {
  const activeEditors = remoteUserCount + 1;
  const saveStatusText =
    saveStatus === "saving"
      ? "保存中..."
      : saveStatus === "saved"
        ? "保存済み"
        : saveStatus === "dirty"
          ? "未保存の変更あり"
          : "接続または保存に失敗しました";

  return (
    <header className="header">
      <div className="titleBlock">
        <div className="metaRow">
          <div className={`statusCard saveStatus saveStatus-${saveStatus}`} aria-live="polite">
            <span className="statusLabel">保存状態</span>
            <span className="statusValue">{saveStatusText}</span>
            <div className="statusMetaRow">
              <span className="statusMeta">{`編集中 ${activeEditors}人`}</span>
              <span className="statusMeta">{`v${version}`}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
