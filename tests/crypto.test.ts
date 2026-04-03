import { describe, expect, it } from 'vitest'
import { decrypt, deriveTenantKey, encrypt, generateRootKey } from '../src/vault/crypto'

describe('crypto', () => {
  const rootKey = generateRootKey()
  const orgId = 'test-org-123'
  const tenantKey = deriveTenantKey(rootKey, orgId)

  describe('encrypt/decrypt round-trip', () => {
    it('encrypts and decrypts a simple string', () => {
      const plaintext = 'sk-test-1234567890'
      const encrypted = encrypt(plaintext, tenantKey)
      const decrypted = decrypt(encrypted, tenantKey)
      expect(decrypted).toBe(plaintext)
    })

    it('encrypts and decrypts an empty string', () => {
      const plaintext = ''
      const encrypted = encrypt(plaintext, tenantKey)
      const decrypted = decrypt(encrypted, tenantKey)
      expect(decrypted).toBe(plaintext)
    })

    it('encrypts and decrypts unicode content', () => {
      const plaintext = 'こんにちは世界 🔐 postgres://user:p@ss@host:5432/db'
      const encrypted = encrypt(plaintext, tenantKey)
      const decrypted = decrypt(encrypted, tenantKey)
      expect(decrypted).toBe(plaintext)
    })

    it('encrypts and decrypts a long value', () => {
      const plaintext = 'x'.repeat(10000)
      const encrypted = encrypt(plaintext, tenantKey)
      const decrypted = decrypt(encrypted, tenantKey)
      expect(decrypted).toBe(plaintext)
    })
  })

  describe('encryption properties', () => {
    it('produces different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'same-secret'
      const a = encrypt(plaintext, tenantKey)
      const b = encrypt(plaintext, tenantKey)
      expect(a.ciphertext).not.toBe(b.ciphertext)
      expect(a.iv).not.toBe(b.iv)
    })

    it('returns base64-encoded fields', () => {
      const encrypted = encrypt('test', tenantKey)
      expect(() => Buffer.from(encrypted.ciphertext, 'base64')).not.toThrow()
      expect(() => Buffer.from(encrypted.iv, 'base64')).not.toThrow()
      expect(() => Buffer.from(encrypted.authTag, 'base64')).not.toThrow()
    })

    it('IV is 12 bytes (96-bit)', () => {
      const encrypted = encrypt('test', tenantKey)
      expect(Buffer.from(encrypted.iv, 'base64').length).toBe(12)
    })

    it('auth tag is 16 bytes (128-bit)', () => {
      const encrypted = encrypt('test', tenantKey)
      expect(Buffer.from(encrypted.authTag, 'base64').length).toBe(16)
    })
  })

  describe('tamper detection', () => {
    it('throws on modified ciphertext', () => {
      const encrypted = encrypt('secret', tenantKey)
      const tampered = Buffer.from(encrypted.ciphertext, 'base64')
      tampered[0] ^= 0xff
      encrypted.ciphertext = tampered.toString('base64')
      expect(() => decrypt(encrypted, tenantKey)).toThrow()
    })

    it('throws on modified auth tag', () => {
      const encrypted = encrypt('secret', tenantKey)
      const tampered = Buffer.from(encrypted.authTag, 'base64')
      tampered[0] ^= 0xff
      encrypted.authTag = tampered.toString('base64')
      expect(() => decrypt(encrypted, tenantKey)).toThrow()
    })

    it('throws on wrong key', () => {
      const encrypted = encrypt('secret', tenantKey)
      const wrongKey = deriveTenantKey(rootKey, 'different-org')
      expect(() => decrypt(encrypted, wrongKey)).toThrow()
    })
  })

  describe('tenant key derivation', () => {
    it('produces 32-byte keys', () => {
      expect(tenantKey.length).toBe(32)
    })

    it('produces different keys for different orgs', () => {
      const keyA = deriveTenantKey(rootKey, 'org-a')
      const keyB = deriveTenantKey(rootKey, 'org-b')
      expect(keyA.equals(keyB)).toBe(false)
    })

    it('produces different keys for different root keys', () => {
      const keyA = deriveTenantKey('root-key-a'.padEnd(32, '0'), orgId)
      const keyB = deriveTenantKey('root-key-b'.padEnd(32, '0'), orgId)
      expect(keyA.equals(keyB)).toBe(false)
    })

    it('is deterministic', () => {
      const keyA = deriveTenantKey(rootKey, orgId)
      const keyB = deriveTenantKey(rootKey, orgId)
      expect(keyA.equals(keyB)).toBe(true)
    })
  })

  describe('generateRootKey', () => {
    it('generates a 64-char hex string (256-bit)', () => {
      const key = generateRootKey()
      expect(key.length).toBe(64)
      expect(/^[0-9a-f]+$/.test(key)).toBe(true)
    })

    it('generates unique keys', () => {
      const keys = new Set(Array.from({ length: 10 }, () => generateRootKey()))
      expect(keys.size).toBe(10)
    })
  })
})
