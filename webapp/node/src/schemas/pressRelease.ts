import { z } from 'zod'

export const PressReleaseContentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.unknown()).optional(),
}).passthrough()

export const PressReleaseInputSchema = z.object({
  title: z.string().trim().min(1),
  content: PressReleaseContentSchema,
  version: z.number().int().positive().optional(),
})

export const PressReleaseAiEditRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  title: z.string().trim().min(1),
  content: PressReleaseContentSchema,
  conversation_history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      text: z.string(),
      created_at: z.string(),
    }),
  ).optional(),
})
