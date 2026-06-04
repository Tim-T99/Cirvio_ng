// src/services/chat/chat.service.ts
// ─────────────────────────────────────────────
// AI assistant orchestrator.
// Persists conversations, runs the Claude tool-use loop against read-only
// tenant-scoped tools, and writes an immutable audit row for every tool call.
// ─────────────────────────────────────────────

import { prisma } from '../../prisma/client'
import {
  createMessage, isAiConfigured, ClaudeMessage, ContentBlock, ToolUseBlock, TextBlock,
} from '../../lib/anthropic'
import { ChatContext, toolDefs, runTool } from './tools'

const MAX_TOOL_ITERATIONS = 6
const HISTORY_LIMIT = 20

function buildSystemPrompt(company: string, country: string, role: string): string {
  const uae = country === 'AE'
  const domain = uae
    ? 'You specialise in UAE labour compliance: employment visas, WPS/SIF wage processing, Emirates ID, and MOHRE rules.'
    : 'You assist with general HR: employee records, org structure, and workforce planning.'
  return [
    `You are Cirvio's AI workforce assistant for "${company}". The signed-in user's role is ${role}.`,
    domain,
    'You have READ-ONLY tools to inspect this organisation\'s live data. Always ground factual answers (counts, names, costs, compliance status) in tool results — never invent or estimate numbers.',
    'For any question about org structure, headcount, cost, or efficiency, call get_org_overview first.',
    'When recommending efficiency improvements, base them on the actual data — wide or thin spans of control, single-report (redundant) management layers, employees with no manager, department headcount/cost — and briefly explain your reasoning and the trade-offs. Prioritise the highest-impact items.',
    'You cannot make changes yet; you can only read data and advise. Be concise, specific, and professional. All data belongs to this organisation only.',
  ].join(' ')
}

/** Resolve a conversation owned by this user, or create a new one. */
async function ensureConversation(ctx: ChatContext, conversationId: string | undefined, firstText: string) {
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId: ctx.tenantId, userId: ctx.userId },
      select: { id: true },
    })
    if (existing) return existing.id
  }
  const created = await prisma.conversation.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title: firstText.slice(0, 60),
    },
    select: { id: true },
  })
  return created.id
}

export interface SendResult {
  conversationId: string
  reply: string
  toolsUsed: string[]
  aiConfigured: boolean
}

export async function sendMessage(
  ctx: ChatContext,
  conversationId: string | undefined,
  userText: string
): Promise<SendResult> {
  const convId = await ensureConversation(ctx, conversationId, userText)

  // Persist the user's message first so it survives even if the AI call fails.
  await prisma.chatMessage.create({
    data: { conversationId: convId, role: 'USER', content: userText },
  })

  if (!isAiConfigured()) {
    const reply = 'The AI assistant is not configured yet. Set ANTHROPIC_API_KEY on the server to enable it.'
    await prisma.chatMessage.create({ data: { conversationId: convId, role: 'ASSISTANT', content: reply } })
    return { conversationId: convId, reply, toolsUsed: [], aiConfigured: false }
  }

  // Persona context.
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true, country: true },
  })
  const system = buildSystemPrompt(tenant?.name ?? 'your organisation', tenant?.country ?? 'AE', ctx.role)

  // Prior turns (oldest first) for continuity.
  const history = await prisma.chatMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: 'asc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  })
  const messages: ClaudeMessage[] = history.map(m => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
  }))

  const toolsUsed: string[] = []
  let finalText = ''

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await createMessage({ system, messages, tools: toolDefs })

    const toolUses = res.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    const text = res.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()
    if (text) finalText = text

    if (res.stop_reason !== 'tool_use' || toolUses.length === 0) break

    // Echo the assistant's tool-use turn back into the transcript.
    messages.push({ role: 'assistant', content: res.content })

    // Execute each requested tool and collect results.
    const results: ContentBlock[] = []
    for (const tu of toolUses) {
      toolsUsed.push(tu.name)
      let ok = true
      let errMsg: string | undefined
      let output: unknown
      try {
        output = await runTool(ctx, tu.name, (tu.input as Record<string, any>) ?? {})
      } catch (err) {
        ok = false
        errMsg = (err as Error).message
        output = { error: errMsg }
      }
      // [SAFETY] Immutable audit of every tool the AI invokes.
      await prisma.aiToolAuditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          tool: tu.name,
          args: (tu.input as any) ?? undefined,
          ok,
          error: errMsg,
        },
      })
      results.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(output),
        is_error: !ok,
      })
    }
    messages.push({ role: 'user', content: results })
  }

  if (!finalText) finalText = 'Sorry, I could not produce a response. Please try rephrasing.'

  await prisma.chatMessage.create({
    data: {
      conversationId: convId,
      role: 'ASSISTANT',
      content: finalText,
      toolCalls: toolsUsed.length ? { tools: toolsUsed } : undefined,
    },
  })
  await prisma.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } })

  return { conversationId: convId, reply: finalText, toolsUsed: [...new Set(toolsUsed)], aiConfigured: true }
}

// ── History reads (scoped to the signed-in user) ─────────────────────────────

export async function listConversations(ctx: ChatContext) {
  return prisma.conversation.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  })
}

export async function getConversation(ctx: ChatContext, conversationId: string) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId: ctx.tenantId, userId: ctx.userId },
    select: {
      id: true, title: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true, createdAt: true },
      },
    },
  })
  if (!conv) throw new Error('Conversation not found')
  return conv
}
