# AIris Keeper

**API key management for the age of AI agents.**

AIris Keeper manages API keys for LLM-powered development workflows. Instead of hiding secrets, it minimizes the blast radius when keys leak — because in the age of AI agents, they will.

## Core Principles

- **Damage control over secrecy** — Budget caps, short-lived keys, and automatic rotation mean a leaked key is worth nothing
- **Key granularity** — Automatically isolate keys by project, environment, and scope. One leak affects nothing else
- **Agent-native** — Built for Claude Code, Codex, Cursor, and other AI coding agents to use directly via CLI
- **Doppler-simple, not Infisical-complex** — Minimal surface area, maximum utility

## Features

- **Vault** — AES-256-GCM encrypted secret storage with environment scoping (dev/stg/prd)
- **Provisioners** — Automatic API key creation via provider Admin APIs (OpenAI, more coming)
- **Budget** — Per-customer monthly spending limits with alerts
- **Rotation** — Atomic key rotation: revoke old, create new, update environment in one command
- **Injection** — Run commands with secrets injected as environment variables
- **Audit** — Full audit log of all key operations

## Quick Start

```bash
npx airis-keeper --help
```

### Setup

```bash
# Initialize from your .env.example
keeper init --from .env.example

# Connect a provider
keeper provider add openai

# Provision a key with budget cap and TTL
keeper provision --project myapp --env staging \
  --provider openai --scope "chat:gpt-4o" \
  --budget 10 --ttl 24h
```

### Daily Usage

```bash
# Inject secrets and run your app
keeper run --project myapp --env staging -- node server.js

# Check status across all projects
keeper status

# Rotate keys atomically
keeper rotate --project myapp --env prod
```

### Secret Management

```bash
# Store encrypted secrets
keeper secret set API_KEY sk-xxx --env prod
keeper secret get API_KEY --env prod
keeper secret list --env prod

# Delete a secret
keeper secret delete OLD_KEY --env staging
```

### Budget Management

```bash
# Set a monthly budget cap
keeper budget set --customer acme --limit 10

# Check current usage
keeper budget get --customer acme
```

## How It Works

```
.env.example → keeper init → keeper provision → keeper inject
                                  ↓
                         Provider Admin API
                         (OpenAI, Anthropic, ...)
                                  ↓
                         Key with $10 cap + 24h TTL
                                  ↓
                         Encrypted in vault (AES-256-GCM)
```

Each key is:
- **Budget-capped** — $10/month max? Even if leaked, damage stops at $10
- **Time-limited** — 24h TTL? Key is dead tomorrow regardless
- **Scope-restricted** — Only `chat:gpt-4o`? Can't touch embeddings or other models
- **Isolated** — One project, one environment. Leak one, the rest are safe

## Architecture

```
keeper CLI
├── vault/        — AES-256-GCM encryption, tenant key derivation
├── provisioners/ — Provider adapters (OpenAI, more planned)
├── budget/       — Per-customer spending limits + usage tracking
├── commands/     — CLI command handlers
└── index.ts      — Library exports for programmatic use
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VAULT_ROOT_KEY` | Yes | 256-bit root encryption key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `OPENAI_ADMIN_API_KEY` | No | OpenAI Admin API key (for provisioning) |
| `OPENAI_PROJECT_ID` | No | OpenAI project ID |
| `KEEPER_ORGANIZATION_ID` | No | Default organization ID |

## License

[Elastic License 2.0 (ELv2)](./LICENSE) — Free for individual and internal use. Cannot be offered as a competing managed service.
