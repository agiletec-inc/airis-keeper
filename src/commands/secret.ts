/**
 * CLI commands for vault secret management.
 */

import type { Command } from 'commander'
import { injectAndRun } from '../vault/injector.js'
import { deleteSecret, getSecret, listSecrets, setSecret } from '../vault/store.js'

export function registerSecretCommands(program: Command, getOrgId: () => string): void {
  const secret = program.command('secret').description('Manage encrypted secrets in the vault')

  secret
    .command('set <key> <value>')
    .description('Store an encrypted secret')
    .option('-e, --env <environment>', 'Environment (dev/stg/prd)', 'dev')
    .option('-f, --folder <folder>', 'Logical folder/group')
    .action(async (key: string, value: string, options) => {
      const result = await setSecret({
        organizationId: getOrgId(),
        key,
        value,
        environment: options.env,
        folder: options.folder,
      })
      process.stdout.write(`Secret "${key}" set (v${result.version}, env=${result.environment})\n`)
    })

  secret
    .command('get <key>')
    .description('Retrieve and decrypt a secret')
    .option('-e, --env <environment>', 'Environment (dev/stg/prd)', 'dev')
    .action(async (key: string, options) => {
      const result = await getSecret({
        organizationId: getOrgId(),
        key,
        environment: options.env,
      })
      if (!result) {
        process.stderr.write(`Secret "${key}" not found in env=${options.env}\n`)
        process.exit(1)
      }
      process.stdout.write(`${result.value}\n`)
    })

  secret
    .command('list')
    .description('List secret keys (without values)')
    .option('-e, --env <environment>', 'Environment filter')
    .option('-f, --folder <folder>', 'Folder filter')
    .action(async (options) => {
      const secrets = await listSecrets({
        organizationId: getOrgId(),
        environment: options.env,
        folder: options.folder,
      })

      if (secrets.length === 0) {
        process.stdout.write('No secrets found\n')
        return
      }

      process.stdout.write(`${'KEY'.padEnd(30)} ${'ENV'.padEnd(5)} ${'VER'.padEnd(5)} FOLDER\n`)
      process.stdout.write(
        `${'─'.repeat(30)} ${'─'.repeat(5)} ${'─'.repeat(5)} ${'─'.repeat(15)}\n`,
      )
      for (const s of secrets) {
        process.stdout.write(
          `${s.key.padEnd(30)} ${s.environment.padEnd(5)} v${String(s.version).padEnd(4)} ${s.folder ?? ''}\n`,
        )
      }
    })

  secret
    .command('delete <key>')
    .description('Delete a secret')
    .option('-e, --env <environment>', 'Environment (dev/stg/prd)', 'dev')
    .action(async (key: string, options) => {
      const deleted = await deleteSecret({
        organizationId: getOrgId(),
        key,
        environment: options.env,
      })
      if (deleted) {
        process.stdout.write(`Secret "${key}" deleted from env=${options.env}\n`)
      } else {
        process.stderr.write(`Secret "${key}" not found in env=${options.env}\n`)
        process.exit(1)
      }
    })

  // `keeper run -- <command>` for secret injection
  program
    .command('run')
    .description('Run a command with vault secrets injected as environment variables')
    .option('-e, --env <environment>', 'Environment (dev/stg/prd)', 'dev')
    .argument('<command...>', 'Command to execute')
    .action(async (command: string[], options) => {
      const exitCode = await injectAndRun({
        organizationId: getOrgId(),
        environment: options.env,
        command,
      })
      process.exit(exitCode)
    })
}
