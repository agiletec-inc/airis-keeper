/**
 * CLI commands for budget management.
 */

import type { Command } from 'commander'
import { getBudget, getUsage, setBudget } from '../budget.js'

export function registerBudgetCommands(program: Command, getOrgId: () => string): void {
  const budget = program.command('budget').description('Manage per-customer spending budgets')

  budget
    .command('set')
    .description('Set or update a customer budget')
    .requiredOption('-c, --customer <customerId>', 'Customer identifier')
    .requiredOption('-l, --limit <usd>', 'Monthly limit in USD')
    .option('-t, --threshold <percent>', 'Alert threshold percentage', '80')
    .action(async (options) => {
      await setBudget({
        organizationId: getOrgId(),
        customerId: options.customer,
        monthlyLimitUsd: Number.parseFloat(options.limit),
        alertThresholdPercent: Number.parseInt(options.threshold),
      })
      process.stdout.write(
        `Budget set: ${options.customer} → $${options.limit}/month (alert at ${options.threshold}%)\n`
      )
    })

  budget
    .command('get')
    .description('Get a customer budget and current usage')
    .requiredOption('-c, --customer <customerId>', 'Customer identifier')
    .action(async (options) => {
      const result = await getBudget({
        organizationId: getOrgId(),
        customerId: options.customer,
      })

      if (!result) {
        process.stderr.write(`No budget set for customer "${options.customer}"\n`)
        process.exit(1)
      }

      const usagePct = ((result.currentUsageUsd / result.monthlyLimitUsd) * 100).toFixed(1)
      process.stdout.write(`Customer:  ${result.customerId}\n`)
      process.stdout.write(`Period:    ${result.period}\n`)
      process.stdout.write(`Limit:     $${result.monthlyLimitUsd.toFixed(2)}/month\n`)
      process.stdout.write(`Usage:     $${result.currentUsageUsd.toFixed(2)} (${usagePct}%)\n`)
      process.stdout.write(`Alert at:  ${result.alertThresholdPercent}%\n`)
    })

  budget
    .command('usage')
    .description('Get usage details for a customer')
    .requiredOption('-c, --customer <customerId>', 'Customer identifier')
    .option('-p, --period <YYYY-MM>', 'Period (default: current month)')
    .action(async (options) => {
      const usage = await getUsage({
        organizationId: getOrgId(),
        customerId: options.customer,
        period: options.period,
      })

      const period = options.period ?? new Date().toISOString().slice(0, 7)
      process.stdout.write(`Usage for ${options.customer} (${period}): $${usage.toFixed(2)}\n`)
    })
}
