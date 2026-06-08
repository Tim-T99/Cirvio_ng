// src/controllers/billing.controller.ts
// ─────────────────────────────────────────────
// BILLING CONTROLLER (Stripe)
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as billingService from '../services/billing.service'
import { isBillingConfigured } from '../lib/stripe'

export const getPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ billingEnabled: isBillingConfigured(), plans: await billingService.listPlans() })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const sub = await billingService.getSubscription(req.user!.tenantId)
    res.status(200).json({ billingEnabled: isBillingConfigured(), ...sub })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) { res.status(404).json({ error: message }); return }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isBillingConfigured()) { res.status(503).json({ error: 'Billing is not configured' }); return }
    const { planId } = req.body
    if (!planId) { res.status(400).json({ error: 'planId is required' }); return }
    const url = await billingService.createCheckoutSession(req.user!.tenantId, planId)
    res.status(200).json({ url })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found') || message.includes('not available')) {
      res.status(400).json({ error: message }); return
    }
    console.error('[billing] checkout failed:', message)
    res.status(500).json({ error: 'Could not start checkout. Please try again.' })
  }
}

export const createPortal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isBillingConfigured()) { res.status(503).json({ error: 'Billing is not configured' }); return }
    const url = await billingService.createPortalSession(req.user!.tenantId)
    res.status(200).json({ url })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('No billing account')) { res.status(400).json({ error: message }); return }
    console.error('[billing] portal failed:', message)
    res.status(500).json({ error: 'Could not open billing portal.' })
  }
}

/**
 * Stripe webhook. Mounted with express.raw so req.body is the raw Buffer needed
 * for signature verification. Must always 200 quickly on success.
 */
export const webhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature']
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing signature' })
    return
  }
  let event
  try {
    event = billingService.constructEvent(req.body as Buffer, signature)
  } catch (err) {
    console.error('[billing] webhook signature verification failed:', (err as Error).message)
    res.status(400).json({ error: 'Invalid signature' })
    return
  }
  try {
    await billingService.handleEvent(event)
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[billing] webhook handler error:', (err as Error).message)
    // 500 → Stripe retries the event.
    res.status(500).json({ error: 'Webhook handler failed' })
  }
}
