import { describe, expect, it, vi } from 'vitest'

// Must mock before importing command modules
vi.mock('../../src/vault/store', () => ({
  setSecret: vi.fn().mockResolvedValue({
    id: 'id-1',
    key: 'TEST_KEY',
    environment: 'dev',
    folder: null,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }),
  getSecret: vi.fn().mockResolvedValue({
    id: 'id-1',
    key: 'TEST_KEY',
    environment: 'dev',
    folder: null,
    version: 1,
    value: 'my-secret-value',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }),
  listSecrets: vi.fn().mockResolvedValue([
    {
      id: 'id-1',
      key: 'DB_URL',
      environment: 'dev',
      folder: null,
      version: 2,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'id-2',
      key: 'API_KEY',
      environment: 'dev',
      folder: 'external',
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ]),
  deleteSecret: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../src/vault/injector', () => ({
  injectAndRun: vi.fn().mockResolvedValue(0),
}))

import { Command } from 'commander'
import { registerSecretCommands } from '../../src/commands/secret'
import * as store from '../../src/vault/store'

describe('secret commands', () => {
  const getOrgId = () => 'test-org'

  function createProgram(): Command {
    const program = new Command()
    program.exitOverride()
    registerSecretCommands(program, getOrgId)
    return program
  }

  it('calls setSecret with correct params', async () => {
    const program = createProgram()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync([
      'node',
      'keeper',
      'secret',
      'set',
      'TEST_KEY',
      'my-value',
      '--env',
      'prd',
    ])

    expect(store.setSecret).toHaveBeenCalledWith({
      organizationId: 'test-org',
      key: 'TEST_KEY',
      value: 'my-value',
      environment: 'prd',
      folder: undefined,
    })

    writeSpy.mockRestore()
  })

  it('calls getSecret and outputs the value', async () => {
    const program = createProgram()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync(['node', 'keeper', 'secret', 'get', 'TEST_KEY'])

    expect(store.getSecret).toHaveBeenCalledWith({
      organizationId: 'test-org',
      key: 'TEST_KEY',
      environment: 'dev',
    })

    expect(writeSpy).toHaveBeenCalledWith('my-secret-value\n')
    writeSpy.mockRestore()
  })

  it('calls listSecrets and formats output', async () => {
    const program = createProgram()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync(['node', 'keeper', 'secret', 'list', '--env', 'dev'])

    expect(store.listSecrets).toHaveBeenCalledWith({
      organizationId: 'test-org',
      environment: 'dev',
      folder: undefined,
    })

    // Should have header + separator + 2 rows = at least 4 writes
    expect(writeSpy.mock.calls.length).toBeGreaterThanOrEqual(4)
    writeSpy.mockRestore()
  })

  it('calls deleteSecret with correct params', async () => {
    const program = createProgram()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync(['node', 'keeper', 'secret', 'delete', 'OLD_KEY', '--env', 'stg'])

    expect(store.deleteSecret).toHaveBeenCalledWith({
      organizationId: 'test-org',
      key: 'OLD_KEY',
      environment: 'stg',
    })

    writeSpy.mockRestore()
  })
})
