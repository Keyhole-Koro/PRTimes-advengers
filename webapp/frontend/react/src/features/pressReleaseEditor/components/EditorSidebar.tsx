import type {
  PressReleaseRevisionResponse,
  SaveStatus,
  SidebarTab,
} from "../types";
import { AiSettingsSidebar, type AiSettingsSidebarProps } from "./AiSettingsSidebar";
import { AiSidebar, type AiSidebarProps } from "./AiSidebar";
import { EditorHeader } from "./EditorHeader";
import { HistorySidebar } from "./HistorySidebar";

type RevisionSummary = {
  added: number;
  removed: number;
};

type EditorSidebarProps = {
  autoRecommendDiffSize: number | null;
  previousRevision: PressReleaseRevisionResponse | null;
  restoreRevision: (revisionId: number) => void | Promise<void>;
  restoringRevisionId: number | null;
  revisionSummaries: Record<number, RevisionSummary>;
  revisions: PressReleaseRevisionResponse[];
  remoteUserCount: number;
  saveStatus: SaveStatus;
  selectedRevision: PressReleaseRevisionResponse | null;
  selectedRevisionId: number | null;
  setSelectedRevisionId: (revisionId: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  sidebarTab: SidebarTab;
  version: number;
  aiSidebarProps: AiSidebarProps;
  aiSettingsSidebarProps: AiSettingsSidebarProps;
};

export function EditorSidebar({
  autoRecommendDiffSize,
  previousRevision,
  restoreRevision,
  restoringRevisionId,
  revisionSummaries,
  revisions,
  remoteUserCount,
  saveStatus,
  selectedRevision,
  selectedRevisionId,
  setSelectedRevisionId,
  setSidebarTab,
  sidebarTab,
  version,
  aiSidebarProps,
  aiSettingsSidebarProps,
}: EditorSidebarProps) {
  return (
    <aside className="sidebarShell" aria-label="サイドパネル">
      <EditorHeader
        autoRecommendDiffSize={autoRecommendDiffSize}
        remoteUserCount={remoteUserCount}
        saveStatus={saveStatus}
        version={version}
      />

      <div className={`sidebarPanel${sidebarTab === "ai" || sidebarTab === "ai-settings" ? " is-ai-tab" : ""}`}>
        <div className="sidebarTabs">
          <button
            type="button"
            className={`sidebarTab${sidebarTab === "ai-settings" ? " is-active" : ""}`}
            onClick={() => setSidebarTab("ai-settings")}
          >
            AI設定
          </button>
          <button
            type="button"
            className={`sidebarTab${sidebarTab === "ai" ? " is-active" : ""}`}
            onClick={() => setSidebarTab("ai")}
          >
            AI
          </button>
          <button
            type="button"
            className={`sidebarTab${sidebarTab === "history" ? " is-active" : ""}`}
            onClick={() => setSidebarTab("history")}
          >
            履歴
          </button>
        </div>

        {sidebarTab === "ai-settings" && <AiSettingsSidebar {...aiSettingsSidebarProps} />}

        {sidebarTab === "history" && (
          <HistorySidebar
            revisions={revisions}
            selectedRevision={selectedRevision}
            previousRevision={previousRevision}
            selectedRevisionId={selectedRevisionId}
            setSelectedRevisionId={setSelectedRevisionId}
            revisionSummaries={revisionSummaries}
            restoringRevisionId={restoringRevisionId}
            restoreRevision={restoreRevision}
          />
        )}

        {sidebarTab === "ai" && <AiSidebar {...aiSidebarProps} />}
      </div>
    </aside>
  );
}
