// src/lib/features.ts
// ─────────────────────────────────────────────
// Catalog of gateable product features. Plans declare which of these they
// include (Plan.features = string[] of keys). A plan with `features = null`
// is treated as "all features enabled" — keeps existing plans/tenants working
// until an admin explicitly configures the feature set.
// ─────────────────────────────────────────────

export interface FeatureDef {
  key: string
  label: string
  description: string
}

export const FEATURES: FeatureDef[] = [
  {
    key: 'ai_assistant',
    label: 'AI assistant',
    description: 'The in-app AI chat assistant with organisation data access.',
  },
  {
    key: 'data_export',
    label: 'Data export (Power BI / CSV)',
    description: 'Live OData feed and CSV/Excel export for BI tools like Power BI and Tableau.',
  },
]

export const FEATURE_KEYS: string[] = FEATURES.map((f) => f.key)

/** Keep only recognised feature keys (drops anything unknown). */
export function sanitizeFeatureKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((k): k is string => typeof k === 'string' && FEATURE_KEYS.includes(k))
}

/** Resolve a plan's stored `features` value to the effective enabled set. */
export function resolvePlanFeatures(stored: unknown): string[] {
  // null / not an array → all features enabled (backward compatible)
  if (!Array.isArray(stored)) return [...FEATURE_KEYS]
  return stored.filter((k): k is string => typeof k === 'string' && FEATURE_KEYS.includes(k))
}
