import { z } from 'zod/v3'

// Adapt these business DTOs to the requested feature; keep the host envelope in provider.ts.
export const inputSchema = z.object({ value: z.string() }).strict()
export const outputSchema = z.union([
  z.object({ ok: z.literal(true), value: z.string() }).strict(),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }).strict() }).strict()
])
export type Output = z.infer<typeof outputSchema>
