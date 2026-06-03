// utils/device.ts
// ─────────────────────────────────────────────
// DEVICE FINGERPRINTING & USER-AGENT PARSING
//
// Pure, dependency-free, synchronous. No external
// calls — keeps the auth path lag-free (zero-trust
// session binding runs on every request).
//
// The fingerprint binds a session to the device
// that created it. We intentionally derive it from
// the User-Agent only (NOT the IP) so the binding
// survives IP changes on mobile/roaming networks
// while still rejecting a stolen token replayed
// from a different browser/device.
// ─────────────────────────────────────────────

import crypto from 'crypto'

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'

export interface DeviceInfo {
  deviceType: DeviceType
  os: string
  browser: string
  deviceName: string
  fingerprint: string
}

/** Stable per browser build + platform. Not PII — a one-way hash of the UA. */
export function fingerprintFor(userAgent?: string | null): string {
  return crypto
    .createHash('sha256')
    .update((userAgent ?? '').trim())
    .digest('hex')
    .slice(0, 32)
}

function detectOs(ua: string): string {
  if (/windows nt 10/i.test(ua)) return 'Windows 10'
  if (/windows/i.test(ua)) return 'Windows'
  if (/iphone|ipod/i.test(ua)) return 'iOS'
  if (/ipad/i.test(ua)) return 'iPadOS'
  if (/mac os x|macintosh/i.test(ua)) return 'macOS'
  if (/android/i.test(ua)) return 'Android'
  if (/cros/i.test(ua)) return 'ChromeOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}

function detectBrowser(ua: string): string {
  if (/edg(a|ios)?\//i.test(ua)) return 'Edge'
  if (/opr\/|opera/i.test(ua)) return 'Opera'
  if (/(crios)\//i.test(ua)) return 'Chrome'
  if (/(fxios|firefox)\//i.test(ua)) return 'Firefox'
  if (/chrome\//i.test(ua)) return 'Chrome'
  if (/safari\//i.test(ua) && /version\//i.test(ua)) return 'Safari'
  return 'Unknown'
}

function detectType(ua: string): DeviceType {
  if (/bot|crawler|spider|crawling|headless/i.test(ua)) return 'bot'
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile'
  if (ua) return 'desktop'
  return 'unknown'
}

export function parseUserAgent(userAgent?: string | null): DeviceInfo {
  const ua = (userAgent ?? '').trim()
  const fingerprint = fingerprintFor(ua)

  if (!ua) {
    return { deviceType: 'unknown', os: 'Unknown', browser: 'Unknown', deviceName: 'Unknown device', fingerprint }
  }

  const os = detectOs(ua)
  const browser = detectBrowser(ua)
  const deviceType = detectType(ua)

  let deviceName = `${browser} on ${os}`
  if (browser === 'Unknown' && os === 'Unknown') deviceName = 'Unknown device'
  else if (browser === 'Unknown') deviceName = os
  else if (os === 'Unknown') deviceName = browser

  return { deviceType, os, browser, deviceName, fingerprint }
}

/**
 * Builds the device columns to persist on a session row.
 * Pseudo-sessions (e.g. password-reset) pass a sentinel userAgent and
 * should skip device enrichment — callers guard that themselves.
 */
export function sessionDeviceData(userAgent?: string | null, ipAddress?: string | null) {
  const d = parseUserAgent(userAgent)
  return {
    deviceType: d.deviceType,
    deviceName: d.deviceName,
    os: d.os,
    browser: d.browser,
    fingerprint: d.fingerprint,
    lastSeenAt: new Date(),
    lastIp: ipAddress ?? null,
  }
}
