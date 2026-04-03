/**
 * CLI commands for environment management.
 */

import type { Command } from 'commander'

const ENVIRONMENTS = ['dev', 'stg', 'prd'] as const

export function registerEnvCommands(program: Command): void {
  const env = program.command('env').description('Manage environments')

  env
    .command('list')
    .description('List available environments')
    .action(() => {
      process.stdout.write('Available environments:\n')
      for (const e of ENVIRONMENTS) {
        process.stdout.write(`  ${e}\n`)
      }
    })
}
