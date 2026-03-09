import { z } from 'zod'
import { PressReleaseContentSchema } from './pressRelease.js'

export const PressReleaseTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1),
  content: PressReleaseContentSchema,
})
