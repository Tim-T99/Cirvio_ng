// src/lib/anthropic.ts
// ─────────────────────────────────────────────
// Minimal Claude (Anthropic Messages API) client.
//
// Uses fetch (no SDK dependency) so it builds and deploys without an extra
// install step. Supports the tool-use loop and prompt caching via
// cache_control on the system prompt + tool definitions.
//
// Env:
//   ANTHROPIC_API_KEY — required for the assistant to function
//   CHAT_MODEL        — optional, defaults to claude-sonnet-4-6
// ─────────────────────────────────────────────

const API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-6'

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export function chatModel(): string {
  return process.env.CHAT_MODEL || DEFAULT_MODEL
}

// ── Message / content types (subset we use) ──────────────────────────────────

export interface TextBlock { type: 'text'; text: string }
export interface ToolUseBlock { type: 'tool_use'; id: string; name: string; input: unknown }
export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ClaudeResponse {
  content: ContentBlock[]
  stop_reason: string | null
  usage?: { input_tokens: number; output_tokens: number }
}

interface CreateMessageParams {
  system: string
  messages: ClaudeMessage[]
  tools?: ToolDef[]
  maxTokens?: number
}

/**
 * Call Claude once. Throws on transport/API error — the orchestrator decides
 * how to surface failures to the user.
 */
export async function createMessage(params: CreateMessageParams): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('AI is not configured')

  // System prompt as a cacheable block (prompt caching cuts cost across turns).
  const system = [
    { type: 'text', text: params.system, cache_control: { type: 'ephemeral' } },
  ]

  // Mark the last tool as a cache breakpoint so the (static) tool schemas cache.
  const tools = params.tools?.map((t, i) =>
    i === params.tools!.length - 1
      ? { ...t, cache_control: { type: 'ephemeral' } }
      : t
  )

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: chatModel(),
      max_tokens: params.maxTokens ?? 1500,
      system,
      tools,
      messages: params.messages,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 500)}`)
  }

  return (await res.json()) as ClaudeResponse
}
