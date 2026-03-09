'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { PressRelease } from '@/lib/types';
import styles from './page.module.css';

const PRESS_RELEASE_ID = 1;
const queryKey = ['press-release', PRESS_RELEASE_ID];

function usePressReleaseQuery() {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<PressRelease> => {
      const response = await fetch(`/api/press-releases/${PRESS_RELEASE_ID}`);
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
      const response = await fetch(`/api/press-releases/${PRESS_RELEASE_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('保存に失敗しました');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      alert(`エラー: ${error.message}`);
    },
  });
}

export default function EditorPage() {
  const { data, isPending, isError } = usePressReleaseQuery();

  if (isPending) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>データの読み込みに失敗しました</div>
      </div>
    );
  }

  return <Editor initialTitle={data.title} initialContent={JSON.parse(data.content)} />;
}

interface EditorProps {
  initialTitle: string;
  initialContent: string;
}

function Editor({ initialTitle, initialContent }: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const editor = useEditor({
    extensions: [Document, Heading, Paragraph, Text],
    content: initialContent,
    immediatelyRender: false
  });

  const { isPending, mutate } = useSavePressReleaseMutation();

  const handleSave = () => {
    if (!editor) return;

    mutate({
      title,
      content: JSON.stringify(editor.getJSON()),
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>プレスリリースエディター</h1>
        <button onClick={handleSave} className={styles.saveButton} disabled={isPending}>
          {isPending ? '保存中...' : '保存'}
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.editorWrapper}>
          <div className={styles.titleInputWrapper}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトルを入力してください"
              className={styles.titleInput}
            />
          </div>
          <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
}
