/**
 * OpenAI Admin API provisioner.
 *
 * Strategy: shared project, per-customer service accounts.
 * - OpenAI has a 100-project limit → can't create per-customer projects
 * - Instead, create service accounts within a shared project
 * - Track customer<->SA mapping in our DB
 *
 * Admin API docs: https://platform.openai.com/docs/api-reference/administration
 */

import { getDb } from '../db.js'
import { getEnv } from '../env.js'
import { deriveTenantKey, encrypt } from '../vault/crypto.js'
import type { CreateKeyParams, ProvisionedKey, Provisioner } from './types.js'

const ADMIN_API_BASE = 'https://api.openai.com/v1/organization'

type OpenAiServiceAccount = {
  id: string
  name: string
  role: string
  created_at: number
}

type OpenAiApiKey = {
  id: string
  name: string
  value: string
  created_at: number
  redacted_value: string
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const env = getEnv()
  if (!env.OPENAI_ADMIN_API_KEY) {
    throw new Error('OPENAI_ADMIN_API_KEY is not configured')
  }

  const response = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.OPENAI_ADMIN_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI Admin API error ${response.status}: ${body}`)
  }

  return response.json() as Promise<T>
}

export class OpenAiProvisioner implements Provisioner {
  readonly name = 'openai'

  private projectId: string

  constructor(projectId: string) {
    this.projectId = projectId
  }

  async createKey(params: CreateKeyParams): Promise<ProvisionedKey> {
    const { customerId, name, organizationId } = params
    const saName = `akm-${customerId}-${Date.now()}`

    // 1. Create service account in the shared project
    const sa = await adminFetch<{ object: string } & OpenAiServiceAccount>(
      `/projects/${this.projectId}/service_accounts`,
      {
        method: 'POST',
        body: JSON.stringify({ name: saName }),
      }
    )

    // 2. Create API key for the service account
    const apiKey = await adminFetch<OpenAiApiKey>(
      `/projects/${this.projectId}/service_accounts/${sa.id}/api_keys`,
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      }
    )

    // 3. Encrypt and store the raw key in vault
    const tenantKey = deriveTenantKey(getEnv().VAULT_ROOT_KEY, organizationId)
    const encrypted = encrypt(apiKey.value, tenantKey)

    const db = getDb()
    const { data, error } = await db
      .from('akm_provisioned_keys')
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        provider: this.name,
        external_id: sa.id,
        api_key_external_id: apiKey.id,
        key_prefix: apiKey.redacted_value,
        name,
        status: 'active',
        encrypted_raw_key: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        provider_metadata: { projectId: this.projectId, saName },
      })
      .select('id, created_at')
      .single()

    if (error) throw new Error(`Failed to store provisioned key: ${error.message}`)

    // 4. Audit log
    await db.from('akm_audit_logs').insert({
      organization_id: organizationId,
      actor: 'system',
      action: 'provision.create',
      target: `${this.name}:${sa.id}`,
      metadata: { customerId, name, keyPrefix: apiKey.redacted_value },
    })

    return {
      id: data.id,
      externalId: sa.id,
      provider: this.name,
      name,
      customerId,
      keyPrefix: apiKey.redacted_value,
      rawKey: apiKey.value,
      status: 'active',
      createdAt: data.created_at,
    }
  }

  async revokeKey(externalId: string): Promise<void> {
    const db = getDb()

    // Get key info from DB
    const { data: keyRecord, error: fetchError } = await db
      .from('akm_provisioned_keys')
      .select('*')
      .eq('external_id', externalId)
      .eq('provider', this.name)
      .single()

    if (fetchError || !keyRecord) {
      throw new Error(`Key not found: ${externalId}`)
    }

    // Delete the API key via Admin API
    if (keyRecord.api_key_external_id) {
      await adminFetch(
        `/projects/${this.projectId}/service_accounts/${externalId}/api_keys/${keyRecord.api_key_external_id}`,
        { method: 'DELETE' }
      )
    }

    // Update status in DB
    await db
      .from('akm_provisioned_keys')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('external_id', externalId)

    // Audit log
    await db.from('akm_audit_logs').insert({
      organization_id: keyRecord.organization_id,
      actor: 'system',
      action: 'provision.revoke',
      target: `${this.name}:${externalId}`,
      metadata: { customerId: keyRecord.customer_id },
    })
  }

  async rotateKey(externalId: string, params: CreateKeyParams): Promise<ProvisionedKey> {
    await this.revokeKey(externalId)
    return this.createKey(params)
  }

  async listKeys(organizationId: string, customerId?: string): Promise<ProvisionedKey[]> {
    const db = getDb()

    let query = db
      .from('akm_provisioned_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('provider', this.name)

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to list keys: ${error.message}`)

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      externalId: row.external_id as string,
      provider: this.name,
      name: row.name as string,
      customerId: row.customer_id as string,
      keyPrefix: row.key_prefix as string,
      status: row.status as 'active' | 'revoked' | 'expired',
      createdAt: row.created_at as string,
    }))
  }
}
