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
import { useEffect, useRef, useState } from "react";
import "./App.css";

const queryKey = ["fetch-press-release"];
const BASE_URL = "http://localhost:8080";
const PRESS_RELEASE_ID = 1;
const MAX_TITLE_CHARS = 100;
const MAX_BODY_CHARS = 500;

type PressReleaseResponse = {
  title: string;
  content: string;
};

type PressRelease = {
  title: string;
  content: JSONContent;
};

function countCharacters(value: string): number {
  return Array.from(value).length;
}

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
  const [bodyCharCount, setBodyCharCount] = useState(() => 0);
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [Document, Heading, Paragraph, Text, BulletList, OrderedList, ListItem, Image],
    content,
   
  });
  const titleCharCount = countCharacters(title);

  useEffect(() => {
    if (!editor) return;

    const syncBodyCharCount = () => {
      const nextBodyCharCount = countCharacters(editor.getText({ blockSeparator: "\n" }));
      setBodyCharCount(nextBodyCharCount);

      if (titleCharCount <= MAX_TITLE_CHARS && nextBodyCharCount <= MAX_BODY_CHARS) {
        setSaveErrorMessage("");
      }
    };

    syncBodyCharCount();
    editor.on("transaction", syncBodyCharCount);
    editor.on("update", syncBodyCharCount);
    editor.on("selectionUpdate", syncBodyCharCount);

    return () => {
      editor.off("transaction", syncBodyCharCount);
      editor.off("update", syncBodyCharCount);
      editor.off("selectionUpdate", syncBodyCharCount);
    };
  }, [editor]);

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
    if (titleCharCount > MAX_TITLE_CHARS) {
      setSaveErrorMessage(`タイトルは${MAX_TITLE_CHARS}文字以内で入力してください。`);
      return;
    }

    if (bodyCharCount > MAX_BODY_CHARS) {
      setSaveErrorMessage(`本文は${MAX_BODY_CHARS}文字以内で入力してください。`);
      return;
    }

    setSaveErrorMessage("");
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

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTitle = event.target.value;
    setTitle(nextTitle);

    if (countCharacters(nextTitle) <= MAX_TITLE_CHARS && bodyCharCount <= MAX_BODY_CHARS) {
      setSaveErrorMessage("");
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
      {saveErrorMessage && <p className="saveErrorMessage">{saveErrorMessage}</p>}

      <main className="main">
        <div className="editorWrapper">
          <div className="titleInputWrapper">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="タイトルを入力してください"
              className="titleInput"
            />
            <div className="charCount">
              タイトル文字数: {titleCharCount}/{MAX_TITLE_CHARS}
            </div>
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
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hiddenFileInput"
            onChange={handleImageSelected}
          />

          <EditorContent editor={editor} />
          <div className="charCount">
            本文文字数: {bodyCharCount}/{MAX_BODY_CHARS}
          </div>
        </div>
      </main>
    </div>
  );
}
