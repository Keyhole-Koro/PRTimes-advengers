import assert from 'node:assert/strict'
import test from 'node:test'

import { AiEditService } from './aiEditService.js'

const content = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '最初の段落です。' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '二番目の段落です。' }],
    },
  ],
}

test('AiEditService returns deterministic append suggestion for simple paragraph prompt', async () => {
  const service = new AiEditService('http://example.invalid')

  const result = await service.requestDocumentEdit({
    prompt: '2つ目の段落の末尾に「AI_E2E_APPEND_TOKEN」を追加してください。',
    title: 'テスト',
    content,
  })

  assert.equal(result.suggestions.length, 1)
  assert.equal(result.suggestions[0]?.operations[0]?.op, 'modify')

  const operation = result.suggestions[0]?.operations[0]
  if (!operation || operation.op !== 'modify') {
    throw new Error('Expected modify operation.')
  }

  assert.equal(operation.block_id, 'block-2')
  assert.equal(operation.after.text, '二番目の段落です。AI_E2E_APPEND_TOKEN')
})

test('AiEditService resolves same paragraph prompts from conversation history', async () => {
  const service = new AiEditService('http://example.invalid')

  const result = await service.requestDocumentEdit({
    prompt: 'さっきの提案を踏まえて、同じ段落の先頭に「AI_E2E_THREAD_SECOND」も追加してください。',
    title: 'テスト',
    content,
    conversation_history: [
      {
        role: 'user',
        text: '2つ目の段落の末尾に「AI_E2E_THREAD_FIRST」を追加してください。',
        created_at: '2026-03-10T00:00:00.000Z',
      },
    ],
  })

  const operation = result.suggestions[0]?.operations[0]
  if (!operation || operation.op !== 'modify') {
    throw new Error('Expected modify operation.')
  }

  assert.equal(operation.block_id, 'block-2')
  assert.equal(operation.after.text, 'AI_E2E_THREAD_SECOND二番目の段落です。')
})

test('AiEditService forwards ai settings to agent instructions', async () => {
  const originalFetch = globalThis.fetch
  let capturedBody: unknown = null

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    capturedBody = init?.body ? JSON.parse(String(init.body)) : null

    return new Response(
      JSON.stringify({
        result: {
          summary: 'ok',
          assistant_message: '改善案を追加しました。',
          navigation_label: '提案を見る',
          suggestions: [],
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as typeof fetch

  try {
    const service = new AiEditService('http://example.invalid')

    await service.requestDocumentEdit({
      prompt: 'より読みやすくしてください。',
      title: 'テスト',
      content,
      ai_settings: {
        target_audience: '記者',
        writing_style: 'ニュースライク',
        tone: '簡潔',
        brand_voice: '信頼感重視',
        focus_points: ['導入文', 'CTA'],
        priority_checks: ['誤字脱字', 'リスク表現'],
      },
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(capturedBody, {
    context: {
      reference_docs: [],
      uploaded_materials: [],
    },
    document: {
      title: 'テスト',
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          text: '最初の段落です。',
        },
        {
          id: 'block-2',
          type: 'paragraph',
          text: '二番目の段落です。',
        },
      ],
    },
    instructions: {
      goal: 'より読みやすくしてください。',
      language: 'ja',
      audience: '記者',
      style: 'ニュースライク',
      tone: '簡潔',
      brand_voice: '信頼感重視',
      focus_points: ['導入文', 'CTA'],
      priority_checks: ['誤字脱字', 'リスク表現'],
    },
  })
})
