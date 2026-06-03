// src/controllers/oauth.controller.ts
// ─────────────────────────────────────────────
// OAUTH + PASSKEY CONTROLLER
// Google ID-token verification (no SDK needed)
// WebAuthn / Passkey registration and login
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import { prisma } from '../prisma/client'
import { signToken } from '../../utils/jwt'
import { hashToken } from '../../utils/hash'
import { sessionDeviceData } from '../../utils/device'
import { recordIfNewDevice } from '../services/user.service'
import crypto from 'crypto'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'


// ─────────────────────────────────────────────
// GOOGLE OAUTH
// Client sends the credential (Google ID token)
// obtained from Google Identity Services SDK.
// We verify it against Google's tokeninfo
// endpoint — no google-auth-library needed.
// Requires: GOOGLE_CLIENT_ID env var
// ─────────────────────────────────────────────

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body as { credential?: string }
    if (!credential) {
      res.status(400).json({ error: 'Google credential is required' })
      return
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      res.status(503).json({ error: 'Google Sign-In is not configured on this server.' })
      return
    }

    const infoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    const infoRes = await fetch(infoUrl)
    if (!infoRes.ok) {
      res.status(401).json({ error: 'Invalid Google credential' })
      return
    }

    const info = await infoRes.json() as {
      aud: string; sub: string; email: string;
      email_verified: string; given_name?: string; family_name?: string; name?: string;
    }

    if (info.aud !== clientId) {
      res.status(401).json({ error: 'Invalid Google credential audience' })
      return
    }

    if (info.email_verified !== 'true') {
      res.status(401).json({ error: 'Google account email is not verified' })
      return
    }

    const email = info.email.toLowerCase()

    const user = await prisma.user.findFirst({
      where: { email },
      include: {
        tenant: { select: { id: true, name: true, status: true, slug: true } },
      },
    })

    if (!user) {
      res.status(404).json({
        error: 'No account found for this Google account. Please sign up first.',
        email,
        firstName: info.given_name ?? '',
        lastName:  info.family_name ?? '',
      })
      return
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Your account has been deactivated. Contact your administrator.' })
      return
    }

    if (user.tenant.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Your organisation account has been suspended.' })
      return
    }

    const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role })
    const gUserAgent = req.headers['user-agent']
    await recordIfNewDevice(user.id, gUserAgent, req.ip)
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 15),
        ipAddress: req.ip,
        userAgent: gUserAgent,
        ...sessionDeviceData(gUserAgent, req.ip),
      },
    })
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, tenantId: user.tenantId, tenant: user.tenant },
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}


export const googleRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential, organizationName, country, industry } = req.body as {
      credential?: string; organizationName?: string; country?: string; industry?: string;
    }

    if (!credential || !organizationName) {
      res.status(400).json({ error: 'Google credential and organization name are required' })
      return
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      res.status(503).json({ error: 'Google Sign-In is not configured on this server.' })
      return
    }

    const infoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    const infoRes = await fetch(infoUrl)
    if (!infoRes.ok) { res.status(401).json({ error: 'Invalid Google credential' }); return }

    const info = await infoRes.json() as {
      aud: string; email: string; email_verified: string;
      given_name?: string; family_name?: string;
    }

    if (info.aud !== clientId || info.email_verified !== 'true') {
      res.status(401).json({ error: 'Invalid Google credential' })
      return
    }

    const email = info.email.toLowerCase()
    const existing = await prisma.user.findFirst({ where: { email }, select: { id: true } })
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists. Please log in.' })
      return
    }

    const tenantService = await import('../services/tenant.service')
    const randomPassword = crypto.randomBytes(32).toString('hex')
    const result = await tenantService.registerTenant({
      organizationName,
      firstName:  info.given_name  ?? 'User',
      lastName:   info.family_name ?? '',
      email,
      password:   randomPassword,
      country:    country ?? 'AE',
      industry,
    })

    res.status(201).json(result)
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('already exists')) { res.status(409).json({ error: msg }); return }
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// WEBAUTHN CONFIG
// Dev defaults work out of the box on localhost.
// Set these env vars in production:
//   WEBAUTHN_RP_ID     = your domain, e.g. app.cirvio.com
//   WEBAUTHN_RP_NAME   = display name shown in browser prompt
//   WEBAUTHN_ORIGIN    = full origin, e.g. https://app.cirvio.com
// ─────────────────────────────────────────────

const RP_ID   = process.env.WEBAUTHN_RP_ID   ?? 'localhost'
const RP_NAME = process.env.WEBAUTHN_RP_NAME ?? 'Cirvio'
const ORIGIN  = process.env.WEBAUTHN_ORIGIN  ?? 'http://localhost:4200'

// ─────────────────────────────────────────────
// CHALLENGE STORE
// Short-lived in-memory map.
// TTL: 5 minutes — long enough for a human to
// respond to a biometric prompt; short enough
// to limit replay window.
// For multi-instance deployments swap for Redis.
// ─────────────────────────────────────────────

const CHALLENGE_TTL = 5 * 60 * 1000

interface ChallengeEntry { challenge: string; userId?: string; expiresAt: number }
const regChallenges  = new Map<string, ChallengeEntry>() // keyed by userId
const authChallenges = new Map<string, ChallengeEntry>() // keyed by random challengeId

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of regChallenges)  if (v.expiresAt < now) regChallenges.delete(k)
  for (const [k, v] of authChallenges) if (v.expiresAt < now) authChallenges.delete(k)
}, 60_000)


// ─────────────────────────────────────────────
// PASSKEY REGISTRATION
// Requires a logged-in user (requireUser middleware).
// Flow: options → browser ceremony → register
// ─────────────────────────────────────────────

export const passkeyRegisterOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const existingPasskeys = await prisma.passkey.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    })

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID:   RP_ID,
      userID: Buffer.from(user.id, 'utf-8'),
      userName: user.email,
      userDisplayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey:    'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existingPasskeys.map(p => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransportFuture[],
      })),
      supportedAlgorithmIDs: [-7, -257],
    })

    regChallenges.set(userId, { challenge: options.challenge, userId, expiresAt: Date.now() + CHALLENGE_TTL })

    res.json({ options })
  } catch (err) {
    console.error('[passkey] register-options error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const passkeyRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const stored = regChallenges.get(userId)

    if (!stored || stored.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Challenge expired — request new options and try again.' })
      return
    }
    regChallenges.delete(userId)

    const { name, ...attestation } = req.body as { name?: string; [k: string]: unknown }

    const verification = await verifyRegistrationResponse({
      response:            attestation as any,
      expectedChallenge:   stored.challenge,
      expectedOrigin:      ORIGIN,
      expectedRPID:        RP_ID,
      requireUserVerification: false,
    })

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Passkey verification failed.' })
      return
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

    await prisma.passkey.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey:    Buffer.from(credential.publicKey),
        counter:      BigInt(credential.counter),
        deviceType:   credentialDeviceType ?? 'singleDevice',
        backedUp:     credentialBackedUp   ?? false,
        transports:   credential.transports ?? [],
        name:         name ?? null,
      },
    })

    res.json({ verified: true })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'This passkey is already registered to your account.' })
      return
    }
    console.error('[passkey] register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// PASSKEY AUTHENTICATION (LOGIN)
// Public endpoints — no token required.
// Flow: options → browser ceremony → login
// ─────────────────────────────────────────────

export const passkeyLoginOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string }

    let allowCredentials: { id: string; transports: AuthenticatorTransportFuture[] }[] = []

    if (email) {
      const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase().trim() },
        select: { id: true },
      })
      if (user) {
        const passkeys = await prisma.passkey.findMany({
          where: { userId: user.id },
          select: { credentialId: true, transports: true },
        })
        allowCredentials = passkeys.map(p => ({
          id: p.credentialId,
          transports: p.transports as AuthenticatorTransportFuture[],
        }))
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    })

    const challengeId = crypto.randomUUID()
    authChallenges.set(challengeId, { challenge: options.challenge, expiresAt: Date.now() + CHALLENGE_TTL })

    res.json({ options, challengeId })
  } catch (err) {
    console.error('[passkey] login-options error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const passkeyLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { challengeId, ...assertion } = req.body as { challengeId: string; [k: string]: unknown }

    const stored = authChallenges.get(challengeId)
    if (!stored || stored.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Challenge expired — please try again.' })
      return
    }
    authChallenges.delete(challengeId)

    const dbPasskey = await prisma.passkey.findUnique({
      where: { credentialId: (assertion as any).id },
      include: {
        user: {
          include: {
            tenant: { select: { id: true, name: true, status: true, slug: true } },
          },
        },
      },
    })

    if (!dbPasskey) {
      res.status(401).json({ error: 'Passkey not recognised. Please log in with email and password.' })
      return
    }

    const verification = await verifyAuthenticationResponse({
      response:          assertion as any,
      expectedChallenge: stored.challenge,
      expectedOrigin:    ORIGIN,
      expectedRPID:      RP_ID,
      credential: {
        id:         dbPasskey.credentialId,
        publicKey:  new Uint8Array(dbPasskey.publicKey),
        counter:    Number(dbPasskey.counter),
        transports: dbPasskey.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: false,
    })

    if (!verification.verified) {
      res.status(401).json({ error: 'Passkey verification failed. Please try again.' })
      return
    }

    const { user } = dbPasskey

    if (!user.isActive) {
      res.status(403).json({ error: 'Your account has been deactivated. Contact your administrator.' })
      return
    }

    if (user.tenant.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Your organisation account has been suspended.' })
      return
    }

    await prisma.passkey.update({
      where: { id: dbPasskey.id },
      data: {
        counter:    BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    })

    const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role })
    const pkUserAgent = req.headers['user-agent']
    await recordIfNewDevice(user.id, pkUserAgent, req.ip)
    await prisma.userSession.create({
      data: {
        userId:    user.id,
        token:     hashToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 15),
        ipAddress: req.ip,
        userAgent: pkUserAgent,
        ...sessionDeviceData(pkUserAgent, req.ip),
      },
    })
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    res.json({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, tenantId: user.tenantId, tenant: user.tenant },
    })
  } catch (err) {
    console.error('[passkey] login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// PASSKEY MANAGEMENT
// Authenticated routes for listing / removing
// passkeys from the Settings page
// ─────────────────────────────────────────────

export const passkeyList = async (req: Request, res: Response): Promise<void> => {
  try {
    const passkeys = await prisma.passkey.findMany({
      where:   { userId: req.user!.userId },
      select:  { id: true, name: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ passkeys })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const passkeyRemove = async (req: Request, res: Response): Promise<void> => {
  try {
    const passkeyId = String(req.params.passkeyId)
    const passkey = await prisma.passkey.findFirst({
      where: { id: passkeyId, userId: req.user!.userId },
    })
    if (!passkey) { res.status(404).json({ error: 'Passkey not found.' }); return }

    await prisma.passkey.delete({ where: { id: passkeyId } })
    res.json({ deleted: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
