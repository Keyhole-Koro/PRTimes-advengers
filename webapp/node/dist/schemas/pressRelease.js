import { z } from 'zod';
export const PressReleaseContentSchema = z.object({
    type: z.literal('doc'),
    content: z.array(z.unknown()).optional(),
}).passthrough();
export const PressReleaseInputSchema = z.object({
    title: z.string().trim().min(1),
    content: PressReleaseContentSchema,
    version: z.number().int().positive().optional(),
});
