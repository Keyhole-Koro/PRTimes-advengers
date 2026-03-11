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
import { RemotePresence, setRemotePresence } from "../../editor/remotePresence";
import { useAiRecommendations } from "./application/useAiRecommendations";
import { useAiEditMemory } from "./application/useAiEditMemory";
import { useEditorSession } from "./application/useEditorSession";
import { usePendingAiSuggestions } from "./application/usePendingAiSuggestions";
import { useSaveStatus } from "./application/useSaveStatus";
import { useSidebarState } from "./application/useSidebarState";
import {
  BASE_URL,
  MARK_BUTTONS,
  buildPressReleaseQueryKey,
  buildPressReleaseRevisionsQueryKey,
  WS_BASE_URL,
} from "./constants";
import {
  createAiSuggestionDecorations,
  setActiveAiSuggestion,
  setAiSuggestions,
} from "./editor/tiptapExtensions/aiSuggestionDecorations";
import { LineHeight } from "./editor/tiptapExtensions/lineHeight";
import { withOperationText } from "./domain/pendingAiSuggestion";
import { openPressReleaseCollaborationSocket, parseRealtimeMessage, sendCollaborationMessage } from "./infrastructure/collaborationGateway";
import { RemovableImage } from "./editor/tiptapExtensions/removableImage";
import { EditorSidebar } from "./presentation/components/EditorSidebar";
import { EditorWorkspace } from "./presentation/components/EditorWorkspace";
import { useAssetActions } from "./hooks/useAssetActions";
import { useRevisionHistory } from "./hooks/useRevisionHistory";
import type {
  AgentDocumentEditSuggestion,
  MarkType,
  PendingAiSuggestion,
  PressRelease,
  ToolbarGroupConfig,
} from "./types";
import { applyAgentDocumentSuggestion, getSuggestedTitle } from "./utils/applyAgentDocumentEdit";
import { createCollaborationExtension, createRealtimeIdentity } from "./editor/tiptapAdapters/realtime";

function collectSuggestionOperationReasons(suggestion: AgentDocumentEditSuggestion): string[] {
  return suggestion.operations
    .map((operation) => operation.reason?.trim() ?? "")
    .filter((reason, index, array) => reason !== "" && array.indexOf(reason) === index);
}

function buildSuggestionTargetHint(suggestion: AgentDocumentEditSuggestion): string | undefined {
  const targetHints = suggestion.operations
    .map((operation) => {
      if (operation.op === "title_modify") {
        return "title";
      }
      if ("block_id" in operation && typeof operation.block_id === "string") {
        return operation.block_id;
      }
      if ("after_block_id" in operation && typeof operation.after_block_id === "string") {
        return operation.after_block_id;
      }
      return null;
    })
    .filter((value): value is string => value !== null);

  return targetHints.length > 0 ? Array.from(new Set(targetHints)).join(", ") : undefined;
}

function safeEditorHasFocus(editor: Editor): boolean {
  try {
    return editor.view.hasFocus();
  } catch {
    return false;
  }
}

export function PressReleaseEditorPage({
  pressReleaseId,
  title: initialTitle,
  content,
  version: initialVersion,
  onReturnToList,
}: PressRelease & { pressReleaseId: number; onReturnToList: () => void }) {
  const aiSuggestionStorageKey = `press-release-editor-ai-suggestions:${pressReleaseId}`;
  const aiEditMemoryStorageKey = `press-release-editor-ai-edit-memory:${pressReleaseId}`;
  const sidebarTabStorageKey = `press-release-editor-sidebar-tab:${pressReleaseId}`;
  const sidebarWidthStorageKey = `press-release-editor-sidebar-width:${pressReleaseId}`;
  const queryClient = useQueryClient();
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [identity] = useState(createRealtimeIdentity);
  const {
    editorResetToken,
    remoteUsers,
    session,
    setEditorResetToken,
    setRemoteUsers,
    setSession,
    setTitle,
    setVersion,
    title,
    version,
  } = useEditorSession(initialTitle, initialVersion);
  const { saveStatus, setSaveStatus } = useSaveStatus("saved");
  const [restoringRevisionId, setRestoringRevisionId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const lastSentBatchRef = useRef<string | null>(null);
  const requestFlushRef = useRef<() => void>(() => {});
  const lastEditorSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const lastEditorHadFocusRef = useRef(false);
  const { sidebarTab, sidebarWidth, setSidebarTab, setSidebarWidth } = useSidebarState({
    sidebarTabStorageKey,
    sidebarWidthStorageKey,
  });
  const {
    activeAiSuggestionId,
    pendingAiSuggestions,
    pendingAiSuggestionsRef,
    setActiveAiSuggestionId,
    setPendingAiSuggestions,
  } = usePendingAiSuggestions({
    storageKey: aiSuggestionStorageKey,
  });
  const { aiEditMemory, recordAiEditMemory } = useAiEditMemory({
    storageKey: aiEditMemoryStorageKey,
  });
  const [aiSuggestionExtension] = useState(() =>
    createAiSuggestionDecorations({
      onAcceptSuggestion: (suggestionId) => {
        const suggestion = pendingAiSuggestionsRef.current.find((entry) => entry.id === suggestionId);
        if (!suggestion || !editorRef.current) {
          return;
        }

        const nextTitle = getSuggestedTitle(suggestion.suggestion.operations);
        const nextContent = applyAgentDocumentSuggestion(editorRef.current.getJSON(), suggestion.suggestion);
        if (nextTitle !== null) {
          setTitle(nextTitle);
          sendTitleUpdate(nextTitle);
        }
        editorRef.current.commands.setContent(nextContent);
        recordAiEditMemory({
          decision: "accepted",
          prompt: suggestion.prompt,
          suggestionSummary: suggestion.suggestion.summary,
          suggestionReason: suggestion.suggestion.reason,
          operationReasons: collectSuggestionOperationReasons(suggestion.suggestion),
          targetHint: buildSuggestionTargetHint(suggestion.suggestion),
        });
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

        const nextTitle = getSuggestedTitle(partialSuggestion.operations);
        const nextContent = applyAgentDocumentSuggestion(editorRef.current.getJSON(), partialSuggestion);
        if (nextTitle !== null) {
          setTitle(nextTitle);
          sendTitleUpdate(nextTitle);
        }
        editorRef.current.commands.setContent(nextContent);
        recordAiEditMemory({
          decision: "accepted",
          prompt: suggestion.prompt,
          suggestionSummary: partialSuggestion.summary,
          suggestionReason: partialSuggestion.reason,
          operationReasons: collectSuggestionOperationReasons(partialSuggestion),
          targetHint: buildSuggestionTargetHint(partialSuggestion),
        });
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
        const suggestion = pendingAiSuggestionsRef.current.find((entry) => entry.id === suggestionId);
        if (suggestion) {
          recordAiEditMemory({
            decision: "dismissed",
            prompt: suggestion.prompt,
            suggestionSummary: suggestion.suggestion.summary,
            suggestionReason: suggestion.suggestion.reason,
            operationReasons: collectSuggestionOperationReasons(suggestion.suggestion),
            targetHint: buildSuggestionTargetHint(suggestion.suggestion),
          });
        }
        setPendingAiSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
        setActiveAiSuggestionId((current) => (current === suggestionId ? null : current));
      },
      onDiscardSuggestionOperation: (suggestionId, operationIndex) => {
        const suggestion = pendingAiSuggestionsRef.current.find((entry) => entry.id === suggestionId);
        const operation = suggestion?.suggestion.operations[operationIndex];
        if (suggestion && operation) {
          const partialSuggestion: AgentDocumentEditSuggestion = {
            ...suggestion.suggestion,
            operations: [operation],
          };
          recordAiEditMemory({
            decision: "dismissed",
            prompt: suggestion.prompt,
            suggestionSummary: partialSuggestion.summary,
            suggestionReason: partialSuggestion.reason,
            operationReasons: collectSuggestionOperationReasons(partialSuggestion),
            targetHint: buildSuggestionTargetHint(partialSuggestion),
          });
        }
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
            LineHeight,
            RemovableImage,
            aiSuggestionExtension,
            LinkCard,
            RemotePresence,
            CommentHighlight,
            createCollaborationExtension(session.revision, session.clientId),
          ]
        : [StarterKit, LineHeight, RemovableImage, aiSuggestionExtension, LinkCard, RemotePresence, CommentHighlight],
      immediatelyRender: false,
    },
    [session?.clientId, session?.revision, editorResetToken],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const preserveEditorViewportState = (currentEditor: Editor, applyUpdate: () => void) => {
    const scrollContainer = currentEditor.view.dom as HTMLElement;
    const hadFocus = safeEditorHasFocus(currentEditor);
    const { from, to } = currentEditor.state.selection;
    const scrollTop = scrollContainer.scrollTop;
    const scrollLeft = scrollContainer.scrollLeft;

    applyUpdate();

    window.requestAnimationFrame(() => {
      try {
        if (hadFocus) {
          currentEditor.chain().focus().setTextSelection({ from, to }).run();
        }
      } catch {
        if (hadFocus) {
          currentEditor.view.focus();
        }
      } finally {
        scrollContainer.scrollTop = scrollTop;
        scrollContainer.scrollLeft = scrollLeft;
      }
    });
  };

  const restoreEditorSelectionAfterSave = (currentEditor: Editor) => {
    const selection = lastEditorSelectionRef.current;
    if (!selection || !lastEditorHadFocusRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      try {
        currentEditor.chain().focus().setTextSelection(selection).run();
      } catch {
        currentEditor.view.focus();
      }
    });
  };

  useEffect(() => {
    if (!editor) {
      return;
    }

    preserveEditorViewportState(editor, () => {
      setAiSuggestions(editor, pendingAiSuggestions);
    });
  }, [editor, pendingAiSuggestions]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    preserveEditorViewportState(editor, () => {
      setActiveAiSuggestion(editor, activeAiSuggestionId);
    });
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
    sendCollaborationMessage(websocket, {
      content: currentEditor.getJSON(),
      steps: pending.steps.map((step) => step.toJSON()),
      type: "document.steps",
      version: pending.version,
    });
  };

  const markState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      underline: currentEditor?.isActive("underline") ?? false,
      lineHeight:
        typeof currentEditor?.state.selection.$from.parent.attrs.lineHeight === "string"
          ? currentEditor.state.selection.$from.parent.attrs.lineHeight
          : "",
    }),
  });

  const {
    previousRevision,
    revisions,
    revisionSummaries,
    selectedRevision,
    selectedRevisionId,
    setSelectedRevisionId,
  } = useRevisionHistory(pressReleaseId);

  useEffect(() => {
    const params = new URLSearchParams({
      color: identity.color,
      name: identity.name,
      userId: identity.userId,
    });

    const websocket = openPressReleaseCollaborationSocket(
      `${WS_BASE_URL}/ws/press-releases/${pressReleaseId}?${params.toString()}`,
    );
    websocketRef.current = websocket;

    websocket.addEventListener("message", (event) => {
      const message = parseRealtimeMessage(String(event.data));

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
        if (editorRef.current) {
          restoreEditorSelectionAfterSave(editorRef.current);
        }
        void queryClient.invalidateQueries({ queryKey: buildPressReleaseQueryKey(pressReleaseId) });
        void queryClient.invalidateQueries({ queryKey: buildPressReleaseRevisionsQueryKey(pressReleaseId) });
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
  }, [identity, pressReleaseId, queryClient]);

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
      lastEditorSelectionRef.current = {
        from: selection.from,
        to: selection.to,
      };
      lastEditorHadFocusRef.current = safeEditorHasFocus(editor);
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

      lastEditorSelectionRef.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
      lastEditorHadFocusRef.current = safeEditorHasFocus(editor);

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
    sendCollaborationMessage(websocket, { type: "document.flush" });
  };

  requestFlushRef.current = requestFlush;

  const sendTitleUpdate = (nextTitle: string) => {
    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    sendCollaborationMessage(websocket, {
      title: nextTitle,
      type: "title.update",
    });
  };

  const restoreRevision = async (revisionId: number) => {
    setRestoringRevisionId(revisionId);
    setSaveStatus("saving");

    try {
      const response = await fetch(`${BASE_URL}/press-releases/${pressReleaseId}/revisions/${revisionId}/restore`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("変更履歴の復元に失敗しました");
      }

      await queryClient.invalidateQueries({ queryKey: buildPressReleaseQueryKey(pressReleaseId) });
      await queryClient.invalidateQueries({ queryKey: buildPressReleaseRevisionsQueryKey(pressReleaseId) });
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

  const { aiAssistant, handleJumpToSuggestion } = useAiRecommendations({
    aiEditMemory,
    editor,
    pendingAiSuggestionsRef,
    pressReleaseId,
    setActiveAiSuggestionId,
    setPendingAiSuggestions,
    title,
  });

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

  const setLineHeight = (lineHeight: string) => {
    const nextValue = lineHeight === "" ? null : lineHeight;
    editor.chain().focus().setLineHeight(nextValue).run();
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
          key: "line-height-select",
          label: "行間",
          tooltip: "行間",
          type: "select",
          value: markState?.lineHeight ?? "",
          options: [
            { label: "既定", value: "" },
            { label: "1.2", value: "1.2" },
            { label: "1.3", value: "1.3" },
            { label: "1.4", value: "1.4" },
            { label: "1.5", value: "1.5" },
            { label: "1.6", value: "1.6" },
            { label: "1.7", value: "1.7" },
            { label: "1.8", value: "1.8" },
            { label: "2.0", value: "2.0" },
          ],
          onChange: (value) => setLineHeight(value),
        },
      ],
      label: "行間",
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
            aiSettingSuggestions={aiAssistant.aiSettingSuggestions}
            aiSettings={aiAssistant.aiSettings}
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
            onReturnToList={onReturnToList}
            pressReleaseId={pressReleaseId}
            setAiSettingText={aiAssistant.setAiSettingText}
            title={title}
            toggleAiSettingListValue={aiAssistant.toggleAiSettingListValue}
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
              autoRecommendDiffSize={aiAssistant.autoRecommendStatus?.diffSize ?? null}
              previousRevision={previousRevision}
              remoteUserCount={remoteUsers.length}
              restoreRevision={restoreRevision}
              restoringRevisionId={restoringRevisionId}
              revisionSummaries={revisionSummaries}
              revisions={revisions}
              saveStatus={saveStatus}
              selectedRevision={selectedRevision}
              selectedRevisionId={selectedRevisionId}
              setSelectedRevisionId={setSelectedRevisionId}
              setSidebarTab={setSidebarTab}
              sidebarTab={sidebarTab}
              version={version}
              aiSidebarProps={{
                activeAiMessages: aiAssistant.activeAiMessages,
                activeAiThread: aiAssistant.activeAiThread,
                activeAiThreadId: aiAssistant.activeAiThreadId,
                aiAttachmentError: aiAssistant.aiAttachmentError,
                aiMessagesContainerRef: aiAssistant.aiMessagesContainerRef,
                aiMessagesEndRef: aiAssistant.aiMessagesEndRef,
                aiPrompt: aiAssistant.aiPrompt,
                aiThreadMenuOpenId: aiAssistant.aiThreadMenuOpenId,
                aiThreads: aiAssistant.aiThreads,
                composerAttachments: aiAssistant.composerAttachments,
                handleAiMixedFileChange: aiAssistant.handleAiMixedFileChange,
                handleAiGeneralFileChange: aiAssistant.handleAiGeneralFileChange,
                handleAiEcho: aiAssistant.handleAiEcho,
                handleAiImageFileChange: aiAssistant.handleAiImageFileChange,
                handleAiInputPaste: aiAssistant.handleAiInputPaste,
                handleAiInputKeyDown: aiAssistant.handleAiInputKeyDown,
                handleJumpToSuggestion,
                handleClearAiComposer: aiAssistant.handleClearAiComposer,
                handleCreateAiThread: aiAssistant.handleCreateAiThread,
                handleDeleteAiThread: aiAssistant.handleDeleteAiThread,
                handleRenameAiThread: aiAssistant.handleRenameAiThread,
                isAiHistoryOpen: aiAssistant.isAiHistoryOpen,
                isAiAttachMenuOpen: aiAssistant.isAiAttachMenuOpen,
                isAiResponding: aiAssistant.isAiResponding,
                removeComposerAttachment: aiAssistant.removeComposerAttachment,
                respondingAiThreadId: aiAssistant.respondingAiThreadId,
                setActiveAiThreadId: aiAssistant.setActiveAiThreadId,
                setAiPrompt: aiAssistant.setAiPrompt,
                setIsAiAttachMenuOpen: aiAssistant.setIsAiAttachMenuOpen,
                setAiThreadMenuOpenId: aiAssistant.setAiThreadMenuOpenId,
                setIsAiHistoryOpen: aiAssistant.setIsAiHistoryOpen,
              }}
              aiSettingsSidebarProps={{
                aiSettings: aiAssistant.aiSettings,
                resetAiSettings: aiAssistant.resetAiSettings,
                setAiSettingText: aiAssistant.setAiSettingText,
                toggleAiSettingListValue: aiAssistant.toggleAiSettingListValue,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
