import type { Editor } from "@tiptap/react";

import type {
  CommentThreadResponse,
  PressReleaseRevisionResponse,
  SaveStatus,
  SidebarTab,
} from "../types";
import { AiSidebar, type AiSidebarProps } from "./AiSidebar";
import { CommentsSidebar } from "./CommentsSidebar";
import { EditorHeader } from "./EditorHeader";
import { HistorySidebar } from "./HistorySidebar";

type RevisionSummary = {
  added: number;
  removed: number;
};

type EditorSidebarProps = {
  activeThreadId: number | null;
  addReply: (threadId: number) => void | Promise<void>;
  autoRecommendLineDelta: number | null;
  cancelCreateComment: () => void;
  commentThreads: CommentThreadResponse[];
  editor: Editor;
  isCreatingComment: boolean;
  newCommentBody: string;
  previousRevision: PressReleaseRevisionResponse | null;
  replyBodies: Record<number, string>;
  restoreRevision: (revisionId: number) => void | Promise<void>;
  restoringRevisionId: number | null;
  revisionSummaries: Record<number, RevisionSummary>;
  revisions: PressReleaseRevisionResponse[];
  remoteUserCount: number;
  saveStatus: SaveStatus;
  selectedRevision: PressReleaseRevisionResponse | null;
  selectedRevisionId: number | null;
  setActiveThreadId: (threadId: number | null) => void;
  setNewCommentBody: (value: string) => void;
  setReplyBody: (threadId: number, value: string) => void;
  setSelectedRevisionId: (revisionId: number) => void;
  setShowResolvedComments: (checked: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  showResolvedComments: boolean;
  sidebarTab: SidebarTab;
  submitCreateComment: () => void | Promise<void>;
  toggleResolveThread: (thread: CommentThreadResponse) => void | Promise<void>;
  version: number;
  aiSidebarProps: AiSidebarProps;
};

export function EditorSidebar({
  activeThreadId,
  addReply,
  autoRecommendLineDelta,
  cancelCreateComment,
  commentThreads,
  editor,
  isCreatingComment,
  newCommentBody,
  previousRevision,
  replyBodies,
  restoreRevision,
  restoringRevisionId,
  revisionSummaries,
  revisions,
  remoteUserCount,
  saveStatus,
  selectedRevision,
  selectedRevisionId,
  setActiveThreadId,
  setNewCommentBody,
  setReplyBody,
  setSelectedRevisionId,
  setShowResolvedComments,
  setSidebarTab,
  showResolvedComments,
  sidebarTab,
  submitCreateComment,
  toggleResolveThread,
  version,
  aiSidebarProps,
}: EditorSidebarProps) {
  return (
    <aside className="sidebarShell" aria-label="サイドパネル">
      <EditorHeader
        autoRecommendLineDelta={autoRecommendLineDelta}
        remoteUserCount={remoteUserCount}
        saveStatus={saveStatus}
        version={version}
      />

      <div className={`sidebarPanel${sidebarTab === "ai" ? " is-ai-tab" : ""}`}>
        <div className="sidebarTabs">
          <button
            type="button"
            className={`sidebarTab${sidebarTab === "history" ? " is-active" : ""}`}
            onClick={() => setSidebarTab("history")}
          >
            履歴
          </button>
          <button
            type="button"
            className={`sidebarTab${sidebarTab === "ai" ? " is-active" : ""}`}
            onClick={() => setSidebarTab("ai")}
          >
            AI
          </button>
        </div>

        {sidebarTab === "comments" && (
          <CommentsSidebar
            editor={editor}
            isCreatingComment={isCreatingComment}
            newCommentBody={newCommentBody}
            setNewCommentBody={setNewCommentBody}
            cancelCreateComment={cancelCreateComment}
            submitCreateComment={submitCreateComment}
            showResolvedComments={showResolvedComments}
            setShowResolvedComments={setShowResolvedComments}
            commentThreads={commentThreads}
            activeThreadId={activeThreadId}
            setActiveThreadId={setActiveThreadId}
            replyBodies={replyBodies}
            setReplyBody={setReplyBody}
            addReply={addReply}
            toggleResolveThread={toggleResolveThread}
          />
        )}

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
