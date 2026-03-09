import { z } from 'zod'

const PressReleaseContentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.unknown()).optional(),
}).passthrough()

const PressReleaseInputSchema = z.object({
  title: z.string().trim().min(1),
  content: PressReleaseContentSchema,
  version: z.number().int().positive().optional(),
})

const testData = {
  title: "Test Title",
  content: { type: "doc" },
  version: 1
}

console.log('Testing data:', JSON.stringify(testData, null, 2))

const result = PressReleaseInputSchema.safeParse(testData)

if (result.success) {
  console.log('✅ Validation SUCCESS')
  console.log('Parsed data:', JSON.stringify(result.data, null, 2))
} else {
  console.log('❌ Validation FAILED')
  console.log('Errors:', JSON.stringify(result.error.format(), null, 2))
}
