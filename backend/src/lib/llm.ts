// src/lib/llm.ts
// ─────────────────────────────────────────────
// Provider-agnostic LLM client (OpenAI-compatible chat completions + tools).
//
// Works with any OpenAI-compatible endpoint — Groq (default), OpenRouter,
// Together, a local Ollama, etc. Switching providers is purely env config; no
// code change.
//
// Env:
//   GROQ_API_KEY / LLM_API_KEY — API key (required for the assistant to work)
//   LLM_BASE_URL — default https://api.groq.com/openai/v1
//   CHAT_MODEL   — default llama-3.3-70b-versatile
// ─────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

function apiKey(): string | undefined {
  return process.env.GROQ_API_KEY || process.env.LLM_API_KEY
}

export function isAiConfigured(): boolean {
  return !!apiKey()
}

export function chatModel(): string {
  return process.env.CHAT_MODEL || DEFAULT_MODEL
}

function baseUrl(): string {
  return (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

// ── Types we expose to the orchestrator ──────────────────────────────────────

/** Neutral tool definition (JSON-schema parameters). */
export interface LlmTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** A tool the model asked us to run, with parsed arguments. */
export interface LlmToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

// OpenAI-format message shapes used in the loop.
export type LlmMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: RawToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

interface RawToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface CompletionResult {
  /** Raw assistant message — push back into the transcript verbatim. */
  message: LlmMessage
  text: string
  toolCalls: LlmToolCall[]
  finishReason: string
}

interface CreateCompletionParams {
  system: string
  messages: LlmMessage[]
  tools?: LlmTool[]
  maxTokens?: number
}

/**
 * One completion round. Throws on transport/API error; the orchestrator
 * decides how to surface failures.
 */
export async function createCompletion(params: CreateCompletionParams): Promise<CompletionResult> {
  const key = apiKey()
  if (!key) throw new Error('AI is not configured')

  const tools = params.tools?.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: chatModel(),
      max_tokens: params.maxTokens ?? 1500,
      temperature: 0.3,
      messages: [{ role: 'system', content: params.system }, ...params.messages],
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LLM API error ${res.status}: ${detail.slice(0, 500)}`)
  }

  const data: any = await res.json()
  const msg = data.choices?.[0]?.message ?? {}
  const rawToolCalls: RawToolCall[] = msg.tool_calls ?? []

  const toolCalls: LlmToolCall[] = rawToolCalls.map(tc => {
    let args: Record<string, any> = {}
    try { args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {} } catch { args = {} }
    return { id: tc.id, name: tc.function.name, arguments: args }
  })

  return {
    message: { role: 'assistant', content: msg.content ?? null, tool_calls: rawToolCalls.length ? rawToolCalls : undefined },
    text: (msg.content ?? '').trim(),
    toolCalls,
    finishReason: data.choices?.[0]?.finish_reason ?? 'stop',
  }
}
