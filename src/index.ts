/**
 * AIris Keeper — API key management for the age of AI agents.
 *
 * Library re-export for programmatic use (MCP tools, API server).
 */

export type { Budget, UsageEntry } from './budget.js'
// Budget
export { checkBudgetAlert, getBudget, getUsage, recordUsage, setBudget } from './budget.js'

// DB
export { getDb, resetDb } from './db.js'

// Provisioners
export { OpenAiProvisioner } from './provisioners/openai.js'
export { getProvider, listProviders, registerProvider } from './provisioners/registry.js'
export type { CreateKeyParams, ProvisionedKey, Provisioner } from './provisioners/types.js'
export type { EncryptedPayload } from './vault/crypto.js'
// Vault
export { decrypt, deriveTenantKey, encrypt, generateRootKey } from './vault/crypto.js'
export { injectAndRun } from './vault/injector.js'
export type { SecretMetadata, SecretWithValue } from './vault/store.js'
export { deleteSecret, getAllSecrets, getSecret, listSecrets, setSecret } from './vault/store.js'
