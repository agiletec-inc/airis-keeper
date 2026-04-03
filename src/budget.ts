/**
 * Budget Manager — per-customer monthly spending limits.
 *
 * Independent of provider budget features (OpenAI project limits, etc.).
 * Tracks usage via akm_usage_logs and enforces limits in akm_budgets.
 */

import { getDb } from './db.js'

export type Budget = {
  customerId: string
  monthlyLimitUsd: number
  alertThresholdPercent: number
  currentUsageUsd: number
  period: string
}

export type UsageEntry = {
  customerId: string
  provider: string
  costUsd: number
  description?: string
}

/**
 * Set or update a customer's monthly budget.
 */
export async function setBudget(params: {
  organizationId: string
  customerId: string
  monthlyLimitUsd: number
  alertThresholdPercent?: number
}): Promise<void> {
  const { organizationId, customerId, monthlyLimitUsd, alertThresholdPercent = 80 } = params
  const db = getDb()

  const { error } = await db.from('akm_budgets').upsert(
    {
      organization_id: organizationId,
      customer_id: customerId,
      monthly_limit_usd: monthlyLimitUsd,
      alert_threshold_percent: alertThresholdPercent,
    },
    { onConflict: 'organization_id,customer_id' }
  )

  if (error) throw new Error(`Failed to set budget: ${error.message}`)
}

/**
 * Get a customer's budget and current period usage.
 */
export async function getBudget(params: {
  organizationId: string
  customerId: string
  period?: string
}): Promise<Budget | null> {
  const { organizationId, customerId, period = currentPeriod() } = params
  const db = getDb()

  const { data: budget, error } = await db
    .from('akm_budgets')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (error) throw new Error(`Failed to get budget: ${error.message}`)
  if (!budget) return null

  const usage = await getUsage({ organizationId, customerId, period })

  return {
    customerId,
    monthlyLimitUsd: budget.monthly_limit_usd,
    alertThresholdPercent: budget.alert_threshold_percent,
    currentUsageUsd: usage,
    period,
  }
}

/**
 * Record a usage entry for a customer.
 */
export async function recordUsage(params: {
  organizationId: string
  entry: UsageEntry
}): Promise<void> {
  const { organizationId, entry } = params
  const db = getDb()

  const { error } = await db.from('akm_usage_logs').insert({
    organization_id: organizationId,
    customer_id: entry.customerId,
    provider: entry.provider,
    cost_usd: entry.costUsd,
    description: entry.description,
  })

  if (error) throw new Error(`Failed to record usage: ${error.message}`)
}

/**
 * Get total usage for a customer in a given period.
 */
export async function getUsage(params: {
  organizationId: string
  customerId: string
  period?: string
}): Promise<number> {
  const { organizationId, customerId, period = currentPeriod() } = params
  const db = getDb()

  const periodStart = `${period}-01T00:00:00Z`
  const [year, month] = period.split('-').map(Number)
  const nextMonth =
    month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
  const periodEnd = `${nextMonth}-01T00:00:00Z`

  const { data, error } = await db
    .from('akm_usage_logs')
    .select('cost_usd')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd)

  if (error) throw new Error(`Failed to get usage: ${error.message}`)

  return (data ?? []).reduce((sum, row) => sum + (row.cost_usd as number), 0)
}

/**
 * Check if a customer has exceeded their budget alert threshold.
 */
export async function checkBudgetAlert(params: {
  organizationId: string
  customerId: string
}): Promise<{ exceeded: boolean; percentage: number; budget: Budget } | null> {
  const budget = await getBudget(params)
  if (!budget) return null

  const percentage = (budget.currentUsageUsd / budget.monthlyLimitUsd) * 100

  return {
    exceeded: percentage >= budget.alertThresholdPercent,
    percentage,
    budget,
  }
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
