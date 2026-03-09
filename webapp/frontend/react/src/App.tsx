import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import Heading from "@tiptap/extension-heading";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Image from "@tiptap/extension-image";
import { useState } from "react";
import "./App.css";

const queryKey = ["fetch-press-release"];
const BASE_URL = "http://localhost:8080";

function usePressReleaseQuery() {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/press-releases/1`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      return response.json();
    },
  });
}

function useSavePressReleaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await fetch(`${BASE_URL}/press-releases/1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("保存に失敗しました");
      }
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

  return <Page title={data.title} content={JSON.parse(data.content)} />;
}

type PressRelease = {
  title: string;
  content: string;
};

function Page({ title: initialTitle, content }: PressRelease) {
  const [title, setTitle] = useState(() => initialTitle);
  const [imageUrl, setImageUrl] = useState("");
  const editor = useEditor({
    extensions: [Document, Heading, Paragraph, Text, BulletList, OrderedList, ListItem, Image],
    content,
  });

  const { isPending, mutate } = useSavePressReleaseMutation();

  const handleSave = () => {
    if (!editor) return;

    mutate({
      title,
      content: JSON.stringify(editor.getJSON()),
    });
  };

  const handleInsertImage = () => {
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
  };

  return (
    <div className="container">
      {/* ヘッダー */}
      <header className="header">
        <h1 className="title">プレスリリースエディター</h1>
        <button onClick={handleSave} className="saveButton" disabled={isPending}>
          {isPending ? "保存中..." : "保存"}
        </button>
      </header>

      {/* メインコンテンツ */}
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
          <div className="toolbar">
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className="toolbarButton"
              data-active={editor?.isActive("bulletList") ?? false}
              disabled={!editor}
            >
              箇条書き
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className="toolbarButton"
              data-active={editor?.isActive("orderedList") ?? false}
              disabled={!editor}
            >
              番号付きリスト
            </button>
          </div>
          <div className="imageForm">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="画像URLを入力してください (https://...)"
              className="imageInput"
            />
            <button type="button" onClick={handleInsertImage} className="imageButton" disabled={!editor}>
              画像を挿入
            </button>
          </div>
          <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
}
