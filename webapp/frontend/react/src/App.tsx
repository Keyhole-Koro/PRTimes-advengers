import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import BulletList from "@tiptap/extension-bullet-list";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
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
  const { data, isPending, isError, error } = usePressReleaseQuery();

  if (isPending) {
    return (
      <div className="statusScreen">
        <p>読み込み中です...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="statusScreen">
        <p>データ取得に失敗しました。</p>
        <p className="statusDetail">{error instanceof Error ? error.message : "サーバーを確認してください"}</p>
      </div>
    );
  }

  return <Page title={data.title} content={parseContent(data.content)} />;
}

function Page({ title: initialTitle, content }: PressRelease) {
  const [title, setTitle] = useState(initialTitle);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [Document, Heading, Paragraph, Text, BulletList, OrderedList, ListItem, Image],
    content,
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
    }),
  });

  const { isPending, mutate } = useSavePressReleaseMutation();

  if (!editor) {
    return null;
  }

  const handleSave = () => {
    mutate({
      title,
      content: JSON.stringify(editor.getJSON()),
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

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const { url } = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();

      mutate({
        title,
        content: JSON.stringify(editor.getJSON()),
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "画像アップロードに失敗しました";
      alert(message);
    } finally {
      event.target.value = "";
    }
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
              onChange={(event) => setTitle(event.target.value)}
              placeholder="タイトルを入力してください"
              className="titleInput"
            />
          </div>

          <div className="toolbar" aria-label="エディターツールバー">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="toolbarButton"
              data-active={editorState.bulletList}
            >
              箇条書き
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className="toolbarButton"
              data-active={editorState.orderedList}
            >
              番号付きリスト
            </button>
            <button type="button" onClick={handlePickImage} className="toolbarButton">
              画像を追加
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.png,.gif"
            className="hiddenFileInput"
            onChange={handleImageSelected}
          />

          <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
}
