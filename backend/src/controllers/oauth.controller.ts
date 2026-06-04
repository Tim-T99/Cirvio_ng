// src/controllers/oauth.controller.ts
// ─────────────────────────────────────────────
// PASSKEY CONTROLLER
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
