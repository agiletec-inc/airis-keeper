#!/usr/bin/env node
/**
 * keeper — AIris Keeper CLI
 *
 * API key management for the age of AI agents.
 */

import { Command } from 'commander'
import { registerBudgetCommands } from './commands/budget.js'
import { registerEnvCommands } from './commands/env.js'
import { registerProvisionCommands } from './commands/provision.js'
import { registerSecretCommands } from './commands/secret.js'
import { OpenAiProvisioner } from './provisioners/openai.js'
import { registerProvider } from './provisioners/registry.js'

const program = new Command()

program
  .name('keeper')
  .description('AIris Keeper — API key management for the age of AI agents')
  .version('0.1.0')
  .option('-o, --org <organizationId>', 'Organization ID', process.env.KEEPER_ORGANIZATION_ID)

function getOrgId(): string {
  const orgId = program.opts().org
  if (!orgId) {
    process.stderr.write('Organization ID required. Use --org or set KEEPER_ORGANIZATION_ID\n')
    process.exit(1)
  }
  return orgId
}

// Register providers
if (process.env.OPENAI_ADMIN_API_KEY && process.env.OPENAI_PROJECT_ID) {
  registerProvider(new OpenAiProvisioner(process.env.OPENAI_PROJECT_ID))
}

// Register command groups
registerSecretCommands(program, getOrgId)
registerProvisionCommands(program, getOrgId)
registerBudgetCommands(program, getOrgId)
registerEnvCommands(program)

process.on('unhandledRejection', (reason: unknown) => {
  const error = reason as { message?: string }
  process.stderr.write(`Error: ${error?.message || reason}\n`)
  process.exit(1)
})

program.parse()
