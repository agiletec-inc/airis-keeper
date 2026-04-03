/**
 * AES-256-GCM encryption engine.
 *
 * Architecture (Infisical-style hierarchy):
 *   Root Key (Doppler) → derives Tenant Key → encrypts data
 *
 * - Algorithm: AES-256-GCM
 * - IV: 96-bit random (NIST recommendation for GCM)
 * - Auth Tag: 128-bit (GCM default)
 * - Key derivation: HKDF-SHA256 from root key + tenant salt
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit nonce (NIST SP 800-38D)
const AUTH_TAG_LENGTH = 16 // 128-bit

export type EncryptedPayload = {
  /** Base64-encoded ciphertext */
  ciphertext: string
  /** Base64-encoded initialization vector */
  iv: string
  /** Base64-encoded authentication tag */
  authTag: string
}

/**
 * Derive a tenant-specific 256-bit key from root key using HKDF-like construction.
 * Uses HMAC-SHA256(rootKey, "akm:tenant:" + organizationId) as key material.
 */
export function deriveTenantKey(rootKey: string, organizationId: string): Buffer {
  return createHmac('sha256', rootKey).update(`akm:tenant:${organizationId}`).digest()
}

/**
 * Encrypt plaintext using AES-256-GCM.
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Throws on tampered data (auth tag verification failure).
 */
export function decrypt(payload: EncryptedPayload, key: Buffer): string {
  const iv = Buffer.from(payload.iv, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Generate a cryptographically secure random key (256-bit).
 * Useful for generating root keys.
 */
export function generateRootKey(): string {
  return randomBytes(32).toString('hex')
}
