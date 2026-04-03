/**
 * Vault Store — encrypted secret CRUD backed by Supabase.
 *
 * All values are encrypted before storage and decrypted on retrieval.
 * Supports environment-scoped secrets (dev/stg/prd) and folder grouping.
 */

import { getDb } from '../db.js'
import { getEnv } from '../env.js'
import type { EncryptedPayload } from './crypto.js'
import { decrypt, deriveTenantKey, encrypt } from './crypto.js'

export type SecretMetadata = {
  id: string
  key: string
  environment: string
  folder: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type SecretWithValue = SecretMetadata & {
  value: string
}

function getTenantKey(organizationId: string): Buffer {
  return deriveTenantKey(getEnv().VAULT_ROOT_KEY, organizationId)
}

/**
 * Store an encrypted secret. Creates or updates (bumps version).
 */
export async function setSecret(params: {
  organizationId: string
  key: string
  value: string
  environment?: string
  folder?: string
}): Promise<SecretMetadata> {
  const { organizationId, key, value, environment = 'dev', folder = null } = params
  const tenantKey = getTenantKey(organizationId)
  const payload = encrypt(value, tenantKey)

  const db = getDb()

  // Upsert: if key+env+org exists, bump version
  const { data: existing } = await db
    .from('akm_secrets')
    .select('id, version')
    .eq('organization_id', organizationId)
    .eq('key', key)
    .eq('environment', environment)
    .maybeSingle()

  if (existing) {
    const { data, error } = await db
      .from('akm_secrets')
      .update({
        encrypted_value: payload.ciphertext,
        iv: payload.iv,
        auth_tag: payload.authTag,
        folder,
        version: existing.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, key, environment, folder, version, created_at, updated_at')
      .single()

    if (error) throw new Error(`Failed to update secret: ${error.message}`)
    return mapRow(data)
  }

  const { data, error } = await db
    .from('akm_secrets')
    .insert({
      organization_id: organizationId,
      key,
      encrypted_value: payload.ciphertext,
      iv: payload.iv,
      auth_tag: payload.authTag,
      environment,
      folder,
      version: 1,
    })
    .select('id, key, environment, folder, version, created_at, updated_at')
    .single()

  if (error) throw new Error(`Failed to set secret: ${error.message}`)
  return mapRow(data)
}

/**
 * Retrieve and decrypt a secret.
 */
export async function getSecret(params: {
  organizationId: string
  key: string
  environment?: string
}): Promise<SecretWithValue | null> {
  const { organizationId, key, environment = 'dev' } = params
  const db = getDb()

  const { data, error } = await db
    .from('akm_secrets')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('key', key)
    .eq('environment', environment)
    .maybeSingle()

  if (error) throw new Error(`Failed to get secret: ${error.message}`)
  if (!data) return null

  const tenantKey = getTenantKey(organizationId)
  const payload: EncryptedPayload = {
    ciphertext: data.encrypted_value,
    iv: data.iv,
    authTag: data.auth_tag,
  }

  return {
    ...mapRow(data),
    value: decrypt(payload, tenantKey),
  }
}

/**
 * List secret metadata (without values) for an organization/environment.
 */
export async function listSecrets(params: {
  organizationId: string
  environment?: string
  folder?: string
}): Promise<SecretMetadata[]> {
  const { organizationId, environment, folder } = params
  const db = getDb()

  let query = db
    .from('akm_secrets')
    .select('id, key, environment, folder, version, created_at, updated_at')
    .eq('organization_id', organizationId)

  if (environment) query = query.eq('environment', environment)
  if (folder) query = query.eq('folder', folder)

  const { data, error } = await query.order('key')

  if (error) throw new Error(`Failed to list secrets: ${error.message}`)
  return (data ?? []).map(mapRow)
}

/**
 * Delete a secret.
 */
export async function deleteSecret(params: {
  organizationId: string
  key: string
  environment?: string
}): Promise<boolean> {
  const { organizationId, key, environment = 'dev' } = params
  const db = getDb()

  const { error, count } = await db
    .from('akm_secrets')
    .delete({ count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('key', key)
    .eq('environment', environment)

  if (error) throw new Error(`Failed to delete secret: ${error.message}`)
  return (count ?? 0) > 0
}

/**
 * Retrieve all secrets for an environment, decrypted — for injection.
 */
export async function getAllSecrets(params: {
  organizationId: string
  environment?: string
}): Promise<Record<string, string>> {
  const { organizationId, environment = 'dev' } = params
  const db = getDb()

  const { data, error } = await db
    .from('akm_secrets')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('environment', environment)

  if (error) throw new Error(`Failed to get all secrets: ${error.message}`)
  if (!data?.length) return {}

  const tenantKey = getTenantKey(organizationId)
  const result: Record<string, string> = {}

  for (const row of data) {
    const payload: EncryptedPayload = {
      ciphertext: row.encrypted_value,
      iv: row.iv,
      authTag: row.auth_tag,
    }
    result[row.key] = decrypt(payload, tenantKey)
  }

  return result
}

function mapRow(row: Record<string, unknown>): SecretMetadata {
  return {
    id: row.id as string,
    key: row.key as string,
    environment: row.environment as string,
    folder: (row.folder as string) ?? null,
    version: row.version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
