// src/jobs/visaAlert.job.ts
// ─────────────────────────────────────────────
// VISA EXPIRY ALERT JOB
// Runs daily — delegates to visaService.processVisaAlerts()
// which handles status updates + alert firing
// ─────────────────────────────────────────────

import cron from 'node-cron'
import { processVisaAlerts, deliverVisaAlertDigests } from '../services/visa.service'

/**
 * Runs the visa alert processing job.
 * - Fires pending alerts whose trigger date has passed
 * - Syncs visa statuses based on current expiry dates
 * - Catches expired visas with no remaining alerts
 */
async function runVisaAlertJob(): Promise<void> {
  const startTime = Date.now()
  const runStart = new Date()
  console.log(`[visaAlert.job] Running at ${runStart.toISOString()}`)

  try {
    const results = await processVisaAlerts()

    // Email the freshly-fired alerts to each tenant's admins/HR (no-op if email off).
    const { tenantsNotified } = await deliverVisaAlertDigests(runStart)

    console.log(
      `[visaAlert.job] Complete in ${Date.now() - startTime}ms — ` +
      `${results.processed} alert(s) processed, ` +
      `${results.statusUpdates} status update(s), ` +
      `${tenantsNotified} tenant(s) emailed.` +
      (results.errors.length > 0
        ? ` Errors: ${results.errors.join('; ')}`
        : '')
    )
  } catch (err) {
    console.error('[visaAlert.job] Fatal error:', err)
  }
}

/**
 * Schedule: daily at 03:00 UTC (07:00 UAE / GST, UTC+4)
 */
export function startVisaAlertJob(): void {
  cron.schedule('0 3 * * *', () => {
    runVisaAlertJob()
  })

  console.log('[visaAlert.job] Scheduled — daily at 03:00 UTC.')
}

// Allow manual trigger for testing
export { runVisaAlertJob }