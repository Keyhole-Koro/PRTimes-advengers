import { z } from 'zod'

export const PressReleaseInputSchema = z.object({
  title: z.string(),
  content: z.string(),
})
