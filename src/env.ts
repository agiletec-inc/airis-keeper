/**
 * Environment configuration for API Key Manager.
 * All secrets come from Doppler — never hardcoded.
 */

import { z } from 'zod'

const envSchema = z.object({
  VAULT_ROOT_KEY: z.string().min(32, 'VAULT_ROOT_KEY must be at least 32 characters (256-bit)'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_ADMIN_API_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv
  cachedEnv = envSchema.parse(process.env)
  return cachedEnv
}

/**
 * Validate env without caching — useful for CLI startup checks.
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
  const result = envSchema.safeParse(process.env)
  if (result.success) return { valid: true, errors: [] }
  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  }
}
