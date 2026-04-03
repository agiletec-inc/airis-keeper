import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Import the module fresh each test by using dynamic import
describe('env', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('validateEnv', () => {
    it('returns valid when all required vars are set', async () => {
      process.env.VAULT_ROOT_KEY = 'a'.repeat(32)
      process.env.SUPABASE_URL = 'https://supabase.example.com'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

      const { validateEnv } = await import('../src/env.js')
      const result = validateEnv()
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns errors when VAULT_ROOT_KEY is too short', async () => {
      process.env.VAULT_ROOT_KEY = 'short'
      process.env.SUPABASE_URL = 'https://supabase.example.com'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'

      const { validateEnv } = await import('../src/env.js')
      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('VAULT_ROOT_KEY'))).toBe(true)
    })

    it('returns errors when SUPABASE_URL is invalid', async () => {
      process.env.VAULT_ROOT_KEY = 'a'.repeat(32)
      process.env.SUPABASE_URL = 'not-a-url'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'

      const { validateEnv } = await import('../src/env.js')
      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('SUPABASE_URL'))).toBe(true)
    })

    it('returns errors when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      process.env.VAULT_ROOT_KEY = 'a'.repeat(32)
      process.env.SUPABASE_URL = 'https://supabase.example.com'
      process.env.SUPABASE_SERVICE_ROLE_KEY = undefined

      const { validateEnv } = await import('../src/env.js')
      const result = validateEnv()
      expect(result.valid).toBe(false)
    })

    it('OPENAI_ADMIN_API_KEY is optional', async () => {
      process.env.VAULT_ROOT_KEY = 'a'.repeat(32)
      process.env.SUPABASE_URL = 'https://supabase.example.com'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
      process.env.OPENAI_ADMIN_API_KEY = undefined

      const { validateEnv } = await import('../src/env.js')
      const result = validateEnv()
      expect(result.valid).toBe(true)
    })
  })
})
