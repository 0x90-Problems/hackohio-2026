// The board assistant's AI. The browser sends the conversation; this route
// asks Claude for the next reply and streams it back as JSON lines:
//   {"type":"text","text":"..."}                 pieces of the reply as they arrive
//   {"type":"message","content":[...],"stop_reason":"..."}   the finished reply
//   {"type":"error","message":"..."}
// When the reply asks for tools, the browser runs them (lib/assistant/tools.ts)
// and calls this route again with the results.
//
// Needs ANTHROPIC_API_KEY in web/.env.local. Without it, GET reports ai: false
// and the chat uses the offline assistant instead.
import Anthropic from "@anthropic-ai/sdk"

import { ASSISTANT_SYSTEM_PROMPT, ASSISTANT_TOOLS } from "@/lib/assistant/tools"

export const runtime = "nodejs"

const hasCredentials = () =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

// Created on first use so the site still builds and runs without a key
let client: Anthropic | undefined

export function GET() {
  return Response.json({ ai: hasCredentials() })
}

export async function POST(request: Request) {
  if (!hasCredentials()) {
    return Response.json({ error: "No ANTHROPIC_API_KEY set" }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: Anthropic.Beta.BetaMessageParam[]
  } | null
  const messages = body?.messages
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 200
  ) {
    return Response.json({ error: "Send 1 to 200 messages" }, { status: 400 })
  }

  client ??= new Anthropic()
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Chat: short, quick answers
    output_config: { effort: "low" },
    // If Claude declines for safety reasons, retry on Anthropic's recommended
    // fallback model instead of returning the refusal
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: ASSISTANT_SYSTEM_PROMPT,
    tools: ASSISTANT_TOOLS,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const send = (line: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"))
      stream.on("text", (text) => send({ type: "text", text }))
      try {
        const message = await stream.finalMessage()
        send({
          type: "message",
          content: message.content,
          stop_reason: message.stop_reason,
        })
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) {
          send({
            type: "error",
            message:
              "The API key was rejected. Check ANTHROPIC_API_KEY in web/.env.local.",
          })
        } else if (error instanceof Anthropic.RateLimitError) {
          send({
            type: "error",
            message: "Too many requests right now. Try again in a moment.",
          })
        } else if (error instanceof Anthropic.APIError) {
          send({
            type: "error",
            message: `Claude API error (${error.status}). Try again.`,
          })
        } else {
          // A tool input that couldn't be parsed; asking again usually works
          send({
            type: "error",
            message: "Something went wrong reading the reply. Try again.",
          })
        }
      }
      controller.close()
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  })
}
