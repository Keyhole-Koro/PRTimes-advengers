import { useQueryClient } from "@tanstack/react-query";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { receiveTransaction, sendableSteps } from "@tiptap/pm/collab";
import { Step } from "@tiptap/pm/transform";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { CSSProperties, ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { CommentHighlight } from "./editor/commentHighlight";
import { LinkCard } from "./editor/linkCard";
import type { PresenceUser } from "./editor/remotePresence";
import { RemotePresence, setRemotePresence } from "./editor/remotePresence";
import { CommentsSidebar } from "./features/pressReleaseEditor/components/CommentsSidebar";
import { HistorySidebar } from "./features/pressReleaseEditor/components/HistorySidebar";
import { ToolbarButton } from "./features/pressReleaseEditor/components/ToolbarButton";
import {
  BASE_URL,
  EMPTY_CONTENT,
  MARK_BUTTONS,
  PRESS_RELEASE_ID,
  QUERY_KEY,
  REVISIONS_QUERY_KEY,
  WS_BASE_URL,
} from "./features/pressReleaseEditor/constants";
import { usePressReleaseQuery, usePressReleaseRevisionsQuery } from "./features/pressReleaseEditor/hooks/usePressReleaseQueries";
import { MOCK_TEMPLATES } from "./features/pressReleaseEditor/mockTemplates";
import type {
  CommentThreadResponse,
  FileWithRelativePath,
  LinkPreviewResponse,
  MarkType,
  PressRelease,
  PressReleaseTemplateResponse,
  RealtimeMessage,
  SaveStatus,
  SessionState,
  SidebarTab,
  ToolbarGroupConfig,
} from "./features/pressReleaseEditor/types";
import { buildRevisionDiffSummary } from "./features/pressReleaseEditor/utils/diff";
import {
  createCollaborationExtension,
  createRealtimeIdentity,
} from "./features/pressReleaseEditor/utils/realtime";

function isImageFile(file: FileWithRelativePath): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}

function normalizePathKey(path: string): string {
  return decodeURIComponent(path)
    .trim()
    .split("?")[0]
    .split("#")[0]
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type AiChatThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiChatMessage[];
};

const AI_CHAT_STORAGE_KEY = "press-release-editor-ai-chat";
const AI_DEFAULT_THREAD_TITLE = "新しいチャット";
function createAiThread(title = AI_DEFAULT_THREAD_TITLE): AiChatThread {
  return {
    id: globalThis.crypto.randomUUID(),
    title,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function createAiMessage(role: AiChatMessage["role"], text: string): AiChatMessage {
  return {
    id: globalThis.crypto.randomUUID(),
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

function buildThreadTitle(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return AI_DEFAULT_THREAD_TITLE;
  }
  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
}

function isValidAiMessage(value: unknown): value is AiChatMessage {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const message = value as Partial<AiChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string" &&
    typeof message.createdAt === "string"
  );
}

function isValidAiThread(value: unknown): value is AiChatThread {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const thread = value as Partial<AiChatThread>;
  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    typeof thread.updatedAt === "string" &&
    Array.isArray(thread.messages) &&
    thread.messages.every(isValidAiMessage)
  );
}

function parseStoredAiThreads(rawValue: string | null): AiChatThread[] {
  if (!rawValue) {
    return [createAiThread()];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [createAiThread()];
    }

    // Migration for old format: message array only
    if (parsed.length > 0 && parsed.every(isValidAiMessage)) {
      const legacyMessages = parsed as AiChatMessage[];
      return [
        {
          ...createAiThread(buildThreadTitle(legacyMessages[0]?.text ?? "")),
          updatedAt: legacyMessages[legacyMessages.length - 1]?.createdAt ?? new Date().toISOString(),
          messages: legacyMessages,
        },
      ];
    }

    const threads = parsed.filter(isValidAiThread);
    return threads.length > 0 ? threads : [createAiThread()];
  } catch {
    return [createAiThread()];
  }
}

function formatMessageTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatThreadTime(isoString: string): string {
  return new Date(isoString).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function App() {
  const { data, isPending, isError, error } = usePressReleaseQuery();
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

  return <Page title={data.title} content={data.content ?? EMPTY_CONTENT} version={data.version} />;
}

function Page({ title: initialTitle, content, version: initialVersion }: PressRelease) {
  const queryClient = useQueryClient();
  const [identity] = useState(createRealtimeIdentity);
  const [title, setTitle] = useState(() => initialTitle);
  const [version, setVersion] = useState(() => initialVersion);
  const [session, setSession] = useState<SessionState | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<PresenceUser[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [editorResetToken, setEditorResetToken] = useState(0);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<PressReleaseTemplateResponse[]>(MOCK_TEMPLATES);
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("history");
  const [commentThreads, setCommentThreads] = useState<CommentThreadResponse[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [showResolvedComments, setShowResolvedComments] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyBodies, setReplyBodies] = useState<Record<number, string>>({});
  const [isCreatingComment, setIsCreatingComment] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiThreads, setAiThreads] = useState<AiChatThread[]>(() => {
    if (typeof window === "undefined") {
      return [createAiThread()];
    }
    return parseStoredAiThreads(window.localStorage.getItem(AI_CHAT_STORAGE_KEY));
  });
  const [activeAiThreadId, setActiveAiThreadId] = useState<string>(() => aiThreads[0]?.id ?? createAiThread().id);
  const [respondingAiThreadId, setRespondingAiThreadId] = useState<string | null>(null);
  const [aiThreadMenuOpenId, setAiThreadMenuOpenId] = useState<string | null>(null);
  const [isAiHistoryOpen, setIsAiHistoryOpen] = useState(false);
  const isAiResponding = respondingAiThreadId !== null;
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const dragDepthRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const lastSentBatchRef = useRef<string | null>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: Boolean(session),
      extensions: session
        ? [
            StarterKit,
            Underline,
            Image,
            LinkCard,
            RemotePresence,
            CommentHighlight,
            createCollaborationExtension(session.revision, session.clientId),
          ]
        : [StarterKit, Underline, Image, LinkCard, RemotePresence, CommentHighlight],
      content: session?.snapshot.content ?? content,
    },
    [session?.clientId, session?.revision, editorResetToken],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const sendPendingSteps = (currentEditor: NonNullable<typeof editor>) => {
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
        type: "document.steps",
        version: pending.version,
        steps: pending.steps.map((step) => step.toJSON()),
        content: currentEditor.getJSON(),
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

  const { data: revisions = [] } = usePressReleaseRevisionsQuery();
  useEffect(() => {
    if (revisions.length === 0) {
      return;
    }

    setSelectedRevisionId((current) =>
      current && revisions.some((revision) => revision.id === current) ? current : revisions[0].id,
    );
  }, [revisions]);

  useEffect(() => {
    const params = new URLSearchParams({
      userId: identity.userId,
      name: identity.name,
      color: identity.color,
    });

    const websocket = new WebSocket(`${WS_BASE_URL}/ws/press-releases/${PRESS_RELEASE_ID}?${params.toString()}`);
    websocketRef.current = websocket;

    websocket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as RealtimeMessage;

      if (message.type === "session.ready") {
        setSession({
          clientId: message.clientId,
          snapshot: message.snapshot,
          revision: message.revision,
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
                snapshot: message.snapshot,
                revision: message.revision,
              }
            : null,
        );
        lastSentBatchRef.current = null;
        setEditorResetToken((current) => current + 1);
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
          type: "presence.update",
          userId: identity.userId,
          name: identity.name,
          color: identity.color,
          selection: {
            from: selection.from,
            to: selection.to,
          },
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

    const handleSelectionUpdate = () => {
      sendPresenceUpdate();
    };

    editor.on("transaction", handleTransaction);
    editor.on("selectionUpdate", handleSelectionUpdate);
    sendPresenceUpdate();

    return () => {
      editor.off("transaction", handleTransaction);
      editor.off("selectionUpdate", handleSelectionUpdate);
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

  const sendTitleUpdate = (nextTitle: string) => {
    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    websocket.send(
      JSON.stringify({
        type: "title.update",
        title: nextTitle,
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

  const saveCurrentAsTemplate = async () => {
    if (!editor) {
      return;
    }

    const trimmedName = templateName.trim();
    if (!trimmedName) {
      alert("テンプレート名を入力してください");
      return;
    }

    setIsSavingTemplate(true);
    try {
      const timestamp = new Date().toLocaleString("ja-JP");
      setTemplates((current) => [
        {
          id: Date.now(),
          name: trimmedName,
          title,
          content: editor.getJSON(),
          created_at: timestamp,
          updated_at: timestamp,
        },
        ...current,
      ]);
      setTemplateName("");
    } catch (templateError) {
      const message = templateError instanceof Error ? templateError.message : "テンプレートの保存に失敗しました";
      alert(message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const applyTemplate = async (templateId: number) => {
    if (!editor) {
      return;
    }

    setApplyingTemplateId(templateId);
    try {
      const template = templates.find((item) => item.id === templateId);
      if (!template) {
        throw new Error("テンプレートが見つかりません");
      }

      setTitle(template.title);
      sendTitleUpdate(template.title);
      editor.commands.setContent(template.content);
      setSaveStatus("dirty");
      requestFlush();
    } catch (templateError) {
      const message = templateError instanceof Error ? templateError.message : "テンプレートの適用に失敗しました";
      alert(message);
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/uploads/images`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("画像のアップロードに失敗しました");
    }

    return (await response.json()) as { url: string };
  };

  const fetchLinkPreview = async (url: string) => {
    const response = await fetch(`${BASE_URL}/link-previews?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error("リンク先のOGP情報を取得できませんでした");
    }

    return (await response.json()) as LinkPreviewResponse;
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handlePickHtml = () => {
    htmlInputRef.current?.click();
  };

  const flushAfterImageChange = () => {
    window.setTimeout(() => {
      requestFlush();
    }, 0);
  };

  const handleInsertImage = async () => {
    if (!editor) {
      return;
    }

    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) {
      alert("画像URLを入力してください");
      return;
    }

    editor.chain().focus().setImage({ src: trimmedUrl, alt: "挿入画像" }).run();
    setImageUrl("");
    flushAfterImageChange();
  };

  const handleInsertLinkCard = async () => {
    if (!editor) {
      return;
    }

    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      alert("URLを入力してください");
      return;
    }

    setIsFetchingLinkPreview(true);

    try {
      const preview = await fetchLinkPreview(trimmedUrl);
      editor
        .chain()
        .focus()
        .insertContent({
          type: "linkCard",
          attrs: preview,
        })
        .run();
      setLinkUrl("");
      flushAfterImageChange();
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : "リンクカードを追加できませんでした";
      alert(message);
    } finally {
      setIsFetchingLinkPreview(false);
    }
  };

  const insertUploadedImage = async (file: File) => {
    if (!editor) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください");
      return;
    }

    setIsUploadingImage(true);

    try {
      const { url } = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name || "アップロード画像" }).run();
      flushAfterImageChange();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "画像アップロードに失敗しました";
      alert(message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await insertUploadedImage(file);
    }

    event.target.value = "";
  };

  const buildFileFromDataUrl = async (dataUrl: string, fallbackName: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const ext = blob.type.split("/")[1] || "png";
    return new File([blob], `${fallbackName}.${ext}`, { type: blob.type || "image/png" });
  };

  const handleImportHtml = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []) as FileWithRelativePath[];
    if (selectedFiles.length === 0 || !editor) {
      return;
    }

    try {
      const htmlFile = selectedFiles.find(
        (file) => file.type === "text/html" || file.name.toLowerCase().endsWith(".html"),
      );
      if (!htmlFile) {
        alert("HTMLファイルを選択してください");
        return;
      }

      const imageFileMap = new Map<string, File>();
      const selectedImageFiles: File[] = [];
      for (const file of selectedFiles) {
        if (!isImageFile(file)) {
          continue;
        }
        selectedImageFiles.push(file);
        imageFileMap.set(normalizePathKey(file.name), file);
        if (file.webkitRelativePath) {
          imageFileMap.set(normalizePathKey(file.webkitRelativePath), file);
        }
      }

      const htmlText = await htmlFile.text();
      const doc = new DOMParser().parseFromString(htmlText, "text/html");
      const skippedImageSrcList: string[] = [];
      const usedImageNames = new Set<string>();
      const images = Array.from(doc.querySelectorAll("img"));

      for (const [index, img] of images.entries()) {
        const src = img.getAttribute("src")?.trim();
        if (!src) {
          continue;
        }

        try {
          let uploadedUrl = "";

          if (src.startsWith("data:")) {
            const dataFile = await buildFileFromDataUrl(src, `imported-image-${index + 1}`);
            const uploaded = await uploadImage(dataFile);
            uploadedUrl = uploaded.url;
          } else if (/^https?:\/\//i.test(src)) {
            const fetchedImage = await fetch(src);
            if (!fetchedImage.ok) {
              throw new Error("画像の取得に失敗しました");
            }
            const blob = await fetchedImage.blob();
            const ext = blob.type.split("/")[1] || "png";
            const httpFile = new File([blob], `imported-image-${index + 1}.${ext}`, {
              type: blob.type || "image/png",
            });
            const uploaded = await uploadImage(httpFile);
            uploadedUrl = uploaded.url;
          } else {
            const normalizedSrc = normalizePathKey(src);
            const srcName = normalizedSrc.split("/").pop() ?? normalizedSrc;
            let localImageFile = imageFileMap.get(normalizedSrc) ?? imageFileMap.get(srcName);

            if (!localImageFile) {
              localImageFile = selectedImageFiles.find((f) => !usedImageNames.has(f.name));
            }

            if (!localImageFile) {
              skippedImageSrcList.push(src);
              continue;
            }

            usedImageNames.add(localImageFile.name);
            const uploaded = await uploadImage(localImageFile);
            uploadedUrl = uploaded.url;
          }

          img.setAttribute("src", uploadedUrl);
        } catch {
          skippedImageSrcList.push(src);
        }
      }

      const importedTitle =
        doc.querySelector("title")?.textContent?.trim() || doc.querySelector("h1")?.textContent?.trim() || title;
      const bodyHtml = doc.body?.innerHTML?.trim() || "<p></p>";

      setTitle(importedTitle);
      editor.commands.setContent(bodyHtml);
      setSaveStatus("dirty");
      flushAfterImageChange();

      if (skippedImageSrcList.length > 0) {
        alert(`取り込めなかった画像: ${skippedImageSrcList.join(", ")}`);
      }
    } catch {
      alert("HTMLの読み込みに失敗しました");
    } finally {
      event.target.value = "";
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }

    dragDepthRef.current += 1;
    setIsDraggingImage(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingImage(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingImage(false);

    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await insertUploadedImage(file);
    }
  };

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
    if (!editor || newCommentBody.trim() === "") return;

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
          quote,
          body: newCommentBody.trim(),
          createdBy: identity.name,
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
        setSidebarTab("comments");
        requestFlush();
        await fetchComments();
      }
    } catch {
      alert("コメントの作成に失敗しました");
    }
  };

  const handleAddReply = async (threadId: number) => {
    const body = replyBodies[threadId]?.trim();
    if (!body) return;

    try {
      const response = await fetch(`${BASE_URL}/comments/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, createdBy: identity.name }),
      });

      if (response.ok) {
        setReplyBodies((prev) => ({ ...prev, [threadId]: "" }));
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

  const handleStartComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      alert("テキストを選択してからコメントを追加してください");
      return;
    }
    setIsCreatingComment(true);
    setSidebarTab("comments");
  };

  const handleClickCommentMark = () => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const resolved = editor.state.doc.resolve(from);
    const marks = resolved.marks();
    const commentMark = marks.find((mark) => mark.type.name === "commentHighlight");
    if (commentMark?.attrs.threadId) {
      setActiveThreadId(commentMark.attrs.threadId as number);
      setSidebarTab("comments");
    }
  };

  // Detect comment mark click on selection change
  useEffect(() => {
    if (!editor || !session) return;

    const onSelectionUpdate = () => {
      handleClickCommentMark();
    };

    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor, session, commentThreads]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(aiThreads));
  }, [aiThreads]);

  useEffect(() => {
    if (!aiThreads.some((thread) => thread.id === activeAiThreadId)) {
      setActiveAiThreadId(aiThreads[0]?.id ?? "");
    }
  }, [aiThreads, activeAiThreadId]);

  const activeAiThread = aiThreads.find((thread) => thread.id === activeAiThreadId) ?? aiThreads[0] ?? null;
  const activeAiMessages = activeAiThread?.messages ?? [];

  useEffect(() => {
    if (sidebarTab !== "ai") {
      return;
    }
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeAiMessages, sidebarTab]);

  const updateThreadMessages = (threadId: string, message: AiChatMessage) => {
    setAiThreads((current) => {
      const next = current.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        const shouldUpdateTitle =
          thread.messages.length === 0 &&
          thread.title === AI_DEFAULT_THREAD_TITLE &&
          message.role === "user";

        return {
          ...thread,
          title: shouldUpdateTitle ? buildThreadTitle(message.text) : thread.title,
          updatedAt: message.createdAt,
          messages: [...thread.messages, message],
        };
      });

      return [...next].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  };

  const handleAiEcho = () => {
    if (!activeAiThread) {
      return;
    }

    const normalizedPrompt = aiPrompt.trim();
    if (!normalizedPrompt || respondingAiThreadId !== null) {
      return;
    }

    const threadId = activeAiThread.id;
    const userMessage = createAiMessage("user", normalizedPrompt);
    updateThreadMessages(threadId, userMessage);

    setAiPrompt("");
    setRespondingAiThreadId(threadId);

    window.setTimeout(() => {
      const assistantMessage = createAiMessage("assistant", normalizedPrompt);
      updateThreadMessages(threadId, assistantMessage);
      setRespondingAiThreadId((current) => (current === threadId ? null : current));
    }, 250);
  };

  const handleAiInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleAiEcho();
    }
  };

  const handleCreateAiThread = () => {
    const newThread = createAiThread();
    setAiThreads((current) => [newThread, ...current]);
    setActiveAiThreadId(newThread.id);
    setAiPrompt("");
    setAiThreadMenuOpenId(null);
    setIsAiHistoryOpen(true);
  };

  const handleRenameAiThread = (thread: AiChatThread) => {
    const nextTitle = window.prompt("チャット名を入力してください", thread.title);
    if (!nextTitle || nextTitle.trim() === "") {
      setAiThreadMenuOpenId(null);
      return;
    }

    const normalizedTitle = nextTitle.trim().slice(0, 40);
    setAiThreads((current) =>
      current.map((item) =>
        item.id === thread.id
          ? {
              ...item,
              title: normalizedTitle,
            }
          : item,
      ),
    );
    setAiThreadMenuOpenId(null);
  };

  const handleDeleteAiThread = (thread: AiChatThread) => {
    if (!window.confirm(`「${thread.title}」を削除しますか？`)) {
      setAiThreadMenuOpenId(null);
      return;
    }

    const filteredThreads = aiThreads.filter((item) => item.id !== thread.id);
    const nextThreads = filteredThreads.length > 0 ? filteredThreads : [createAiThread()];
    setAiThreads(nextThreads);

    if (!nextThreads.some((item) => item.id === activeAiThreadId)) {
      setActiveAiThreadId(nextThreads[0].id);
    }

    if (respondingAiThreadId === thread.id) {
      setRespondingAiThreadId(null);
    }

    setAiThreadMenuOpenId(null);
  };

  if (!editor || !session) {
    return (
      <div className="container">
        <div className="loadingState">共同編集セッションを接続しています...</div>
      </div>
    );
  }

  const selectedRevision =
    revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions[0] ?? null;
  const selectedRevisionIndex = selectedRevision
    ? revisions.findIndex((revision) => revision.id === selectedRevision.id)
    : -1;
  const previousRevision =
    selectedRevisionIndex >= 0 && selectedRevisionIndex < revisions.length - 1
      ? revisions[selectedRevisionIndex + 1]
      : null;
  const revisionSummaries = Object.fromEntries(
    revisions.map((revision) => [revision.id, buildRevisionDiffSummary(revisions, revision.id)]),
  );

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
      label: "書式",
      buttons: MARK_BUTTONS.map((button) => ({
        key: button.key,
        label: button.label,
        isActive: markState?.[button.key] ?? false,
        onClick: () => toggleMark(button.key),
      })),
    },
    {
      label: "見出し",
      buttons: [
        {
          key: "paragraph",
          label: "本文",
          isActive: editor.isActive("paragraph"),
          onClick: () => editor.chain().focus().setParagraph().run(),
        },
        {
          key: "heading-1",
          label: "H1",
          isActive: editor.isActive("heading", { level: 1 }),
          onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          key: "heading-2",
          label: "H2",
          isActive: editor.isActive("heading", { level: 2 }),
          onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
      ],
    },
    {
      label: "リスト",
      buttons: [
        {
          key: "bullet-list",
          label: "箇条書き",
          isActive: editor.isActive("bulletList"),
          onClick: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          key: "ordered-list",
          label: "番号付き",
          isActive: editor.isActive("orderedList"),
          onClick: () => editor.chain().focus().toggleOrderedList().run(),
        },
      ],
    },
    {
      label: "画像",
      buttons: [
        {
          key: "image-upload",
          label: "画像を追加",
          isActive: false,
          onClick: handlePickImage,
        },
        {
          key: "html-import",
          label: "HTMLをインポート",
          isActive: false,
          onClick: handlePickHtml,
        },
      ],
    },
    {
      label: "コメント",
      buttons: [
        {
          key: "add-comment",
          label: "コメント追加",
          isActive: isCreatingComment,
          onClick: handleStartComment,
        },
      ],
    },
  ];

  return (
    <div className="container">
      <header className="header">
        <div className="titleBlock">
          <h1 className="title">プレスリリースエディター</h1>
          <div className="metaRow">
            <span className={`saveStatus saveStatus-${saveStatus}`} aria-live="polite">
              {saveStatus === "saving" && "保存中..."}
              {saveStatus === "saved" && `保存済み v${version}`}
              {saveStatus === "dirty" && "共同編集中"}
              {saveStatus === "error" && "接続または保存に失敗しました"}
            </span>
            <span>{`編集中 ${remoteUsers.length + 1}人`}</span>
          </div>
          <div className="presenceList" aria-label="接続中の編集者">
            <span className="presenceChip is-self" style={{ "--presence-color": identity.color } as CSSProperties}>
              {identity.name}
            </span>
            {remoteUsers.map((user) => (
              <span
                key={user.userId}
                className="presenceChip"
                style={{ "--presence-color": user.color } as CSSProperties}
              >
                {user.name}
              </span>
            ))}
          </div>
        </div>
        <button onClick={requestFlush} className="saveButton" disabled={saveStatus === "saving"}>
          {saveStatus === "saving" ? "保存中..." : "保存"}
        </button>
      </header>

      <main className="main">
        <div className="workspace">
          <div className="editorWrapper">
            <div className="titleInputWrapper">
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="タイトルを入力してください"
                className="titleInput"
              />
            </div>

            <div className="toolbar" aria-label="エディターツールバー">
              {toolbarGroups.map((group) => (
                <div key={group.label} className="toolbarGroup">
                  <span className="toolbarGroupLabel">{group.label}</span>
                  <div className="toolbarGroupButtons">
                    {group.buttons.map((button) => (
                      <ToolbarButton
                        key={button.key}
                        label={button.label}
                        isActive={button.isActive}
                        onClick={button.onClick}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="imageForm">
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="画像URLを入力してください (https://...)"
                className="imageInput"
              />
              <button
                type="button"
                onClick={() => void handleInsertImage()}
                className="imageButton"
                disabled={!editor || isUploadingImage}
              >
                画像を挿入
              </button>
              <button
                type="button"
                onClick={handlePickImage}
                className="imageButton imageButtonSecondary"
                disabled={!editor || isUploadingImage}
              >
                画像ファイルを選択
              </button>
            </div>

            <div className="linkCardForm">
              <input
                type="url"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="リンクURLを入力してください (https://...)"
                className="imageInput"
              />
              <button
                type="button"
                onClick={() => void handleInsertLinkCard()}
                className="imageButton"
                disabled={!editor || isFetchingLinkPreview}
              >
                {isFetchingLinkPreview ? "取得中..." : "リンクカードを追加"}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hiddenFileInput"
              onChange={(event) => void handleImageSelected(event)}
            />
            <input
              ref={htmlInputRef}
              type="file"
              multiple
              accept=".html,text/html,image/*"
              className="hiddenFileInput"
              onChange={(event) => void handleImportHtml(event)}
            />

            <div
              className={`dropZone${isDraggingImage ? " is-dragging" : ""}${isUploadingImage ? " is-uploading" : ""}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(event) => void handleDrop(event)}
            >
              <div className="dropZoneHint">
                画像をここにドラッグ&ドロップして追加できます
                {isUploadingImage ? "（アップロード中...）" : ""}
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>

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
                cancelCreateComment={() => {
                  setIsCreatingComment(false);
                  setNewCommentBody("");
                }}
                submitCreateComment={handleCreateComment}
                showResolvedComments={showResolvedComments}
                setShowResolvedComments={setShowResolvedComments}
                commentThreads={commentThreads}
                activeThreadId={activeThreadId}
                setActiveThreadId={setActiveThreadId}
                replyBodies={replyBodies}
                setReplyBody={(threadId, value) =>
                  setReplyBodies((current) => ({
                    ...current,
                    [threadId]: value,
                  }))
                }
                addReply={handleAddReply}
                toggleResolveThread={(thread) =>
                  thread.is_resolved ? handleUnresolveThread(thread.id) : handleResolveThread(thread.id)
                }
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

            {sidebarTab === "ai" && (
              <section className="aiPanel" aria-label="AIアシスタント">
                <div className="aiPanelHeader">
                  <h2 className="aiPanelTitle">AIアシスタント</h2>
                  <p className="aiPanelDescription">
                    チャットを選択して会話できます。Enterで送信、Shift+Enterで改行できます。
                  </p>
                </div>

                <div className={`aiLayout${isAiHistoryOpen ? " is-thread-open" : ""}`}>
                  {isAiHistoryOpen && (
                    <aside className="aiThreadPane" aria-label="AIチャット一覧">
                      <div className="aiThreadPaneHeader">
                        <button
                          type="button"
                          className="aiHistoryToggle"
                          onClick={() => {
                            setIsAiHistoryOpen(false);
                            setAiThreadMenuOpenId(null);
                          }}
                        >
                          ← 履歴を閉じる
                        </button>
                        <button type="button" className="aiNewChatButton" onClick={handleCreateAiThread}>
                          + 新しいチャット
                        </button>
                      </div>
                      <div className="aiThreadList">
                        {aiThreads.map((thread) => {
                          const lastMessage = thread.messages[thread.messages.length - 1];
                          return (
                            <article
                              key={thread.id}
                              className={`aiThreadItem${thread.id === activeAiThreadId ? " is-active" : ""}`}
                            >
                              <button
                                type="button"
                                className="aiThreadMain"
                                onClick={() => {
                                  setActiveAiThreadId(thread.id);
                                  setAiThreadMenuOpenId(null);
                                  setIsAiHistoryOpen(false);
                                }}
                              >
                                <span className="aiThreadTitle">{thread.title}</span>
                                <span className="aiThreadPreview">
                                  {lastMessage ? lastMessage.text.slice(0, 36) : "メッセージなし"}
                                </span>
                                <span className="aiThreadTime">{formatThreadTime(thread.updatedAt)}</span>
                              </button>
                              <div className="aiThreadMenuWrap">
                                <button
                                  type="button"
                                  className="aiThreadMenuButton"
                                  onClick={() =>
                                    setAiThreadMenuOpenId((current) => (current === thread.id ? null : thread.id))
                                  }
                                  aria-label="チャットメニュー"
                                >
                                  ⋯
                                </button>
                                {aiThreadMenuOpenId === thread.id && (
                                  <div className="aiThreadMenu">
                                    <button
                                      type="button"
                                      className="aiThreadMenuItem"
                                      onClick={() => handleRenameAiThread(thread)}
                                    >
                                      名前変更
                                    </button>
                                    <button
                                      type="button"
                                      className="aiThreadMenuItem aiThreadMenuItemDanger"
                                      onClick={() => handleDeleteAiThread(thread)}
                                    >
                                      削除
                                    </button>
                                  </div>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </aside>
                  )}

                  <div className="aiChatArea">
                    <div className="aiChatTopBar">
                      <button
                        type="button"
                        className="aiHistoryToggle"
                        onClick={() => {
                          setIsAiHistoryOpen(true);
                          setAiThreadMenuOpenId(null);
                        }}
                      >
                        ← 履歴を開く
                      </button>
                      <span className="aiActiveThreadTitle">{activeAiThread?.title ?? AI_DEFAULT_THREAD_TITLE}</span>
                    </div>
                    <div className="aiChatList" aria-live="polite">
                      {activeAiMessages.length === 0 && (
                        <p className="aiEmpty">まだ会話はありません。下の入力欄から開始してください。</p>
                      )}
                      {activeAiMessages.map((message) => (
                        <article key={message.id} className={`aiMessage aiMessage-${message.role}`}>
                          <header className="aiMessageHeader">
                            <span className="aiMessageRole">{message.role === "user" ? "あなた" : "AI"}</span>
                            <time className="aiMessageTime">{formatMessageTime(message.createdAt)}</time>
                          </header>
                          <p className="aiMessageBody">{message.text}</p>
                        </article>
                      ))}
                      {respondingAiThreadId === activeAiThread?.id && (
                        <p className="aiTyping">AIが返信を作成中です...</p>
                      )}
                      <div ref={aiMessagesEndRef} />
                    </div>

                    <div className="aiComposer">
                      <textarea
                        className="aiComposerInput"
                        value={aiPrompt}
                        onChange={(event) => setAiPrompt(event.target.value)}
                        onKeyDown={handleAiInputKeyDown}
                        placeholder="AIに質問してみましょう"
                        rows={3}
                      />
                      <div className="aiComposerFooter">
                        <div className="aiComposerLeft">
                          <button type="button" className="aiComposerIconButton" aria-label="追加オプション">
                            +
                          </button>
                          <button
                            type="button"
                            className="aiComposerLinkButton"
                            onClick={() => setAiPrompt("")}
                            disabled={aiPrompt.trim() === ""}
                          >
                            入力をクリア
                          </button>
                        </div>
                        <button
                          type="button"
                          className="aiComposerSendButton"
                          onClick={handleAiEcho}
                          disabled={isAiResponding || aiPrompt.trim() === ""}
                          aria-label={isAiResponding ? "返信中" : "送信"}
                        >
                          ↑
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
