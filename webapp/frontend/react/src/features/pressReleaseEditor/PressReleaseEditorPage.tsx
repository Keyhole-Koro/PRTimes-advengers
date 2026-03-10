import { useQueryClient } from "@tanstack/react-query";
import Underline from "@tiptap/extension-underline";
import { receiveTransaction, sendableSteps } from "@tiptap/pm/collab";
import { Step } from "@tiptap/pm/transform";
import { type Editor, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import "../../App.css";
import { CommentHighlight } from "../../editor/commentHighlight";
import { LinkCard } from "../../editor/linkCard";
import type { PresenceUser } from "../../editor/remotePresence";
import { RemotePresence, setRemotePresence } from "../../editor/remotePresence";
import { EditorHeader } from "./components/EditorHeader";
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
  MarkType,
  PendingAiSuggestion,
  PressRelease,
  RealtimeMessage,
  SaveStatus,
  SessionState,
  SidebarTab,
  ToolbarGroupConfig,
} from "./types";
import { applyAgentDocumentEdit } from "./utils/applyAgentDocumentEdit";
import { createCollaborationExtension, createRealtimeIdentity } from "./utils/realtime";

export function PressReleaseEditorPage({
  title: initialTitle,
  content,
  version: initialVersion,
}: PressRelease) {
  const aiSuggestionStorageKey = `press-release-editor-ai-suggestions:${PRESS_RELEASE_ID}`;
  const sidebarTabStorageKey = `press-release-editor-sidebar-tab:${PRESS_RELEASE_ID}`;
  const queryClient = useQueryClient();
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
      return Array.isArray(parsed) ? (parsed as PendingAiSuggestion[]) : [];
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

        const nextContent = applyAgentDocumentEdit(editorRef.current.getJSON(), suggestion.result);
        editorRef.current.commands.setContent(nextContent);
        setPendingAiSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
        setActiveAiSuggestionId(null);
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
    }),
  );

  const editor = useEditor(
    {
      content: session?.snapshot.content ?? content,
      editable: Boolean(session),
      extensions: session
        ? [
            StarterKit,
            Underline,
            RemovableImage,
            aiSuggestionExtension,
            LinkCard,
            RemotePresence,
            CommentHighlight,
            createCollaborationExtension(session.revision, session.clientId),
          ]
        : [StarterKit, Underline, RemovableImage, aiSuggestionExtension, LinkCard, RemotePresence, CommentHighlight],
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
    imageUrl,
    isDraggingImage,
    isFetchingLinkPreview,
    isUploadingImage,
    linkUrl,
    setImageUrl,
    setLinkUrl,
    uploadActions: {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleInsertImage,
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
    setPendingAiSuggestions((current) => [...current, { id: suggestionId, prompt, result }]);
    setActiveAiSuggestionId(suggestionId);
  };

  const aiAssistant = useAiAssistant({ editor, onCreateDocumentSuggestion: handleCreateAiSuggestion, title });

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
          onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          isActive: editor.isActive("heading", { level: 2 }),
          key: "heading-2",
          label: "H2",
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
          key: "html-import",
          label: "HTMLをインポート",
          onClick: handlePickHtml,
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
  ];

  return (
    <div className="container">
      <main className="main">
        <div className="workspace">
          <EditorWorkspace
            editor={editor}
            fileInputRef={fileInputRef}
            handleDragEnter={handleDragEnter}
            handleDragLeave={handleDragLeave}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleImageSelected={handleImageSelected}
            handleImportHtml={handleImportHtml}
            handleInsertImage={handleInsertImage}
            handleInsertLinkCard={handleInsertLinkCard}
            handlePickImage={handlePickImage}
            htmlInputRef={htmlInputRef}
            imageUrl={imageUrl}
            isDraggingImage={isDraggingImage}
            isFetchingLinkPreview={isFetchingLinkPreview}
            isUploadingImage={isUploadingImage}
            linkUrl={linkUrl}
            onTitleChange={handleTitleChange}
            setImageUrl={setImageUrl}
            setLinkUrl={setLinkUrl}
            title={title}
            toolbarGroups={toolbarGroups}
          />

          <div className="sidebarColumn">
            <EditorHeader
              identityColor={identity.color}
              identityName={identity.name}
              remoteUsers={remoteUsers}
              saveStatus={saveStatus}
              version={version}
            />

            <EditorSidebar
              activeThreadId={activeThreadId}
              addReply={handleAddReply}
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
              restoreRevision={restoreRevision}
              restoringRevisionId={restoringRevisionId}
              revisionSummaries={revisionSummaries}
              revisions={revisions}
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
              aiSidebarProps={aiAssistant}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
