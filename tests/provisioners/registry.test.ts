import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProvider, listProviders, registerProvider } from '../../src/provisioners/registry.js'
import type { Provisioner } from '../../src/provisioners/types.js'

function createMockProvisioner(name: string): Provisioner {
  return {
    name,
    createKey: vi.fn(),
    revokeKey: vi.fn(),
    rotateKey: vi.fn(),
    listKeys: vi.fn(),
  }
}

describe('Provider Registry', () => {
  afterEach(() => {
    // Registry is a module-level Map, but we can't easily reset it
    // Tests should use unique provider names
  })

  describe('registerProvider', () => {
    it('registers a provider', () => {
      const provider = createMockProvisioner('test-register')
      registerProvider(provider)
      expect(getProvider('test-register')).toBe(provider)
    })

    it('overwrites an existing provider with same name', () => {
      const first = createMockProvisioner('test-overwrite')
      const second = createMockProvisioner('test-overwrite')
      registerProvider(first)
      registerProvider(second)
      expect(getProvider('test-overwrite')).toBe(second)
    })
  })

  describe('getProvider', () => {
    it('returns registered provider', () => {
      const provider = createMockProvisioner('test-get')
      registerProvider(provider)
      expect(getProvider('test-get')).toBe(provider)
    })

    it('throws for unknown provider with available list', () => {
      registerProvider(createMockProvisioner('test-known'))
      expect(() => getProvider('nonexistent')).toThrow('Unknown provider "nonexistent"')
      expect(() => getProvider('nonexistent')).toThrow('Available:')
    })
  })

  describe('listProviders', () => {
    it('returns registered provider names', () => {
      registerProvider(createMockProvisioner('test-list-a'))
      registerProvider(createMockProvisioner('test-list-b'))
      const list = listProviders()
      expect(list).toContain('test-list-a')
      expect(list).toContain('test-list-b')
    })
  })
})
