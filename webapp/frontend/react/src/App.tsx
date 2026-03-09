import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import "./App.css";

const queryKey = ["fetch-press-release"];
const BASE_URL = "http://localhost:8080";
const PRESS_RELEASE_ID = 1;

type PressReleaseResponse = {
  title: string;
  content: string;
};

type PressRelease = {
  title: string;
  content: JSONContent;
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

const MARK_BUTTONS: Array<{ key: MarkType; label: string }> = [
  { key: "bold", label: "太字" },
  { key: "italic", label: "斜体" },
  { key: "underline", label: "下線" },
];

const EMPTY_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function parseContent(rawContent: string): JSONContent {
  try {
    return JSON.parse(rawContent) as JSONContent;
  } catch {
    return EMPTY_CONTENT;
  }
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

function useSavePressReleaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("保存に失敗しました");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      alert(`エラー: ${error.message}`);
    },
  });
}

export function App() {
  const { data, isPending, isError } = usePressReleaseQuery();
  if (isPending || isError) return null;

  return <Page title={data.title} content={parseContent(data.content)} />;
}

function Page({ title: initialTitle, content }: PressRelease) {
  const [title, setTitle] = useState(() => initialTitle);
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Image],
    content,
  });

  const markState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      underline: currentEditor?.isActive("underline") ?? false,
    }),
  });

  const { isPending, mutate, mutateAsync } = useSavePressReleaseMutation();

  const saveCurrentContent = async () => {
    if (!editor) return;

    await mutateAsync({
      title,
      content: JSON.stringify(editor.getJSON()),
    });
  };

  const handleSave = () => {
    mutate({
      title,
      content: JSON.stringify(editor?.getJSON() ?? EMPTY_CONTENT),
    });
  };

  const uploadImageFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/uploads/images`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("画像のアップロードに失敗しました");
    }

    const data = (await response.json()) as { url?: string };
    if (!data.url) {
      throw new Error("画像URLの取得に失敗しました");
    }

    return data.url;
  };

  const handleInsertImage = async () => {
    if (!editor) return;

    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) return;

    try {
      const url = new URL(trimmedUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        alert("http/https のURLを入力してください");
        return;
      }
    } catch {
      alert("有効なURLを入力してください");
      return;
    }

    editor.chain().focus().setImage({ src: trimmedUrl, alt: "挿入画像" }).run();
    setImageUrl("");
    await saveCurrentContent();
  };

  const insertUploadedImage = async (file: File) => {
    if (!editor) return;

    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください");
      return;
    }

    setIsUploadingImage(true);

    try {
      const uploadedUrl = await uploadImageFile(file);
      editor.chain().focus().setImage({ src: uploadedUrl, alt: file.name || "アップロード画像" }).run();
      await saveCurrentContent();
    } catch (error) {
      const message = error instanceof Error ? error.message : "画像の挿入に失敗しました";
      alert(message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      // Serialize uploads to prevent save request races.
      // eslint-disable-next-line no-await-in-loop
      await insertUploadedImage(file);
    }
    event.target.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;

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
    if (files.length === 0) return;

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
              onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="画像URLを入力してください (https://...)"
              className="imageInput"
            />
            <button
              type="button"
              onClick={handleInsertImage}
              className="imageButton"
              disabled={!editor || isUploadingImage}
            >
              画像を挿入
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="imageButton imageButtonSecondary"
              disabled={!editor || isUploadingImage}
            >
              画像ファイルを選択
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="fileInputHidden"
              onChange={handleFileInputChange}
            />
          </div>
          <div
            className={`dropZone${isDraggingImage ? " is-dragging" : ""}${isUploadingImage ? " is-uploading" : ""}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="dropZoneHint">
              画像をここにドラッグ&ドロップして追加できます
              {isUploadingImage ? "（アップロード中...）" : ""}
            </div>
            <EditorContent editor={editor} />
          </div>
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
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`toolbarButton${isActive ? " is-active" : ""}`}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}
