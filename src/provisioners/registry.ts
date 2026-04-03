/**
 * Provider registry — maps provider names to Provisioner implementations.
 */

import type { Provisioner } from './types.js'

const providers = new Map<string, Provisioner>()

export function registerProvider(provisioner: Provisioner): void {
  providers.set(provisioner.name, provisioner)
}

export function getProvider(name: string): Provisioner {
  const provider = providers.get(name)
  if (!provider) {
    const available = [...providers.keys()].join(', ') || 'none'
    throw new Error(`Unknown provider "${name}". Available: ${available}`)
  }
  return provider
}

export function listProviders(): string[] {
  return [...providers.keys()]
}
