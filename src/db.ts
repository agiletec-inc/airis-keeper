/**
 * Supabase client for API Key Manager.
 * Uses service role key for server-side operations.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from './env.js'

let client: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (client) return client

  const env = getEnv()
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  return client
}

/**
 * Reset the cached client (useful for testing).
 */
export function resetDb(): void {
  client = null
}
