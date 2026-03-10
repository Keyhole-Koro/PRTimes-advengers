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