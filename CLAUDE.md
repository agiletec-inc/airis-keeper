# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AIris Keeper — a CLI + library for managing LLM/API keys for AI agents. Design goal is **damage control over secrecy**: budget caps, TTLs, scoped + per-org-isolated keys so a leaked key is near-worthless. See `README.md` for the product framing.

Note: this is a plain npm/TypeScript package — it does **not** use `manifest.toml` / `airis gen` tooling despite the org convention. Edit `package.json`, `tsconfig.json`, `biome.json` directly.

## Commands

```bash
npm run lint          # biome check (also: lint:fix to auto-fix)
npm run typecheck     # tsc --noEmit
npm test              # vitest run (CI runs lint + typecheck + test + build + audit, in that order)
npm run build         # tsup → dist/ (cli.js + index.js, ESM, with #!/usr/bin/env node banner)
npm run dev           # tsx watch src/cli.ts

npx vitest run tests/vault.test.ts        # single test file
npx vitest run -t 'inserts a new secret'  # single test by name
```

## Hard constraints when editing

- **ESM + `Node16` module resolution.** Every relative import MUST carry a `.js` extension (`./db.js`, not `./db`). Test files import without extension because vitest resolves them differently — match the surrounding file.
- **No `console.log`.** Biome bans it (`noConsoleLog: error`). CLI output uses `process.stdout.write` / `process.stderr.write`; errors throw and are caught by the `unhandledRejection` handler in `cli.ts`.
- Biome style: single quotes, semicolons as-needed, 2-space indent, 100-col width. `tsconfig` has `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters` on — array access yields `T | undefined`.

## Architecture

### Encryption — 3-layer key hierarchy (`src/vault/crypto.ts`)
```
VAULT_ROOT_KEY (from Doppler env)
  → deriveTenantKey() = HMAC-SHA256(rootKey, "akm:tenant:<organizationId>")   # per-org isolation
    → AES-256-GCM encrypt/decrypt
```
Every encrypted DB row stores three separate base64 columns: `encrypted_value`/`ciphertext`, `iv`, `auth_tag`. Decryption fails (throws) on any tampering via GCM auth-tag verification. The org-scoped tenant key means one org cannot decrypt another's secrets even with DB access.

### Multi-tenancy
`organizationId` threads through **every** store/budget/provisioner function and scopes both the DB query and the tenant key. The CLI resolves it once via `--org` flag or `KEEPER_ORGANIZATION_ID` (`getOrgId()` in `cli.ts`, passed to each command group).

### Database (`src/db.ts`)
Supabase via service-role key, singleton `getDb()` (`resetDb()` for tests). All tables are prefixed `akm_`: `akm_secrets`, `akm_budgets`, `akm_usage_logs`, `akm_provisioned_keys`, `akm_audit_logs`. There are no migrations in this repo — the schema lives elsewhere (Supabase).

### CLI wiring (`src/cli.ts`)
`commander` program. Each command group is a `register*Commands(program, getOrgId)` function in `src/commands/`. Actual top-level commands: **`secret`** (set/get/list/delete), **`run`** (inject secrets into a child process), **`provision`** (create/list/revoke/rotate), **`budget`** (set/get/usage), **`env`**. The provider registry is populated at startup **only if** `OPENAI_ADMIN_API_KEY` + `OPENAI_PROJECT_ID` are set.

> README's `keeper init`/`status`/`provider add` and top-level `keeper rotate` are aspirational — they are not implemented. `rotate` exists only as `provision rotate`.

### Provisioners (`src/provisioners/`)
`Provisioner` interface (`types.ts`) → name-keyed `registry.ts` → implementations. Only `OpenAiProvisioner` exists. Its strategy: OpenAI's 100-project cap forbids per-customer projects, so it creates a **service account per customer** inside one shared project, then an API key on that SA. Adding a provider = implement `Provisioner` + `registerProvider()` in `cli.ts`. Key operations write to `akm_audit_logs`.

### Library surface (`src/index.ts`)
Re-exports vault/budget/provisioner functions for programmatic use (intended for MCP tools / an API server). Keep this in sync when adding public API.

## Testing pattern

Tests mock Supabase by `vi.mock('../src/db', ...)` returning a chainable mock, and `vi.mock('../src/env', ...)` to supply a fake `VAULT_ROOT_KEY` (64 hex chars). Mocks are declared **before** importing the module under test. There is no live DB in tests — match this pattern for any new DB-touching code.

## Environment variables

From Doppler, validated by a Zod schema in `src/env.ts` (`getEnv()` cached, `validateEnv()` non-throwing). Required: `VAULT_ROOT_KEY` (≥32 chars), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `OPENAI_ADMIN_API_KEY`, `OPENAI_PROJECT_ID`, `KEEPER_ORGANIZATION_ID`.
