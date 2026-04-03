/**
 * Secret Injector — runs a child process with vault secrets injected as env vars.
 * Equivalent to `keeper run -- <command>`.
 */

import { spawn } from 'node:child_process'
import { getAllSecrets } from './store.js'

export type InjectOptions = {
  organizationId: string
  environment?: string
  /** Command and arguments to execute */
  command: string[]
}

/**
 * Execute a command with vault secrets injected into its environment.
 * Returns the exit code of the child process.
 */
export async function injectAndRun(options: InjectOptions): Promise<number> {
  const { organizationId, environment = 'dev', command } = options

  if (command.length === 0) {
    throw new Error('No command specified')
  }

  const secrets = await getAllSecrets({ organizationId, environment })

  const cmd = command[0] as string
  const args = command.slice(1)
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...secrets,
    },
  })

  return new Promise<number>((resolve, reject) => {
    child.on('close', (code: number | null) => resolve(code ?? 0))
    child.on('error', reject)
  })
}
