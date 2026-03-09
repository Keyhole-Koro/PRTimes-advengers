import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { collab, receiveTransaction, sendableSteps } from "@tiptap/pm/collab";
import { Step } from "@tiptap/pm/transform";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { CSSProperties, ChangeEvent, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { LinkCard } from "./editor/linkCard";
import { RemotePresence, setRemotePresence, type PresenceUser } from "./editor/remotePresence";

const queryKey = ["fetch-press-release"];
const BASE_URL = "http://localhost:8080";
const WS_BASE_URL = "ws://localhost:8080";
const PRESS_RELEASE_ID = 1;
const revisionsQueryKey = ["fetch-press-release-revisions", PRESS_RELEASE_ID];
const PRESENCE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];

type PressReleaseResponse = {
  id: number;
  title: string;
  content: JSONContent;
  version: number;
};

type PressRelease = {
  title: string;
  content: JSONContent;
  version: number;
};

type FileWithRelativePath = File & {
  webkitRelativePath?: string;
};

type PressReleaseRevisionResponse = {
  id: number;
  press_release_id: number;
  version: number;
  title: string;
  content: JSONContent;
  created_at: string;
};

type LinkPreviewResponse = {
  url: string;
  title: string;
  description: string;
  image: string | null;
};

type PressReleaseTemplateResponse = {
  id: number;
  name: string;
  title: string;
  content: JSONContent;
  created_at: string;
  updated_at: string;
};

type MarkType = "bold" | "italic" | "underline";

type ToolbarButtonConfig = {
  key: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

type ToolbarGroupConfig = {
  label: string;
  buttons: ToolbarButtonConfig[];
};

type SaveStatus = "saved" | "dirty" | "saving" | "error";

type SessionSnapshot = {
  title: string;
  content: JSONContent;
  version: number;
};

type SessionState = {
  clientId: string;
  snapshot: SessionSnapshot;
  revision: number;
};

type DiffSegment = {
  type: "added" | "removed";
  value: string;
};

type RealtimeMessage =
  | {
      type: "session.ready";
      clientId: string;
      snapshot: SessionSnapshot;
      revision: number;
      presence: PresenceUser[];
    }
  | {
      type: "document.steps";
      sourceClientId: string;
      steps: unknown[];
      clientIds: string[];
      revision: number;
    }
  | {
      type: "title.sync";
      title: string;
    }
  | {
      type: "document.saved";
      title: string;
      content: JSONContent;
      version: number;
    }
  | {
      type: "document.resync";
      snapshot: SessionSnapshot;
      revision: number;
    }
  | {
      type: "presence.snapshot";
      users: PresenceUser[];
    };

const MARK_BUTTONS: Array<{ key: MarkType; label: string }> = [
  { key: "bold", label: "太字" },
  { key: "italic", label: "斜体" },
  { key: "underline", label: "下線" },
];

const EMPTY_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const MOCK_TEMPLATES: PressReleaseTemplateResponse[] = [
  {
    id: 1,
    name: "採用告知",
    title: "2026年度 新卒採用の募集開始に関するお知らせ",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "概要" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "株式会社○○は、" },
            { type: "text", marks: [{ type: "bold" }], text: "2026年度新卒採用" },
            { type: "text", text: "の募集を開始しました。" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "募集職種" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ソフトウェアエンジニア" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "プロダクトデザイナー" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ビジネス職（営業・企画）" }] }] },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "選考フロー" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "エントリー" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "書類選考" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "面接（複数回）" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "内定" }] }] },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", marks: [{ type: "underline" }], text: "詳細は採用サイトをご確認ください。" }],
        },
      ],
    },
    created_at: "2026-03-09 09:00",
    updated_at: "2026-03-09 09:00",
  },
  {
    id: 2,
    name: "サービスリリース",
    title: "新サービス「○○」提供開始のお知らせ",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "サービス概要" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "株式会社○○は、本日より新サービス「○○」の提供を開始しました。" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "本サービスは、" },
            { type: "text", marks: [{ type: "italic" }], text: "情報整理・共有・進行管理" },
            { type: "text", text: "を一つの画面で行えることを特徴としています。" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "主な特長" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "操作しやすいダッシュボード" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "チーム横断での情報共有" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "分析レポートの自動生成" }] }] },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "提供開始までの流れ" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "先行導入企業による検証" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "正式版の機能拡充" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "一般提供開始" }] }] },
          ],
        },
      ],
    },
    created_at: "2026-03-08 15:30",
    updated_at: "2026-03-08 15:30",
  },
  {
    id: 3,
    name: "イベント開催",
    title: "イベント「○○ 2026」開催決定のお知らせ",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "イベント開催概要" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "株式会社○○は、2026年5月にイベント「○○ 2026」を開催します。" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "開催目的" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "業界関係者との接点創出" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "新しい取り組みの発信" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "来場者との双方向コミュニケーション" }] }] },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "当日のプログラム" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "オープニングセッション" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "基調講演" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "パネルディスカッション" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ネットワーキング" }] }] },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "開催概要、参加方法、登壇情報は特設ページで順次公開予定です。" }],
        },
      ],
    },
    created_at: "2026-03-07 12:00",
    updated_at: "2026-03-07 12:00",
  },
];

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

function createRealtimeIdentity() {
  const userId = crypto.randomUUID();
  const suffix = userId.slice(0, 4);
  return {
    userId,
    name: `Tab ${suffix}`,
    color: PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)],
  };
}

function createCollaborationExtension(version: number, clientId: string) {
  return Extension.create({
    name: "collaborationBridge",
    addProseMirrorPlugins() {
      return [collab({ version, clientID: clientId })];
    },
  });
}

function usePressReleaseQuery() {
  return useQuery<PressReleaseResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return (await response.json()) as PressReleaseResponse;
    },
  });
}

function usePressReleaseRevisionsQuery() {
  return useQuery<PressReleaseRevisionResponse[]>({
    queryKey: revisionsQueryKey,
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}/revisions`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return (await response.json()) as PressReleaseRevisionResponse[];
    },
  });
}

function extractTextContent(content: JSONContent | undefined): string {
  if (!content) {
    return "";
  }

  const chunks: string[] = [];
  const visit = (node: JSONContent) => {
    if (typeof node.text === "string") {
      chunks.push(node.text);
    }

    node.content?.forEach(visit);
  };

  visit(content);
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function tokenizeDiffText(text: string): string[] {
  return text
    .split(/(?<=[。！？\n])|(\s+)/)
    .map((token) => token?.trim())
    .filter((token): token is string => Boolean(token));
}

function buildDiffSegments(previousText: string, nextText: string): DiffSegment[] {
  const previousTokens = tokenizeDiffText(previousText);
  const nextTokens = tokenizeDiffText(nextText);
  const dp = Array.from({ length: previousTokens.length + 1 }, () =>
    Array<number>(nextTokens.length + 1).fill(0),
  );

  for (let i = previousTokens.length - 1; i >= 0; i -= 1) {
    for (let j = nextTokens.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        previousTokens[i] === nextTokens[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  const pushSegment = (type: DiffSegment["type"], value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    const last = segments.at(-1);
    if (last?.type === type) {
      last.value = `${last.value} ${normalized}`.trim();
      return;
    }

    segments.push({ type, value: normalized });
  };

  while (i < previousTokens.length && j < nextTokens.length) {
    if (previousTokens[i] === nextTokens[j]) {
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSegment("removed", previousTokens[i]);
      i += 1;
      continue;
    }

    pushSegment("added", nextTokens[j]);
    j += 1;
  }

  while (i < previousTokens.length) {
    pushSegment("removed", previousTokens[i]);
    i += 1;
  }

  while (j < nextTokens.length) {
    pushSegment("added", nextTokens[j]);
    j += 1;
  }

  return segments;
}

function buildRevisionDiffSummary(revisions: PressReleaseRevisionResponse[], revisionId: number) {
  const index = revisions.findIndex((revision) => revision.id === revisionId);
  const revision = index >= 0 ? revisions[index] : null;
  const previousRevision = index >= 0 && index < revisions.length - 1 ? revisions[index + 1] : null;

  const bodyDiff = revision
    ? buildDiffSegments(
        extractTextContent(previousRevision?.content),
        extractTextContent(revision.content),
      )
    : [];

  return {
    added: bodyDiff.filter((segment) => segment.type === "added").length,
    removed: bodyDiff.filter((segment) => segment.type === "removed").length,
  };
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
            createCollaborationExtension(session.revision, session.clientId),
          ]
        : [StarterKit, Underline, Image, LinkCard, RemotePresence],
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
        void queryClient.invalidateQueries({ queryKey });
        void queryClient.invalidateQueries({ queryKey: revisionsQueryKey });
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

      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: revisionsQueryKey });
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
  const titleDiff = selectedRevision
    ? buildDiffSegments(previousRevision?.title ?? "", selectedRevision.title)
    : [];
  const bodyDiff = selectedRevision
    ? buildDiffSegments(
        extractTextContent(previousRevision?.content),
        extractTextContent(selectedRevision.content),
      )
    : [];
  const visibleBodyDiff = bodyDiff.slice(0, 8);
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

          <aside className="historyPanel" aria-label="変更履歴">
            <section className="templatePanel">
              <div className="historyPanelHeader">
                <h2 className="historyTitle">テンプレート</h2>
                <span className="historyCount">{templates.length}件</span>
              </div>
              <div className="templateSaveRow">
                <input
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="テンプレート名"
                  className="templateInput"
                />
                <button
                  type="button"
                  className="templateButton"
                  onClick={() => void saveCurrentAsTemplate()}
                  disabled={isSavingTemplate}
                >
                  {isSavingTemplate ? "保存中..." : "保存"}
                </button>
              </div>
              <div className="templateList">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="templateItem"
                    onClick={() => void applyTemplate(template.id)}
                    disabled={applyingTemplateId === template.id}
                  >
                    <span className="templateName">{template.name}</span>
                    <span className="templateMeta">{template.updated_at}</span>
                    <span className="templateTitle">{template.title}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="historyPanelHeader">
              <h2 className="historyTitle">変更履歴</h2>
              <span className="historyCount">{revisions.length}件</span>
            </div>

            <div className="historyList">
              {revisions.map((revision) => (
                <button
                  key={revision.id}
                  type="button"
                  className={`historyItem${revision.id === selectedRevision?.id ? " is-active" : ""}`}
                  onClick={() => setSelectedRevisionId(revision.id)}
                >
                  <span className="historyItemVersion">v{revision.version}</span>
                  <span className="historyItemDate">{revision.created_at}</span>
                  <span className="historyItemMeta">
                    +{revisionSummaries[revision.id]?.added ?? 0}
                    {" / "}
                    -{revisionSummaries[revision.id]?.removed ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {selectedRevision && (
              <section className="historyPreview">
                <div className="historyPreviewMeta">
                  <span>version {selectedRevision.version}</span>
                  <span>{selectedRevision.created_at}</span>
                </div>
                <h3 className="historyPreviewTitle">
                  {previousRevision ? `v${previousRevision.version} -> v${selectedRevision.version}` : "初回保存"}
                </h3>
                <button
                  type="button"
                  className="restoreButton"
                  onClick={() => void restoreRevision(selectedRevision.id)}
                  disabled={restoringRevisionId === selectedRevision.id}
                >
                  {restoringRevisionId === selectedRevision.id ? "復元中..." : "復元"}
                </button>
                {titleDiff.length > 0 && (
                  <div className="diffGroup">
                    <span className="diffLabel">タイトル</span>
                    <div className="diffTokens">
                      {titleDiff.map((segment, index) => (
                        <span key={`${segment.type}-${index}`} className={`diffToken is-${segment.type}`}>
                          {segment.type === "added" ? "+ " : "- "}
                          {segment.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="diffGroup">
                  <span className="diffLabel">本文差分</span>
                  <div className="diffTokens">
                    {visibleBodyDiff.length > 0 ? (
                      visibleBodyDiff.map((segment, index) => (
                        <span key={`${segment.type}-${index}`} className={`diffToken is-${segment.type}`}>
                          {segment.type === "added" ? "+ " : "- "}
                          {segment.value}
                        </span>
                      ))
                    ) : (
                      <span className="diffEmpty">差分なし</span>
                    )}
                  </div>
                </div>
                {bodyDiff.length > visibleBodyDiff.length && (
                  <span className="historyMore">さらに {bodyDiff.length - visibleBodyDiff.length} 件</span>
                )}
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

type ToolbarButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function ToolbarButton({ label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`toolbarButton${isActive ? " is-active" : ""}`}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}
