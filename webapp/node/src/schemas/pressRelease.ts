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
  ai_settings: z.object({
    target_audience: z.string().trim().min(1).optional(),
    writing_style: z.string().trim().min(1).optional(),
    tone: z.string().trim().min(1).optional(),
    brand_voice: z.string().trim().min(1).optional(),
    consistency_policy: z.string().trim().min(1).optional(),
    focus_points: z.array(z.string().trim().min(1)).optional(),
    priority_checks: z.array(z.string().trim().min(1)).optional(),
  }).optional(),
  edit_memory: z.array(
    z.object({
      decision: z.enum(['accepted', 'dismissed']),
      prompt: z.string().trim().min(1).optional(),
      suggestion_summary: z.string().trim().min(1),
      suggestion_reason: z.string().trim().min(1).optional(),
      operation_reasons: z.array(z.string().trim().min(1)).optional(),
      target_hint: z.string().trim().min(1).optional(),
      created_at: z.string(),
    }),
  ).optional(),
})

export const PressReleaseAiTagSuggestRequestSchema = z.object({
  title: z.string().trim().min(1),
  content: PressReleaseContentSchema,
  ai_settings: z.object({
    target_audience: z.string().trim().min(1).optional(),
    writing_style: z.string().trim().min(1).optional(),
    tone: z.string().trim().min(1).optional(),
    brand_voice: z.string().trim().min(1).optional(),
    consistency_policy: z.string().trim().min(1).optional(),
    focus_points: z.array(z.string().trim().min(1)).optional(),
    priority_checks: z.array(z.string().trim().min(1)).optional(),
  }).optional(),
})

export const PressReleaseAiSettingSuggestRequestSchema = z.object({
  title: z.string().trim().min(1),
  content: PressReleaseContentSchema,
  ai_settings: z.object({
    target_audience: z.string().trim().min(1).optional(),
    writing_style: z.string().trim().min(1).optional(),
    tone: z.string().trim().min(1).optional(),
    brand_voice: z.string().trim().min(1).optional(),
    consistency_policy: z.string().trim().min(1).optional(),
    focus_points: z.array(z.string().trim().min(1)).optional(),
    priority_checks: z.array(z.string().trim().min(1)).optional(),
  }).optional(),
})
