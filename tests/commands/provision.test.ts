import { describe, expect, it, vi } from 'vitest'

const mockCreateKey = vi.fn().mockResolvedValue({
  id: 'db-1',
  externalId: 'sa_test',
  provider: 'openai',
  name: 'Test Key',
  customerId: 'acme',
  keyPrefix: 'sk-...1234',
  rawKey: 'sk-full-key',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
})

const mockListKeys = vi.fn().mockResolvedValue([
  {
    id: 'db-1',
    externalId: 'sa_1',
    provider: 'openai',
    name: 'Key 1',
    customerId: 'acme',
    keyPrefix: 'sk-...1234',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  },
])

const mockRevokeKey = vi.fn().mockResolvedValue(undefined)

vi.mock('../../src/provisioners/registry', () => ({
  getProvider: () => ({
    name: 'openai',
    createKey: mockCreateKey,
    listKeys: mockListKeys,
    revokeKey: mockRevokeKey,
    rotateKey: vi.fn(),
  }),
}))

import { Command } from 'commander'
import { registerProvisionCommands } from '../../src/commands/provision'

describe('provision commands', () => {
  const getOrgId = () => 'test-org'

  function createProgram(): Command {
    const program = new Command()
    program.exitOverride()
    registerProvisionCommands(program, getOrgId)
    return program
  }

  it('creates a key with correct params', async () => {
    const program = createProgram()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync([
      'node',
      'keeper',
      'provision',
      'create',
      'openai',
      '--customer',
      'acme',
      '--name',
      'Production',
    ])

    expect(mockCreateKey).toHaveBeenCalledWith({
      customerId: 'acme',
      name: 'Production',
      organizationId: 'test-org',
    })

    writeSpy.mockRestore()
  })

  it('lists keys', async () => {
    const program = createProgram()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync(['node', 'keeper', 'provision', 'list', '--provider', 'openai'])

    expect(mockListKeys).toHaveBeenCalledWith('test-org', undefined)
    writeSpy.mockRestore()
  })

  it('revokes a key', async () => {
    const program = createProgram()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync([
      'node',
      'keeper',
      'provision',
      'revoke',
      'sa_test',
      '--provider',
      'openai',
    ])

    expect(mockRevokeKey).toHaveBeenCalledWith('sa_test')
    writeSpy.mockRestore()
  })
})
