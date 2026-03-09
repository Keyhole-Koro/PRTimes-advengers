import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import Heading from "@tiptap/extension-heading";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
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
  const editor = useEditor({
    extensions: [Document, Heading, Paragraph, Text],
    content,
  });

  const { isPending, mutate } = useSavePressReleaseMutation();

  const handleSave = () => {
    mutate({
      title,
      content: JSON.stringify(editor.getJSON()),
    });
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
          <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
}
