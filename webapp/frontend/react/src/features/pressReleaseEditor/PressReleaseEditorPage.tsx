import { useQueryClient } from "@tanstack/react-query";
import { receiveTransaction, sendableSteps } from "@tiptap/pm/collab";
import { Step } from "@tiptap/pm/transform";
import { type Editor, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import "../../App.css";
import { CommentHighlight } from "../../editor/commentHighlight";
import { LinkCard } from "../../editor/linkCard";
import type { PresenceUser } from "../../editor/remotePresence";
import { RemotePresence, setRemotePresence } from "../../editor/remotePresence";
import { EditorSidebar } from "./components/EditorSidebar";
import { EditorWorkspace } from "./components/EditorWorkspace";
import {
  BASE_URL,
  MARK_BUTTONS,
  PRESS_RELEASE_ID,
  QUERY_KEY,
  REVISIONS_QUERY_KEY,
  WS_BASE_URL,
} from "./constants";
import {
  createAiSuggestionDecorations,
  setActiveAiSuggestion,
  setAiSuggestions,
} from "./extensions/aiSuggestionDecorations";
import { useAssetActions } from "./hooks/useAssetActions";
import { RemovableImage } from "./extensions/removableImage";
import { useCommentThreads } from "./hooks/useCommentThreads";
import { useRevisionHistory } from "./hooks/useRevisionHistory";
import { useAiAssistant } from "./hooks/useAiAssistant";
import type {
  AgentDocumentEditResult,
  AgentDocumentEditOperation,
  AgentDocumentEditSuggestion,
  AgentDocumentSuggestionCategory,
  MarkType,
  PendingAiSuggestion,
  PressRelease,
  RealtimeMessage,
  SaveStatus,
  SessionState,
  SidebarTab,
  ToolbarGroupConfig,
} from "./types";
import { applyAgentDocumentSuggestion } from "./utils/applyAgentDocumentEdit";
import { createCollaborationExtension, createRealtimeIdentity } from "./utils/realtime";

function isValidSuggestionCategory(value: unknown): value is AgentDocumentSuggestionCategory {
  return (
    value === "title" ||
    value === "lede" ||
    value === "structure" ||
    value === "readability" ||
    value === "keyword" ||
    value === "tag" ||
    value === "risk" ||
    value === "body"
  );
}

function isValidPendingAiSuggestion(value: unknown): value is PendingAiSuggestion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<PendingAiSuggestion>;
  return (
    typeof record.id === "string" &&
    typeof record.prompt === "string" &&
    typeof record.responseSummary === "string" &&
    typeof record.suggestion === "object" &&
    record.suggestion !== null &&
    typeof record.suggestion.id === "string" &&
    (record.suggestion.presentation === undefined ||
      record.suggestion.presentation === "block" ||
      record.suggestion.presentation === "inline") &&
    isValidSuggestionCategory(record.suggestion.category) &&
    typeof record.suggestion.summary === "string" &&
    Array.isArray(record.suggestion.operations)
  );
}

function normalizeLegacySuggestion(value: unknown): PendingAiSuggestion | null {
  if (isValidPendingAiSuggestion(value)) {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const legacy = value as {
    id?: unknown;
    prompt?: unknown;
    result?: {
      summary?: unknown;
      operations?: unknown[];
    };
  };

  if (
    typeof legacy.id !== "string" ||
    typeof legacy.prompt !== "string" ||
    typeof legacy.result?.summary !== "string" ||
    !Array.isArray(legacy.result?.operations)
  ) {
    return null;
  }

  const suggestion: AgentDocumentEditSuggestion = {
    id: `${legacy.id}-legacy`,
    presentation: "block",
    category: "body",
    summary: legacy.result.summary,
    operations: legacy.result.operations as AgentDocumentEditSuggestion["operations"],
  };

  return {
    id: legacy.id,
    prompt: legacy.prompt,
    responseSummary: legacy.result.summary,
    suggestion,
  };
}

function withOperationText(operation: AgentDocumentEditOperation, nextText?: string): AgentDocumentEditOperation {
  if (typeof nextText !== "string") {
    return operation;
  }

  if (operation.op === "add") {
    return {
      ...operation,
      block: {
        ...operation.block,
        text: nextText,
      },
    };
  }

  if (operation.op === "modify") {
    return {
      ...operation,
      after: {
        ...operation.after,
        text: nextText,
      },
    };
  }

  return operation;
}

export function PressReleaseEditorPage({
  title: initialTitle,
  content,
  version: initialVersion,
}: PressRelease) {
  const aiSuggestionStorageKey = `press-release-editor-ai-suggestions:${PRESS_RELEASE_ID}`;
  const sidebarTabStorageKey = `press-release-editor-sidebar-tab:${PRESS_RELEASE_ID}`;
  const sidebarWidthStorageKey = `press-release-editor-sidebar-width:${PRESS_RELEASE_ID}`;
  const queryClient = useQueryClient();
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [identity] = useState(createRealtimeIdentity);
  const [title, setTitle] = useState(() => initialTitle);
  const [version, setVersion] = useState(() => initialVersion);
  const [session, setSession] = useState<SessionState | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<PresenceUser[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [editorResetToken, setEditorResetToken] = useState(0);
  const [restoringRevisionId, setRestoringRevisionId] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
    if (typeof window === "undefined") {
      return "history";
    }

    const raw = window.localStorage.getItem(sidebarTabStorageKey);
    return raw === "comments" || raw === "history" || raw === "ai" ? raw : "history";
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") {
      return 320;
    }

    const raw = window.localStorage.getItem(sidebarWidthStorageKey);
    const value = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(value) ? Math.min(480, Math.max(280, value)) : 320;
  });
  const [pendingAiSuggestions, setPendingAiSuggestions] = useState<PendingAiSuggestion[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(aiSuggestionStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(normalizeLegacySuggestion).filter((value): value is PendingAiSuggestion => value !== null);
    } catch {
      return [];
    }
  });
  const [activeAiSuggestionId, setActiveAiSuggestionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const lastSentBatchRef = useRef<string | null>(null);
  const pendingAiSuggestionsRef = useRef<PendingAiSuggestion[]>([]);
  const requestFlushRef = useRef<() => void>(() => {});
  const [aiSuggestionExtension] = useState(() =>
    createAiSuggestionDecorations({
      onAcceptSuggestion: (suggestionId) => {
        const suggestion = pendingAiSuggestionsRef.current.find((entry) => entry.id === suggestionId);
        if (!suggestion || !editorRef.current) {
          return;
        }

        const nextContent = applyAgentDocumentSuggestion(editorRef.current.getJSON(), suggestion.suggestion);
        editorRef.current.commands.setContent(nextContent);
        setPendingAiSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
        setActiveAiSuggestionId(null);
        setSaveStatus("dirty");
        requestFlushRef.current();
      },
      onAcceptSuggestionOperation: (suggestionId, operationIndex, nextText) => {
        const suggestion = pendingAiSuggestionsRef.current.find((entry) => entry.id === suggestionId);
        if (!suggestion || !editorRef.current) {
          return;
        }

        const operation = suggestion.suggestion.operations[operationIndex];
        if (!operation) {
          return;
        }

        const editedOperation = withOperationText(operation, nextText);
        const partialSuggestion: AgentDocumentEditSuggestion = {
          ...suggestion.suggestion,
          operations: [editedOperation],
        };

        const nextContent = applyAgentDocumentSuggestion(editorRef.current.getJSON(), partialSuggestion);
        editorRef.current.commands.setContent(nextContent);
        let hasRemainingOperations = false;
        setPendingAiSuggestions((current) =>
          current
            .map((entry) => {
              if (entry.id !== suggestionId) {
                return entry;
              }

              const remainingOperations = entry.suggestion.operations.filter((_, index) => index !== operationIndex);
              hasRemainingOperations = remainingOperations.length > 0;
              if (remainingOperations.length === 0) {
                return null;
              }

              return {
                ...entry,
                suggestion: {
                  ...entry.suggestion,
                  operations: remainingOperations,
                },
              };
            })
            .filter((entry): entry is PendingAiSuggestion => entry !== null),
        );
        setActiveAiSuggestionId((current) => (current === suggestionId && !hasRemainingOperations ? null : current));
        setSaveStatus("dirty");
        requestFlushRef.current();
      },
      onActivateSuggestion: (suggestionId) => {
        setActiveAiSuggestionId(suggestionId);
      },
      onDiscardSuggestion: (suggestionId) => {
        setPendingAiSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
        setActiveAiSuggestionId((current) => (current === suggestionId ? null : current));
      },
      onDiscardSuggestionOperation: (suggestionId, operationIndex) => {
        let hasRemainingOperations = false;
        setPendingAiSuggestions((current) =>
          current
            .map((entry) => {
              if (entry.id !== suggestionId) {
                return entry;
              }

              const remainingOperations = entry.suggestion.operations.filter((_, index) => index !== operationIndex);
              hasRemainingOperations = remainingOperations.length > 0;
              if (remainingOperations.length === 0) {
                return null;
              }

              return {
                ...entry,
                suggestion: {
                  ...entry.suggestion,
                  operations: remainingOperations,
                },
              };
            })
            .filter((entry): entry is PendingAiSuggestion => entry !== null),
        );
        setActiveAiSuggestionId((current) => (current === suggestionId && !hasRemainingOperations ? null : current));
      },
    }),
  );

  const editor = useEditor(
    {
      content: session?.snapshot.content ?? content,
      editable: Boolean(session),
      extensions: session
        ? [
            StarterKit,
            RemovableImage,
            aiSuggestionExtension,
            LinkCard,
            RemotePresence,
            CommentHighlight,
            createCollaborationExtension(session.revision, session.clientId),
          ]
        : [StarterKit, RemovableImage, aiSuggestionExtension, LinkCard, RemotePresence, CommentHighlight],
      immediatelyRender: false,
    },
    [session?.clientId, session?.revision, editorResetToken],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    pendingAiSuggestionsRef.current = pendingAiSuggestions;
  }, [pendingAiSuggestions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(aiSuggestionStorageKey, JSON.stringify(pendingAiSuggestions));
  }, [aiSuggestionStorageKey, pendingAiSuggestions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(sidebarTabStorageKey, sidebarTab);
  }, [sidebarTab, sidebarTabStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(sidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth, sidebarWidthStorageKey]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    setAiSuggestions(editor, pendingAiSuggestions);
  }, [editor, pendingAiSuggestions]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    setActiveAiSuggestion(editor, activeAiSuggestionId);
  }, [activeAiSuggestionId, editor]);

  const sendPendingSteps = (currentEditor: Editor) => {
    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const pending = sendableSteps(currentEditor.state);
    if (!pending || pending.steps.length === 0) {
      lastSentBatchRef.current = null;
      return;
    }

    const batchKey = `${pending.version}:${pending.steps.length}`;
    if (lastSentBatchRef.current === batchKey) {
      return;
    }

    lastSentBatchRef.current = batchKey;
    websocket.send(
      JSON.stringify({
        content: currentEditor.getJSON(),
        steps: pending.steps.map((step) => step.toJSON()),
        type: "document.steps",
        version: pending.version,
      }),
    );
  };

  const markState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      underline: currentEditor?.isActive("underline") ?? false,
    }),
  });

  const {
    previousRevision,
    revisions,
    revisionSummaries,
    selectedRevision,
    selectedRevisionId,
    setSelectedRevisionId,
  } = useRevisionHistory();

  useEffect(() => {
    const params = new URLSearchParams({
      color: identity.color,
      name: identity.name,
      userId: identity.userId,
    });

    const websocket = new WebSocket(`${WS_BASE_URL}/ws/press-releases/${PRESS_RELEASE_ID}?${params.toString()}`);
    websocketRef.current = websocket;

    websocket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as RealtimeMessage;

      if (message.type === "session.ready") {
        setSession({
          clientId: message.clientId,
          revision: message.revision,
          snapshot: message.snapshot,
        });
        setTitle(message.snapshot.title);
        setVersion(message.snapshot.version);
        setRemoteUsers(message.presence.filter((user) => user.userId !== identity.userId));
        setSaveStatus("saved");
        return;
      }

      if (message.type === "presence.snapshot") {
        setRemoteUsers(message.users.filter((user) => user.userId !== identity.userId));
        return;
      }

      if (message.type === "title.sync") {
        setTitle(message.title);
        setSaveStatus("dirty");
        return;
      }

      if (message.type === "document.saved") {
        setTitle(message.title);
        setVersion(message.version);
        setSaveStatus("saved");
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: REVISIONS_QUERY_KEY });
        return;
      }

      if (message.type === "document.resync") {
        setTitle(message.snapshot.title);
        setVersion(message.snapshot.version);
        setSaveStatus("saved");
        setSession((current) =>
          current
            ? {
                ...current,
                revision: message.revision,
                snapshot: message.snapshot,
              }
            : null,
        );
        lastSentBatchRef.current = null;
        setEditorResetToken((current) => current + 1);
        return;
      }

      if (message.type !== "document.steps") {
        return;
      }

      const currentEditor = editorRef.current;
      if (!currentEditor) {
        return;
      }

      const nextSteps = message.steps.map((step) => Step.fromJSON(currentEditor.schema, step));
      const transaction = receiveTransaction(currentEditor.state, nextSteps, message.clientIds);
      isApplyingRemoteRef.current = true;
      currentEditor.view.dispatch(transaction);
      isApplyingRemoteRef.current = false;
      lastSentBatchRef.current = null;
      setSaveStatus("dirty");
      sendPendingSteps(currentEditor);
    });

    websocket.addEventListener("close", () => {
      setSaveStatus("error");
    });

    websocket.addEventListener("error", () => {
      setSaveStatus("error");
    });

    return () => {
      websocket.close();
      websocketRef.current = null;
    };
  }, [identity, queryClient]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    setRemotePresence(editor, remoteUsers);
  }, [editor, remoteUsers]);

  useEffect(() => {
    if (!editor || !session) {
      return;
    }

    const sendPresenceUpdate = () => {
      const websocket = websocketRef.current;
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        return;
      }

      const selection = editor.state.selection;
      websocket.send(
        JSON.stringify({
          color: identity.color,
          name: identity.name,
          selection: {
            from: selection.from,
            to: selection.to,
          },
          type: "presence.update",
          userId: identity.userId,
        }),
      );
    };

    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (isApplyingRemoteRef.current || !transaction.docChanged) {
        return;
      }

      setSaveStatus("dirty");
      sendPendingSteps(editor);
    };

    editor.on("transaction", handleTransaction);
    editor.on("selectionUpdate", sendPresenceUpdate);
    sendPresenceUpdate();

    return () => {
      editor.off("transaction", handleTransaction);
      editor.off("selectionUpdate", sendPresenceUpdate);
    };
  }, [editor, identity, session]);

  const requestFlush = () => {
    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saving");
    websocket.send(JSON.stringify({ type: "document.flush" }));
  };

  requestFlushRef.current = requestFlush;

  const sendTitleUpdate = (nextTitle: string) => {
    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    websocket.send(
      JSON.stringify({
        title: nextTitle,
        type: "title.update",
      }),
    );
  };

  const restoreRevision = async (revisionId: number) => {
    setRestoringRevisionId(revisionId);
    setSaveStatus("saving");

    try {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}/revisions/${revisionId}/restore`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("変更履歴の復元に失敗しました");
      }

      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: REVISIONS_QUERY_KEY });
      setSaveStatus("saved");
    } catch (restoreError) {
      setSaveStatus("error");
      const message = restoreError instanceof Error ? restoreError.message : "変更履歴の復元に失敗しました";
      alert(message);
    } finally {
      setRestoringRevisionId(null);
    }
  };

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTitle = event.target.value;
    setTitle(nextTitle);
    setSaveStatus("dirty");
    sendTitleUpdate(nextTitle);
  };

  const handleSidebarResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    event.preventDefault();
    const bounds = workspace.getBoundingClientRect();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const minWidth = 280;
    const maxWidth = Math.min(520, Math.max(minWidth, bounds.width - 420));
    document.body.classList.add("is-resizing-panels");

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      document.body.classList.remove("is-resizing-panels");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const {
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
  } = useCommentThreads({
    createdBy: identity.name,
    editor,
    onCommentCreated: (threadId) => {
      setActiveThreadId(threadId);
      setSidebarTab("comments");
    },
    requestFlush,
    session,
  });

  const {
    fileActions: { handleImageSelected, handleImportHtml, handlePickHtml, handlePickImage },
    isDraggingImage,
    isUploadingImage,
    uploadActions: {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleInsertLinkCard,
    },
  } = useAssetActions({
    editor,
    fileInputRef,
    htmlInputRef,
    requestFlush,
    setSaveStatus,
    setTitle,
    title,
  });

  const handleCreateAiSuggestion = (suggestionId: string, prompt: string, result: AgentDocumentEditResult) => {
    const suggestions = result.suggestions.map((suggestion) => ({
      id: `${suggestionId}:${suggestion.id}`,
      prompt,
      responseSummary: result.summary,
      suggestion,
    }));

    setPendingAiSuggestions((current) => [...current, ...suggestions]);
    setActiveAiSuggestionId(suggestions[0]?.id ?? null);
  };

  const aiAssistant = useAiAssistant({ editor, onCreateDocumentSuggestion: handleCreateAiSuggestion, title });

  const handleJumpToSuggestion = (messageId: string) => {
    const suggestion = pendingAiSuggestionsRef.current.find((entry) => entry.id.startsWith(`${messageId}:`));
    if (!suggestion) {
      return;
    }

    setActiveAiSuggestionId(suggestion.id);

    const scrollToSuggestion = () => {
      const element = document.querySelector<HTMLElement>(`.aiSuggestionWidget[data-suggestion-id="${suggestion.id}"]`);
      if (!element) {
        return;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToSuggestion);
    });
  };

  const handleStartComment = () => {
    if (!editor) {
      return;
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      alert("テキストを選択してからコメントを追加してください");
      return;
    }

    setIsCreatingComment(true);
    setSidebarTab("comments");
  };

  useEffect(() => {
    if (!editor || !session) {
      return;
    }

    const handleClickCommentMark = () => {
      const { from } = editor.state.selection;
      const resolved = editor.state.doc.resolve(from);
      const marks = resolved.marks();
      const commentMark = marks.find((mark) => mark.type.name === "commentHighlight");
      if (commentMark?.attrs.threadId) {
        setActiveThreadId(commentMark.attrs.threadId as number);
        setSidebarTab("comments");
      }
    };

    editor.on("selectionUpdate", handleClickCommentMark);
    return () => {
      editor.off("selectionUpdate", handleClickCommentMark);
    };
  }, [commentThreads, editor, session, setActiveThreadId]);

  if (!editor || !session) {
    return (
      <div className="container">
        <div className="loadingState">共同編集セッションを接続しています...</div>
      </div>
    );
  }

  const toggleMark = (mark: MarkType) => {
    const chain = editor.chain().focus();
    if (mark === "bold") {
      chain.toggleBold().run();
      return;
    }
    if (mark === "italic") {
      chain.toggleItalic().run();
      return;
    }
    chain.toggleUnderline().run();
  };

  const toolbarGroups: ToolbarGroupConfig[] = [
    {
      buttons: MARK_BUTTONS.map((button) => ({
        isActive: markState?.[button.key] ?? false,
        key: button.key,
        label: button.label,
        tooltip: button.tooltip,
        onClick: () => toggleMark(button.key),
      })),
      label: "書式",
    },
    {
      buttons: [
        {
          isActive: editor.isActive("paragraph"),
          key: "paragraph",
          label: "本文",
          onClick: () => editor.chain().focus().setParagraph().run(),
        },
        {
          isActive: editor.isActive("heading", { level: 1 }),
          key: "heading-1",
          label: "H1",
          tooltip: "見出し1",
          onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          isActive: editor.isActive("heading", { level: 2 }),
          key: "heading-2",
          label: "H2",
          tooltip: "見出し2",
          onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
      ],
      label: "見出し",
    },
    {
      buttons: [
        {
          isActive: editor.isActive("bulletList"),
          key: "bullet-list",
          label: "箇条書き",
          onClick: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          isActive: editor.isActive("orderedList"),
          key: "ordered-list",
          label: "番号付き",
          onClick: () => editor.chain().focus().toggleOrderedList().run(),
        },
      ],
      label: "リスト",
    },
    {
      buttons: [
        {
          isActive: false,
          key: "image-upload",
          label: "画像を追加",
          onClick: handlePickImage,
        },
        {
          isActive: false,
          key: "insert-link-card",
          label: "リンクを追加",
          onClick: () => {
            const url = window.prompt("リンクURLを入力してください (https://...)");
            if (!url) {
              return;
            }
            void handleInsertLinkCard(url);
          },
        },
      ],
      label: "画像",
    },
    {
      buttons: [
        {
          isActive: isCreatingComment,
          key: "add-comment",
          label: "コメント追加",
          onClick: handleStartComment,
        },
      ],
      label: "コメント",
    },
    {
      buttons: [
        {
          isActive: false,
          key: "html-import",
          label: "HTMLをインポート",
          onClick: handlePickHtml,
        },
      ],
      label: "リンク",
    },
  ];

  return (
    <div className="container">
      <main className="main">
        <div
          ref={workspaceRef}
          className="workspace"
          style={{ gridTemplateColumns: `minmax(0, 1fr) 12px ${sidebarWidth}px` }}
        >
          <EditorWorkspace
            editor={editor}
            fileInputRef={fileInputRef}
            handleDragEnter={handleDragEnter}
            handleDragLeave={handleDragLeave}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleImageSelected={handleImageSelected}
            handleImportHtml={handleImportHtml}
            htmlInputRef={htmlInputRef}
            isDraggingImage={isDraggingImage}
            isUploadingImage={isUploadingImage}
            onTitleChange={handleTitleChange}
            title={title}
            toolbarGroups={toolbarGroups}
          />

          <div
            className="paneResizeHandle paneResizeHandle-sidebar"
            role="separator"
            aria-orientation="vertical"
            aria-label="右サイドバーの幅を調整"
            onPointerDown={handleSidebarResizeStart}
          />

          <div className="sidebarColumn">
            <EditorSidebar
              activeThreadId={activeThreadId}
              addReply={handleAddReply}
              autoRecommendLineDelta={aiAssistant.autoRecommendStatus?.lineDelta ?? null}
              cancelCreateComment={() => {
                setIsCreatingComment(false);
                setNewCommentBody("");
              }}
              commentThreads={commentThreads}
              editor={editor}
              isCreatingComment={isCreatingComment}
              newCommentBody={newCommentBody}
              previousRevision={previousRevision}
              replyBodies={replyBodies}
              remoteUserCount={remoteUsers.length}
              restoreRevision={restoreRevision}
              restoringRevisionId={restoringRevisionId}
              revisionSummaries={revisionSummaries}
              revisions={revisions}
              saveStatus={saveStatus}
              selectedRevision={selectedRevision}
              selectedRevisionId={selectedRevisionId}
              setActiveThreadId={setActiveThreadId}
              setNewCommentBody={setNewCommentBody}
              setReplyBody={(threadId, value) =>
                setReplyBodies((current) => ({
                  ...current,
                  [threadId]: value,
                }))
              }
              setSelectedRevisionId={setSelectedRevisionId}
              setShowResolvedComments={setShowResolvedComments}
              setSidebarTab={setSidebarTab}
              showResolvedComments={showResolvedComments}
              sidebarTab={sidebarTab}
              submitCreateComment={handleCreateComment}
              toggleResolveThread={(thread) =>
                thread.is_resolved ? handleUnresolveThread(thread.id) : handleResolveThread(thread.id)
              }
              version={version}
              aiSidebarProps={{ ...aiAssistant, handleJumpToSuggestion }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
