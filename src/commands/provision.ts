/**
 * CLI commands for API key provisioning.
 */

import type { Command } from 'commander'
import { getProvider } from '../provisioners/registry.js'

export function registerProvisionCommands(program: Command, getOrgId: () => string): void {
  const provision = program
    .command('provision')
    .description('Provision and manage API keys for customers')

  provision
    .command('create <provider>')
    .description('Create a new API key for a customer')
    .requiredOption('-c, --customer <customerId>', 'Customer identifier')
    .requiredOption('-n, --name <name>', 'Key name/description')
    .action(async (providerName: string, options) => {
      const provisioner = getProvider(providerName)
      const result = await provisioner.createKey({
        customerId: options.customer,
        name: options.name,
        organizationId: getOrgId(),
      })

      process.stdout.write(`Key provisioned successfully:\n`)
      process.stdout.write(`  Provider:    ${result.provider}\n`)
      process.stdout.write(`  Customer:    ${result.customerId}\n`)
      process.stdout.write(`  External ID: ${result.externalId}\n`)
      process.stdout.write(`  Key Prefix:  ${result.keyPrefix}\n`)
      if (result.rawKey) {
        process.stdout.write(`  Raw Key:     ${result.rawKey}\n`)
        process.stdout.write(
          `\n  (This is the only time the raw key is shown. It's stored encrypted in the vault.)\n`
        )
      }
    })

  provision
    .command('list')
    .description('List provisioned keys')
    .option('-c, --customer <customerId>', 'Filter by customer')
    .option('-p, --provider <provider>', 'Filter by provider')
    .action(async (options) => {
      const providerNames = options.provider ? [options.provider] : ['openai']

      for (const providerName of providerNames) {
        let provisioner
        try {
          provisioner = getProvider(providerName)
        } catch {
          continue
        }

        const keys = await provisioner.listKeys(getOrgId(), options.customer)

        if (keys.length === 0) {
          process.stdout.write(`No keys found for provider "${providerName}"\n`)
          continue
        }

        process.stdout.write(`\n${providerName.toUpperCase()} Keys:\n`)
        process.stdout.write(
          `${'CUSTOMER'.padEnd(20)} ${'NAME'.padEnd(20)} ${'PREFIX'.padEnd(25)} ${'STATUS'.padEnd(10)} CREATED\n`
        )
        process.stdout.write(`${'─'.repeat(95)}\n`)

        for (const key of keys) {
          process.stdout.write(
            `${key.customerId.padEnd(20)} ${key.name.padEnd(20)} ${key.keyPrefix.padEnd(25)} ${key.status.padEnd(10)} ${key.createdAt.slice(0, 10)}\n`
          )
        }
      }
    })

  provision
    .command('revoke <externalId>')
    .description('Revoke an API key')
    .requiredOption('-p, --provider <provider>', 'Provider name')
    .action(async (externalId: string, options) => {
      const provisioner = getProvider(options.provider)
      await provisioner.revokeKey(externalId)
      process.stdout.write(`Key ${externalId} revoked\n`)
    })

  provision
    .command('rotate <externalId>')
    .description('Rotate an API key (revoke + create new)')
    .requiredOption('-p, --provider <provider>', 'Provider name')
    .requiredOption('-c, --customer <customerId>', 'Customer identifier')
    .requiredOption('-n, --name <name>', 'New key name')
    .action(async (externalId: string, options) => {
      const provisioner = getProvider(options.provider)
      const result = await provisioner.rotateKey(externalId, {
        customerId: options.customer,
        name: options.name,
        organizationId: getOrgId(),
      })

      process.stdout.write(`Key rotated:\n`)
      process.stdout.write(`  Old key revoked: ${externalId}\n`)
      process.stdout.write(`  New External ID: ${result.externalId}\n`)
      process.stdout.write(`  New Key Prefix:  ${result.keyPrefix}\n`)
      if (result.rawKey) {
        process.stdout.write(`  New Raw Key:     ${result.rawKey}\n`)
      }
    })
}
