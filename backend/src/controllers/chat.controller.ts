// src/controllers/chat.controller.ts
// ─────────────────────────────────────────────
// AI ASSISTANT CONTROLLER
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as chatService from '../services/chat/chat.service'

const ctxOf = (req: Request) => ({
  tenantId: req.user!.tenantId,
  userId: req.user!.userId,
  role: req.user!.role,
})

export const send = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, conversationId } = req.body
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'A message is required' })
      return
    }
    if (message.length > 4000) {
      res.status(400).json({ error: 'Message is too long (max 4000 characters)' })
      return
    }
    const result = await chatService.sendMessage(ctxOf(req), conversationId, message.trim())
    res.status(200).json(result)
  } catch (err) {
    console.error('[chat] send failed:', (err as Error).message)
    res.status(500).json({ error: 'The assistant is temporarily unavailable. Please try again.' })
  }
}

export const listConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await chatService.listConversations(ctxOf(req)))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const conv = await chatService.getConversation(ctxOf(req), req.params.conversationId as string)
    res.status(200).json(conv)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) { res.status(404).json({ error: message }); return }
    res.status(500).json({ error: 'Internal server error' })
  }
}
