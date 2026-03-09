import type { Editor } from "@tiptap/react";
import type { ChangeEvent } from "react";

import type { CommentThreadResponse } from "../types";

type CommentsSidebarProps = {
  editor: Editor;
  isCreatingComment: boolean;
  newCommentBody: string;
  setNewCommentBody: (value: string) => void;
  cancelCreateComment: () => void;
  submitCreateComment: () => void | Promise<void>;
  showResolvedComments: boolean;
  setShowResolvedComments: (checked: boolean) => void;
  commentThreads: CommentThreadResponse[];
  activeThreadId: number | null;
  setActiveThreadId: (threadId: number | null) => void;
  replyBodies: Record<number, string>;
  setReplyBody: (threadId: number, value: string) => void;
  addReply: (threadId: number) => void | Promise<void>;
  toggleResolveThread: (thread: CommentThreadResponse) => void | Promise<void>;
};

export function CommentsSidebar({
  editor,
  isCreatingComment,
  newCommentBody,
  setNewCommentBody,
  cancelCreateComment,
  submitCreateComment,
  showResolvedComments,
  setShowResolvedComments,
  commentThreads,
  activeThreadId,
  setActiveThreadId,
  replyBodies,
  setReplyBody,
  addReply,
  toggleResolveThread,
}: CommentsSidebarProps) {
  return (
    <div className="commentPanel">
      {isCreatingComment && (
        <div className="commentCreateForm">
          <p className="commentQuotePreview">
            「{editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ")}」
          </p>
          <textarea
            value={newCommentBody}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNewCommentBody(event.target.value)}
            placeholder="コメントを入力..."
            className="commentInput"
            rows={3}
          />
          <div className="commentCreateActions">
            <button type="button" onClick={cancelCreateComment} className="commentCancelButton">
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => void submitCreateComment()}
              className="commentSubmitButton"
              disabled={!newCommentBody.trim()}
            >
              送信
            </button>
          </div>
        </div>
      )}

      <label className="commentResolvedToggle">
        <input
          type="checkbox"
          checked={showResolvedComments}
          onChange={(event) => setShowResolvedComments(event.target.checked)}
        />
        解決済みを表示
      </label>

      <div className="commentThreadList">
        {commentThreads.map((thread) => (
          <div
            key={thread.id}
            className={`commentThread${thread.id === activeThreadId ? " is-active" : ""}${thread.is_resolved ? " is-resolved" : ""}`}
            onClick={() => setActiveThreadId(activeThreadId === thread.id ? null : thread.id)}
            onKeyDown={() => {}}
            role="button"
            tabIndex={0}
          >
            <div className="commentThreadHeader">
              <span className="commentThreadQuote">「{thread.quote}」</span>
              <span className="commentThreadMeta">
                {thread.created_by} · {thread.created_at}
              </span>
            </div>

            <div className="commentMessages">
              {thread.messages.map((message) => (
                <div key={message.id} className="commentMessage">
                  <div className="commentMessageHead">
                    <span className="commentMessageAuthor">{message.created_by}</span>
                    <span className="commentMessageTime">{message.created_at}</span>
                  </div>
                  <span className="commentMessageBody">{message.body}</span>
                </div>
              ))}
            </div>

            {activeThreadId === thread.id && (
              <div
                className="commentThreadActions"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                role="group"
              >
                <div className="commentReplyForm">
                  <textarea
                    value={replyBodies[thread.id] ?? ""}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      setReplyBody(thread.id, event.target.value)
                    }
                    placeholder="返信を入力..."
                    className="commentReplyInput"
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={() => void addReply(thread.id)}
                    className="commentReplyButton"
                    disabled={!replyBodies[thread.id]?.trim()}
                  >
                    返信
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleResolveThread(thread)}
                  className={`commentResolveButton${thread.is_resolved ? " is-resolved" : ""}`}
                >
                  {thread.is_resolved ? "再開" : "解決"}
                </button>
              </div>
            )}
          </div>
        ))}
        {commentThreads.length === 0 && <p className="commentEmpty">コメントはまだありません</p>}
      </div>
    </div>
  );
}

