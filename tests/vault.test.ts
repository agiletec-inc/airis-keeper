import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock modules before any imports that use them
vi.mock('../src/db', () => {
  const mockDb = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  }
  return { getDb: () => mockDb }
})

vi.mock('../src/env', () => ({
  getEnv: () => ({
    VAULT_ROOT_KEY: '0'.repeat(64),
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  }),
}))

import { getDb } from '../src/db'
import { deleteSecret, getSecret, listSecrets, setSecret } from '../src/vault/store'

describe('vault store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setSecret', () => {
    it('inserts a new secret when none exists', async () => {
      const db = getDb() as ReturnType<typeof vi.fn> & Record<string, ReturnType<typeof vi.fn>>

      // First query: check existing → not found
      const selectChain = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }
      selectChain.eq.mockReturnValue(selectChain)

      // Second query: insert → success
      const insertChain = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-id',
              key: 'DB_URL',
              environment: 'dev',
              folder: null,
              version: 1,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          }),
        }),
      }

      let callCount = 0
      ;(db.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return { select: vi.fn().mockReturnValue(selectChain) }
        }
        return { insert: vi.fn().mockReturnValue(insertChain) }
      })

      const result = await setSecret({
        organizationId: 'org-1',
        key: 'DB_URL',
        value: 'postgres://localhost:5432/mydb',
        environment: 'dev',
      })

      expect(result.key).toBe('DB_URL')
      expect(result.version).toBe(1)
      expect(result.environment).toBe('dev')
    })
  })

  describe('getSecret', () => {
    it('returns null when secret not found', async () => {
      const db = getDb() as ReturnType<typeof vi.fn> & Record<string, ReturnType<typeof vi.fn>>

      const chain = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      chain.eq.mockReturnValue(chain)

      ;(db.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue(chain),
      })

      const result = await getSecret({
        organizationId: 'org-1',
        key: 'NONEXISTENT',
        environment: 'dev',
      })

      expect(result).toBeNull()
    })
  })

  describe('listSecrets', () => {
    it('returns empty array when no secrets exist', async () => {
      const db = getDb() as ReturnType<typeof vi.fn> & Record<string, ReturnType<typeof vi.fn>>

      const chain = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      chain.eq.mockReturnValue(chain)

      ;(db.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue(chain),
      })

      const result = await listSecrets({
        organizationId: 'org-1',
        environment: 'dev',
      })

      expect(result).toEqual([])
    })
  })

  describe('deleteSecret', () => {
    it('returns true when secret is deleted', async () => {
      const db = getDb() as ReturnType<typeof vi.fn> & Record<string, ReturnType<typeof vi.fn>>

      const chain = {
        eq: vi.fn().mockReturnThis(),
      }
      let eqCallCount = 0
      chain.eq.mockImplementation(() => {
        eqCallCount++
        if (eqCallCount >= 3) {
          return Promise.resolve({ error: null, count: 1 })
        }
        return chain
      })

      ;(db.from as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: vi.fn().mockReturnValue(chain),
      })

      const result = await deleteSecret({
        organizationId: 'org-1',
        key: 'OLD_KEY',
        environment: 'dev',
      })

      expect(result).toBe(true)
    })
  })
})
