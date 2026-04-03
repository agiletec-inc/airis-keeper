import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAiProvisioner } from '../../src/provisioners/openai'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock DB
const mockDbInsert = vi.fn()
const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()

vi.mock('../../src/db', () => ({
  getDb: () => ({
    from: (table: string) => {
      if (table === 'akm_audit_logs') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {
        insert: mockDbInsert,
        select: mockDbSelect,
        update: mockDbUpdate,
      }
    },
  }),
}))

vi.mock('../../src/env', () => ({
  getEnv: () => ({
    VAULT_ROOT_KEY: '0'.repeat(64),
    OPENAI_ADMIN_API_KEY: 'admin-key-test',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  }),
}))

describe('OpenAiProvisioner', () => {
  const provisioner = new OpenAiProvisioner('proj_test123')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createKey', () => {
    it('creates a service account and API key via Admin API', async () => {
      // Mock: create service account
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'sa_test123',
            name: 'akm-acme-corp-1234',
            role: 'member',
            created_at: 1700000000,
          }),
        })
        // Mock: create API key
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'key_test456',
            name: 'Production',
            value: 'sk-proj-abcdef1234567890',
            redacted_value: 'sk-proj-...7890',
            created_at: 1700000000,
          }),
        })

      // Mock: DB insert for provisioned key
      mockDbInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'db-id-1', created_at: '2026-01-01T00:00:00Z' },
            error: null,
          }),
        }),
      })

      const result = await provisioner.createKey({
        customerId: 'acme-corp',
        name: 'Production',
        organizationId: 'org-1',
      })

      expect(result.provider).toBe('openai')
      expect(result.customerId).toBe('acme-corp')
      expect(result.externalId).toBe('sa_test123')
      expect(result.rawKey).toBe('sk-proj-abcdef1234567890')
      expect(result.keyPrefix).toBe('sk-proj-...7890')
      expect(result.status).toBe('active')

      // Verify Admin API calls
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch.mock.calls[0][0]).toContain('/service_accounts')
      expect(mockFetch.mock.calls[1][0]).toContain('/api_keys')
    })

    it('throws when Admin API returns an error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      })

      await expect(
        provisioner.createKey({
          customerId: 'acme-corp',
          name: 'Test',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow('OpenAI Admin API error 403')
    })
  })

  describe('listKeys', () => {
    it('returns provisioned keys from database', async () => {
      const mockChain = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'db-1',
              external_id: 'sa_1',
              name: 'Key 1',
              customer_id: 'acme',
              key_prefix: 'sk-...1234',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      }
      mockChain.eq.mockReturnValue(mockChain)

      mockDbSelect.mockReturnValue(mockChain)

      const keys = await provisioner.listKeys('org-1', 'acme')

      expect(keys).toHaveLength(1)
      expect(keys[0].provider).toBe('openai')
      expect(keys[0].customerId).toBe('acme')
      expect(keys[0].status).toBe('active')
    })
  })

  describe('revokeKey', () => {
    it('revokes via Admin API and updates DB status', async () => {
      // Mock: DB fetch key record
      const fetchChain = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'db-1',
            external_id: 'sa_1',
            api_key_external_id: 'key_1',
            organization_id: 'org-1',
            customer_id: 'acme',
          },
          error: null,
        }),
      }
      fetchChain.eq.mockReturnValue(fetchChain)
      mockDbSelect.mockReturnValue(fetchChain)

      // Mock: Admin API delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      // Mock: DB update status
      const updateChain = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
      mockDbUpdate.mockReturnValue(updateChain)

      await provisioner.revokeKey('sa_1')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toContain('/api_keys/key_1')
      expect(mockFetch.mock.calls[0][1]?.method).toBe('DELETE')
    })
  })
})
