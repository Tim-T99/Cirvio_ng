// src/jobs/wpsAlert.job.ts
// ─────────────────────────────────────────────
// WPS COMPLIANCE ALERT JOB
// Runs on 8th-10th of each month
// Delegates to wpsService.processWpsAlerts()
// which handles payment deadline warnings + late flags
// ─────────────────────────────────────────────

import cron from 'node-cron'
import { processWpsAlerts, deliverWpsAlertDigests } from '../services/wps.service'

/**
 * Runs the WPS alert processing job.
 * - Fires pending alerts whose trigger date has passed
 * - Flags overdue payments as late
 * - Updates lateByDays on unpaid records past deadline
 */
async function runWpsAlertJob(): Promise<void> {
  const startTime = Date.now()
  const runStart = new Date()
  console.log(`[wpsAlert.job] Running at ${runStart.toISOString()}`)

  try {
    const results = await processWpsAlerts()

    // Email the freshly-fired alerts to each tenant's admins/HR (no-op if email off).
    const { tenantsNotified } = await deliverWpsAlertDigests(runStart)

    console.log(
      `[wpsAlert.job] Complete in ${Date.now() - startTime}ms — ` +
      `${results.processed} alert(s) processed, ` +
      `${results.latePaymentsDetected} late payment(s) detected, ` +
      `${tenantsNotified} tenant(s) emailed.` +
      (results.errors.length > 0
        ? ` Errors: ${results.errors.join('; ')}`
        : '')
    )
  } catch (err) {
    console.error('[wpsAlert.job] Fatal error:', err)
  }
}

/**
 * Schedule: 02:00 UTC on the 8th, 9th, and 10th of every month
 * (06:00 UAE time, UTC+4)
 */
export function startWpsAlertJob(): void {
  cron.schedule('0 2 8-10 * *', () => {
    runWpsAlertJob()
  })

  console.log('[wpsAlert.job] Scheduled — 02:00 UTC on 8th–10th of each month.')
}

// Allow manual trigger for testing
export { runWpsAlertJob }