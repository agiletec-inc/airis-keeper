/**
 * Provisioner interface — all API key providers must implement this.
 *
 * Each provisioner handles key lifecycle (create/revoke/rotate/list)
 * for a specific provider (OpenAI, Anthropic, etc.).
 */

export type ProvisionedKey = {
  /** Internal DB ID */
  id?: string
  /** Provider-specific external key ID */
  externalId: string
  /** Provider name (e.g., "openai") */
  provider: string
  /** Human-readable name */
  name: string
  /** Customer/tenant identifier */
  customerId: string
  /** Key prefix for identification (e.g., "sk-proj-...abc") */
  keyPrefix: string
  /** The raw API key — only available at creation time */
  rawKey?: string
  /** Key status */
  status: 'active' | 'revoked' | 'expired'
  /** ISO timestamp */
  createdAt: string
}

export type CreateKeyParams = {
  customerId: string
  name: string
  /** Organization ID for multi-tenant isolation */
  organizationId: string
  /** Permission scope (e.g., "chat:gpt-4o", "embeddings:*") */
  scope?: string
  /** Monthly budget cap in USD */
  budgetUsd?: number
  /** Time-to-live (e.g., "24h", "7d") — key auto-expires after TTL */
  ttl?: string
}

export type Provisioner = {
  readonly name: string

  /** Create a new API key for a customer */
  createKey(params: CreateKeyParams): Promise<ProvisionedKey>

  /** Revoke an existing API key */
  revokeKey(externalId: string): Promise<void>

  /** Rotate: revoke old key, create new one */
  rotateKey(externalId: string, params: CreateKeyParams): Promise<ProvisionedKey>

  /** List keys, optionally filtered by customer */
  listKeys(organizationId: string, customerId?: string): Promise<ProvisionedKey[]>
}
