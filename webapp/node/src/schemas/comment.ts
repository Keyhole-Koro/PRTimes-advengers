import { z } from 'zod'

export const CreateCommentThreadSchema = z.object({
  anchorFrom: z.number().int().min(0),
  anchorTo: z.number().int().min(0),
  quote: z.string(),
  body: z.string().trim().min(1),
  createdBy: z.string().trim().min(1),
})

export const CreateCommentReplySchema = z.object({
  body: z.string().trim().min(1),
  createdBy: z.string().trim().min(1),
})
