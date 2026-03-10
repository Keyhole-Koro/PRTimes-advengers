import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";

import { BASE_URL, PRESS_RELEASE_ID } from "../constants";
import type { CommentThreadResponse, SessionState } from "../types";

type UseCommentThreadsOptions = {
  createdBy: string;
  editor: Editor | null;
  onCommentCreated: (threadId: number) => void;
  requestFlush: () => void;
  session: SessionState | null;
};

export function useCommentThreads({
  createdBy,
  editor,
  onCommentCreated,
  requestFlush,
  session,
}: UseCommentThreadsOptions) {
  const [commentThreads, setCommentThreads] = useState<CommentThreadResponse[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [showResolvedComments, setShowResolvedComments] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyBodies, setReplyBodies] = useState<Record<number, string>>({});
  const [isCreatingComment, setIsCreatingComment] = useState(false);

  const fetchComments = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/press-releases/${PRESS_RELEASE_ID}/comments?includeResolved=${showResolvedComments}`,
      );
      if (response.ok) {
        setCommentThreads((await response.json()) as CommentThreadResponse[]);
      }
    } catch {
      // silently fail
    }
  };

  // biome-ignore lint: fetchComments depends on showResolvedComments
  useEffect(() => {
    if (session) {
      void fetchComments();
    }
  }, [session, showResolvedComments]);

  const handleCreateComment = async () => {
    if (!editor || newCommentBody.trim() === "") {
      return;
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      alert("コメントを追加するテキストを選択してください");
      return;
    }

    const quote = editor.state.doc.textBetween(from, to, " ");

    try {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anchorFrom: from,
          anchorTo: to,
          body: newCommentBody.trim(),
          createdBy,
          quote,
        }),
      });

      if (response.ok) {
        const thread = (await response.json()) as CommentThreadResponse;
        editor
          .chain()
          .setTextSelection({ from, to })
          .setMark("commentHighlight", { threadId: thread.id })
          .run();
        setNewCommentBody("");
        setIsCreatingComment(false);
        setActiveThreadId(thread.id);
        onCommentCreated(thread.id);
        requestFlush();
        await fetchComments();
      }
    } catch {
      alert("コメントの作成に失敗しました");
    }
  };

  const handleAddReply = async (threadId: number) => {
    const body = replyBodies[threadId]?.trim();
    if (!body) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/comments/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, createdBy }),
      });

      if (response.ok) {
        setReplyBodies((current) => ({ ...current, [threadId]: "" }));
        await fetchComments();
      }
    } catch {
      alert("返信の送信に失敗しました");
    }
  };

  const handleResolveThread = async (threadId: number) => {
    try {
      const response = await fetch(`${BASE_URL}/comments/${threadId}/resolve`, {
        method: "PATCH",
      });
      if (response.ok) {
        await fetchComments();
      }
    } catch {
      alert("コメントの解決に失敗しました");
    }
  };

  const handleUnresolveThread = async (threadId: number) => {
    try {
      const response = await fetch(`${BASE_URL}/comments/${threadId}/unresolve`, {
        method: "PATCH",
      });
      if (response.ok) {
        await fetchComments();
      }
    } catch {
      alert("コメントの再開に失敗しました");
    }
  };

  return {
    activeThreadId,
    commentThreads,
    handleAddReply,
    handleCreateComment,
    handleResolveThread,
    handleUnresolveThread,
    isCreatingComment,
    newCommentBody,
    replyBodies,
    setActiveThreadId,
    setIsCreatingComment,
    setNewCommentBody,
    setReplyBodies,
    setShowResolvedComments,
    showResolvedComments,
  };
}
