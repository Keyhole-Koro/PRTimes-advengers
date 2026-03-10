import type { Editor } from "@tiptap/react";

import type {
  CommentThreadResponse,
  PressReleaseRevisionResponse,
  PressReleaseTemplateResponse,
  SidebarTab,
} from "../types";
import { AiSidebar, type AiSidebarProps } from "./AiSidebar";
import { CommentsSidebar } from "./CommentsSidebar";
import { HistorySidebar } from "./HistorySidebar";

type RevisionSummary = {
  added: number;
  removed: number;
};

type EditorSidebarProps = {
  activeThreadId: number | null;
  addReply: (threadId: number) => void | Promise<void>;
  applyTemplate: (templateId: number) => void | Promise<void>;
  applyingTemplateId: number | null;
  cancelCreateComment: () => void;
  commentThreads: CommentThreadResponse[];
  editor: Editor;
  isCreatingComment: boolean;
  isSavingTemplate: boolean;
  newCommentBody: string;
  previousRevision: PressReleaseRevisionResponse | null;
  replyBodies: Record<number, string>;
  restoreRevision: (revisionId: number) => void | Promise<void>;
  restoringRevisionId: number | null;
  revisionSummaries: Record<number, RevisionSummary>;
  revisions: PressReleaseRevisionResponse[];
  saveCurrentAsTemplate: () => void | Promise<void>;
  selectedRevision: PressReleaseRevisionResponse | null;
  selectedRevisionId: number | null;
  setActiveThreadId: (threadId: number | null) => void;
  setNewCommentBody: (value: string) => void;
  setReplyBody: (threadId: number, value: string) => void;
  setSelectedRevisionId: (revisionId: number) => void;
  setShowResolvedComments: (checked: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setTemplateName: (value: string) => void;
  showResolvedComments: boolean;
  sidebarTab: SidebarTab;
  submitCreateComment: () => void | Promise<void>;
  templateName: string;
  templates: PressReleaseTemplateResponse[];
  toggleResolveThread: (thread: CommentThreadResponse) => void | Promise<void>;
  aiSidebarProps: AiSidebarProps;
};

export function EditorSidebar({
  activeThreadId,
  addReply,
  applyTemplate,
  applyingTemplateId,
  cancelCreateComment,
  commentThreads,
  editor,
  isCreatingComment,
  isSavingTemplate,
  newCommentBody,
  previousRevision,
  replyBodies,
  restoreRevision,
  restoringRevisionId,
  revisionSummaries,
  revisions,
  saveCurrentAsTemplate,
  selectedRevision,
  selectedRevisionId,
  setActiveThreadId,
  setNewCommentBody,
  setReplyBody,
  setSelectedRevisionId,
  setShowResolvedComments,
  setSidebarTab,
  setTemplateName,
  showResolvedComments,
  sidebarTab,
  submitCreateComment,
  templateName,
  templates,
  toggleResolveThread,
  aiSidebarProps,
}: EditorSidebarProps) {
  return (
    <aside className="sidebarPanel" aria-label="サイドパネル">
      <div className="sidebarTabs">
        <button
          type="button"
          className={`sidebarTab${sidebarTab === "comments" ? " is-active" : ""}`}
          onClick={() => setSidebarTab("comments")}
        >
          コメント
        </button>
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
          templates={templates}
          templateName={templateName}
          setTemplateName={setTemplateName}
          saveCurrentAsTemplate={saveCurrentAsTemplate}
          isSavingTemplate={isSavingTemplate}
          applyingTemplateId={applyingTemplateId}
          applyTemplate={applyTemplate}
        />
      )}

      {sidebarTab === "ai" && <AiSidebar {...aiSidebarProps} />}
    </aside>
  );
}
