import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

import { useState } from "react";
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

  const editor = useEditor({
    extensions: [StarterKit, Underline],
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

  const { isPending, mutate } = useSavePressReleaseMutation();

  const handleSave = () => {
    if (!editor) return;
    mutate({
      title,
      content: JSON.stringify(editor.getJSON()),
    });
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

          {/* ツールバー */}
          <div className="toolbar">
            {MARK_BUTTONS.map((button) => (
              <ToolbarButton
                key={button.key}
                label={button.label}
                isActive={markState[button.key]}
                onClick={() => toggleMark(button.key)}
              />
            ))}
          </div>

          <EditorContent editor={editor} />
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
