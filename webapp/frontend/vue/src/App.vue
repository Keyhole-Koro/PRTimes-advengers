<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import Heading from '@tiptap/extension-heading'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'

const queryKey = ['fetch-press-release']
const BASE_URL = 'http://localhost:8080'

const { data, isPending, isError } = useQuery({
  queryKey,
  queryFn: async () => {
    const response = await fetch(`${BASE_URL}/press-releases/1`)
    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`)
    }
    return response.json()
  },
})

// タイトルのリアクティブな状態
const title = ref('')

const editor = useEditor({
  extensions: [Document, Heading, Paragraph, Text, BulletList, OrderedList, ListItem],
  content: '',
})

// データが読み込まれたらタイトルとコンテンツを設定
watch(
  data,
  (newData) => {
    if (!newData) return

    title.value = newData.title

    if (editor.value) {
      editor.value.commands.setContent(JSON.parse(newData.content))
    }
  },
  { immediate: true },
)

// 保存用のMutation
const queryClient = useQueryClient()
const { isPending: isSaving, mutate } = useMutation({
  mutationFn: async (data: { title: string; content: string }) => {
    const response = await fetch(`${BASE_URL}/press-releases/1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('保存に失敗しました')
    }
    return response.json()
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey })
  },
  onError: (error: Error) => {
    alert(`エラー: ${error.message}`)
  },
})

// 保存ボタンのハンドラ
const handleSave = () => {
  if (editor.value) {
    mutate({
      title: title.value,
      content: JSON.stringify(editor.value.getJSON()),
    })
  }
}

const toggleBulletList = () => {
  if (!editor.value) return
  editor.value.chain().focus().toggleBulletList().run()
}

const toggleOrderedList = () => {
  if (!editor.value) return
  editor.value.chain().focus().toggleOrderedList().run()
}
</script>

<template>
  <div v-if="isPending" class="container">読み込み中...</div>
  <div v-else-if="isError" class="container">データの取得に失敗しました。</div>
  <div v-else-if="data" class="container">
    <!-- ヘッダー -->
    <header class="header">
      <h1 class="title">プレスリリースエディター</h1>
      <button @click="handleSave" class="saveButton" :disabled="isSaving">
        {{ isSaving ? '保存中...' : '保存' }}
      </button>
    </header>

    <!-- メインコンテンツ -->
    <main class="main">
      <div class="editorWrapper">
        <div class="titleInputWrapper">
          <input
            type="text"
            v-model="title"
            placeholder="タイトルを入力してください"
            class="titleInput"
          />
        </div>
        <div class="toolbar">
          <button
            type="button"
            @click="toggleBulletList"
            class="toolbarButton"
            :data-active="editor?.isActive('bulletList') ?? false"
            :disabled="!editor"
          >
            箇条書き
          </button>
          <button
            type="button"
            @click="toggleOrderedList"
            class="toolbarButton"
            :data-active="editor?.isActive('orderedList') ?? false"
            :disabled="!editor"
          >
            番号付きリスト
          </button>
        </div>
        <EditorContent :editor="editor" />
      </div>
    </main>
  </div>
</template>
