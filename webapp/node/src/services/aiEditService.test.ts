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

test('AiEditService returns inline review suggestion for typo-check prompts', async () => {
  const service = new AiEditService('http://example.invalid')

  const result = await service.requestDocumentEdit({
    prompt: '誤字脱字を探して',
    title: 'テスト',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'いますぐ下のフォームからエントリーして、未来を掴む第一歩を踏み出' }],
        },
      ],
    },
  })

  assert.equal(result.suggestions.length, 1)
  assert.equal(result.suggestions[0]?.presentation, 'inline')

  const operation = result.suggestions[0]?.operations[0]
  if (!operation || operation.op !== 'modify') {
    throw new Error('Expected modify operation.')
  }

  assert.equal(operation.after.text, 'いますぐ下のフォームからエントリーして、未来を掴む第一歩を踏み出そう。')
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

test('AiEditService coerces multi-operation inline suggestions to block', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        result: {
          summary: 'ok',
          assistant_message: '提案を追加しました。',
          navigation_label: '提案を見る',
          suggestions: [
            {
              id: 'suggestion-1',
              presentation: 'inline',
              category: 'body',
              summary: '複数箇所を修正します。',
              operations: [
                {
                  op: 'modify',
                  block_id: 'block-1',
                  before: {
                    id: 'block-1',
                    type: 'paragraph',
                    text: '最初の段落です。',
                  },
                  after: {
                    id: 'block-1',
                    type: 'paragraph',
                    text: '更新後の最初の段落です。',
                  },
                },
                {
                  op: 'modify',
                  block_id: 'block-2',
                  before: {
                    id: 'block-2',
                    type: 'paragraph',
                    text: '二番目の段落です。',
                  },
                  after: {
                    id: 'block-2',
                    type: 'paragraph',
                    text: '更新後の二番目の段落です。',
                  },
                },
              ],
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )) as typeof fetch

  try {
    const service = new AiEditService('http://example.invalid')
    const result = await service.requestDocumentEdit({
      prompt: '改善して',
      title: 'テスト',
      content,
    })

    assert.equal(result.suggestions[0]?.presentation, 'block')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('AiEditService coerces long inline rewrites to block', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        result: {
          summary: 'ok',
          assistant_message: '提案を追加しました。',
          navigation_label: '提案を見る',
          suggestions: [
            {
              id: 'suggestion-1',
              presentation: 'inline',
              category: 'readability',
              summary: '段落を書き換えます。',
              operations: [
                {
                  op: 'modify',
                  block_id: 'block-1',
                  before: {
                    id: 'block-1',
                    type: 'paragraph',
                    text: '最初の段落です。',
                  },
                  after: {
                    id: 'block-1',
                    type: 'paragraph',
                    text: 'この段落は意味を大きく変えながら背景説明と要点整理をまとめて入れ直した、かなり長い書き換え案です。',
                  },
                },
              ],
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )) as typeof fetch

  try {
    const service = new AiEditService('http://example.invalid')
    const result = await service.requestDocumentEdit({
      prompt: '改善して',
      title: 'テスト',
      content,
    })

    assert.equal(result.suggestions[0]?.presentation, 'block')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('AiEditService keeps short single-block inline suggestions as inline', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        result: {
          summary: 'ok',
          assistant_message: '提案を追加しました。',
          navigation_label: '提案を見る',
          suggestions: [
            {
              id: 'suggestion-1',
              presentation: 'inline',
              category: 'readability',
              summary: '句点を補います。',
              operations: [
                {
                  op: 'modify',
                  block_id: 'block-1',
                  before: {
                    id: 'block-1',
                    type: 'paragraph',
                    text: '最初の段落です',
                  },
                  after: {
                    id: 'block-1',
                    type: 'paragraph',
                    text: '最初の段落です。',
                  },
                },
              ],
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )) as typeof fetch

  try {
    const service = new AiEditService('http://example.invalid')
    const result = await service.requestDocumentEdit({
      prompt: '改善して',
      title: 'テスト',
      content,
    })

    assert.equal(result.suggestions[0]?.presentation, 'inline')
  } finally {
    globalThis.fetch = originalFetch
  }
})
