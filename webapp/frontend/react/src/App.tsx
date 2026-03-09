<<<<<<< HEAD
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useState } from "react";
import "./App.css";

const queryKey = ["fetch-press-release"];

const DEFAULT_LOCAL_API_URL = "http://localhost:8080";
const APP_ENV = String((import.meta.env as any).APP_ENV ?? "local").toLowerCase();
const API_BASE_URL = String(
  (import.meta.env as any).VITE_API_BASE_URL ??
    (import.meta.env as any).APP_API_BASE_URL ??
    ""
);
const BASE_URL = APP_ENV === "local" ? DEFAULT_LOCAL_API_URL : (API_BASE_URL || "");
=======
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import "./App.css";

const queryKey = ["fetch-press-release"];
const BASE_URL = "http://localhost:8080";
const WS_BASE_URL = "ws://localhost:8080";
>>>>>>> 1d485025041f661ea1fd36a998e32d2d44b024e9
const PRESS_RELEASE_ID = 1;
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

type PresenceUser = {
  userId: string;
  name: string;
  color: string;
  selection: {
    from: number;
    to: number;
  };
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

type RealtimeMessage =
  | {
      type: "session.ready";
      clientId: string;
      snapshot: {
        title: string;
        content: JSONContent;
        version: number;
      };
      presence: PresenceUser[];
    }
  | {
      type: "document.sync";
      sourceClientId: string;
      title: string;
      content: JSONContent;
      version: number;
    }
  | {
      type: "document.saved";
      title: string;
      content: JSONContent;
      version: number;
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

function createRealtimeIdentity() {
  const userId = crypto.randomUUID();
  const suffix = userId.slice(0, 4);
  return {
    userId,
    name: `Tab ${suffix}`,
    color: PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)],
  };
}

function logPresenceUsers(users: PresenceUser[]) {
  if (users.length === 0) {
    console.log("No other tabs connected");
    return;
  }

  users.forEach((user) => {
    console.log(`${user.name} (${user.selection.from}-${user.selection.to})`);
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

function useSavePressReleaseMutation(onSaved: (pressRelease: PressReleaseResponse) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; content: JSONContent; version: number }) => {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as
          | { message?: string; currentVersion?: number }
          | null;

        if (response.status === 409) {
          throw new Error(
            errorData?.message ?? `保存競合が発生しました。最新版 version=${errorData?.currentVersion ?? "unknown"}`,
          );
        }

        throw new Error(errorData?.message ?? "保存に失敗しました");
      }

      return (await response.json()) as PressReleaseResponse;
    },
    onSuccess: (pressRelease) => {
      onSaved(pressRelease);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      alert(`エラー: ${error.message}`);
    },
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
  const [title, setTitle] = useState(() => initialTitle);
<<<<<<< HEAD
  const [imageUrl, setImageUrl] = useState("");
=======
  const [version, setVersion] = useState(() => initialVersion);
  const [identity] = useState(createRealtimeIdentity);
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
>>>>>>> 1d485025041f661ea1fd36a998e32d2d44b024e9

  const editor = useEditor({
    extensions: [StarterKit, Underline, Image],
    content,
  });

  const websocketRef = useRef<WebSocket | null>(null);
  const remoteUpdateRef = useRef(false);
  const suppressNextTitleSyncRef = useRef(false);
  const documentSyncTimerRef = useRef<number | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const titleRef = useRef(title);
  const versionRef = useRef(version);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  const markState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      underline: currentEditor?.isActive("underline") ?? false,
    }),
  });

  const { isPending, mutate, mutateAsync } = useSavePressReleaseMutation((pressRelease) => {
    setVersion(pressRelease.version);
  });

  const sendPresenceUpdate = () => {
    if (!editor || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const selection = editor.state.selection;
    websocketRef.current.send(
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

  const sendDocumentUpdate = () => {
    if (!editor || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    websocketRef.current.send(
      JSON.stringify({
        type: "document.update",
        title: titleRef.current,
        content: editor.getJSON(),
        version: versionRef.current,
      }),
    );
  };

  const scheduleDocumentUpdate = () => {
    if (remoteUpdateRef.current) {
      return;
    }

    if (documentSyncTimerRef.current) {
      window.clearTimeout(documentSyncTimerRef.current);
    }

    documentSyncTimerRef.current = window.setTimeout(() => {
      sendDocumentUpdate();
    }, 150);
  };

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleEditorUpdate = () => {
      scheduleDocumentUpdate();
    };

    const handleSelectionUpdate = () => {
      sendPresenceUpdate();
    };

    editor.on("update", handleEditorUpdate);
    editor.on("selectionUpdate", handleSelectionUpdate);
    sendPresenceUpdate();

    return () => {
      editor.off("update", handleEditorUpdate);
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (suppressNextTitleSyncRef.current) {
      suppressNextTitleSyncRef.current = false;
      return;
    }

    scheduleDocumentUpdate();
  }, [title, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const params = new URLSearchParams({
      userId: identity.userId,
      name: identity.name,
      color: identity.color,
    });

    const websocket = new WebSocket(`${WS_BASE_URL}/ws/press-releases/${PRESS_RELEASE_ID}?${params.toString()}`);
    websocketRef.current = websocket;

    websocket.addEventListener("open", () => {
      sendPresenceUpdate();
    });

    websocket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as RealtimeMessage;

      if (message.type === "session.ready") {
        clientIdRef.current = message.clientId;
        remoteUpdateRef.current = true;
        suppressNextTitleSyncRef.current = true;
        setTitle(message.snapshot.title);
        setVersion(message.snapshot.version);
        editor.commands.setContent(message.snapshot.content, { emitUpdate: false });
        logPresenceUsers(message.presence.filter((user) => user.userId !== identity.userId));
        remoteUpdateRef.current = false;
        sendPresenceUpdate();
        return;
      }

      if (message.type === "document.sync") {
        if (message.sourceClientId === clientIdRef.current) {
          return;
        }

        remoteUpdateRef.current = true;
        suppressNextTitleSyncRef.current = true;
        setTitle(message.title);
        setVersion(message.version);
        editor.commands.setContent(message.content, { emitUpdate: false });
        remoteUpdateRef.current = false;
        return;
      }

      if (message.type === "document.saved") {
        remoteUpdateRef.current = true;
        suppressNextTitleSyncRef.current = true;
        setTitle(message.title);
        setVersion(message.version);
        editor.commands.setContent(message.content, { emitUpdate: false });
        remoteUpdateRef.current = false;
        return;
      }

      logPresenceUsers(message.users.filter((user) => user.userId !== identity.userId));
    });

    return () => {
      if (documentSyncTimerRef.current) {
        window.clearTimeout(documentSyncTimerRef.current);
      }
      websocket.close();
      websocketRef.current = null;
    };
  }, [editor, identity]);

  const saveCurrentContent = async () => {
    if (!editor) {
      return;
    }

    await mutateAsync({
      title,
      content: editor.getJSON(),
      version,
    });
  };

<<<<<<< HEAD
  const handleInsertImage = () => {
    if (!editor) return;
=======
  const handleSave = () => {
    if (!editor) {
      return;
    }

    mutate({
      title,
      content: editor.getJSON(),
      version,
    });
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

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleInsertImage = async () => {
    if (!editor) {
      return;
    }
>>>>>>> 1d485025041f661ea1fd36a998e32d2d44b024e9

    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) {
      alert("画像URLを入力してください");
      return;
    }

    editor.chain().focus().setImage({ src: trimmedUrl, alt: "挿入画像" }).run();
    setImageUrl("");
    await saveCurrentContent();
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
      await saveCurrentContent();
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
      // Serialize uploads to avoid version races during autosave.
      // eslint-disable-next-line no-await-in-loop
      await insertUploadedImage(file);
    }

    event.target.value = "";
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

  if (!editor) return null;

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
        isActive: markState[button.key],
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
      ],
    },
  ];

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">プレスリリースエディター</h1>
        <button onClick={handleSave} className="saveButton" disabled={isPending}>
          {isPending ? "保存中..." : "保存"}
        </button>
      </header>

      <main className="main">
        <div className="editorWrapper">
          <div className="titleInputWrapper">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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

<<<<<<< HEAD
          <EditorContent editor={editor} />
=======
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hiddenFileInput"
            onChange={(event) => void handleImageSelected(event)}
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
>>>>>>> 1d485025041f661ea1fd36a998e32d2d44b024e9
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
