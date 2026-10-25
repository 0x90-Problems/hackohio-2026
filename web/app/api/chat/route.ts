// Nutty, the board assistant's AI: Claude on Amazon Bedrock. The browser sends
// the conversation; this route asks Claude for the next reply and streams it
// back as JSON lines:
//   {"type":"text","text":"..."}                 pieces of the reply as they arrive
//   {"type":"message","content":[...],"stop_reason":"..."}   the finished reply
//   {"type":"error","message":"..."}
// When the reply asks for tools, the browser runs them (lib/assistant/tools.ts)
// and calls this route again with the results.
//
// Needs AWS credentials and a region in web/.env.local (see docs/demo-script.md).
// Without them, GET reports ai: false and the chat uses the offline assistant.
// With BEDROCK_GUARDRAIL_ID set, every question and reply also goes through
// that Bedrock Guardrail.
import type Anthropic from "@anthropic-ai/sdk"
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk"
import {
  ApplyGuardrailCommand,
  BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime"

import { ASSISTANT_SYSTEM_PROMPT, ASSISTANT_TOOLS } from "@/lib/assistant/tools"

export const runtime = "nodejs"

const MODEL = "anthropic.claude-opus-5-5"

const region = () => process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION

const hasCredentials = () =>
  Boolean(
    region() &&
      (process.env.AWS_BEARER_TOKEN_BEDROCK ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_PROFILE)
  )

const guardrail = () =>
  process.env.BEDROCK_GUARDRAIL_ID
    ? {
        guardrailIdentifier: process.env.BEDROCK_GUARDRAIL_ID,
        guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || "DRAFT",
      }
    : null

// Created on first use so the site still builds and runs without AWS set up
let client: AnthropicBedrockMantle | undefined
let guardrailClient: BedrockRuntimeClient | undefined

// Returns the guardrail's replacement message when it blocks the text
async function checkGuardrail(source: "INPUT" | "OUTPUT", text: string) {
  const config = guardrail()
  if (!config || !text.trim()) return null
  guardrailClient ??= new BedrockRuntimeClient({ region: region() })
  const result = await guardrailClient.send(
    new ApplyGuardrailCommand({
      ...config,
      source,
      content: [{ text: { text } }],
    })
  )
  if (result.action !== "GUARDRAIL_INTERVENED") return null
  return (
    result.outputs?.map((o) => o.text).join("\n") ||
    "Sorry, I can't help with that."
  )
}

// The text the person typed last (tool-result rounds have none)
function latestQuestion(messages: Anthropic.Beta.BetaMessageParam[]) {
  const last = messages[messages.length - 1]
  return last?.role === "user" && typeof last.content === "string"
    ? last.content
    : ""
}

export function GET() {
  return Response.json({ ai: hasCredentials(), guardrail: Boolean(guardrail()) })
}

export async function POST(request: Request) {
  if (!hasCredentials()) {
    return Response.json(
      { error: "No AWS credentials or region set for Bedrock" },
      { status: 503 }
    )
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

  const encoder = new TextEncoder()
  const line = (event: object) =>
    encoder.encode(JSON.stringify(event) + "\n")
  const ndjson = (stream: ReadableStream) =>
    new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    })

  const blocked = await checkGuardrail("INPUT", latestQuestion(messages)).catch(
    () => "The safety check couldn't run. Try again."
  )
  if (blocked) {
    return ndjson(
      new ReadableStream({
        start(controller) {
          controller.enqueue(line({ type: "error", message: blocked }))
          controller.close()
        },
      })
    )
  }

  client ??= new AnthropicBedrockMantle({ awsRegion: region() })
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    // Chat: short, quick answers
    output_config: { effort: "low" },
    system: ASSISTANT_SYSTEM_PROMPT,
    tools: ASSISTANT_TOOLS,
    messages,
  })

  // With a guardrail, hold the reply until it passes the output check
  const holdText = Boolean(guardrail())

  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(line(event))
      if (!holdText) stream.on("text", (text) => send({ type: "text", text }))
      try {
        const message = await stream.finalMessage()
        if (holdText) {
          const text = message.content
            .map((b) => (b.type === "text" ? b.text : ""))
            .join("")
          const replacement = await checkGuardrail("OUTPUT", text)
          if (replacement) {
            send({ type: "error", message: replacement })
            controller.close()
            return
          }
          if (text) send({ type: "text", text })
        }
        send({
          type: "message",
          content: message.content,
          stop_reason: message.stop_reason,
        })
      } catch (error) {
        if (error instanceof AnthropicBedrockMantle.AuthenticationError) {
          send({
            type: "error",
            message:
              "AWS rejected the credentials. Check the AWS settings in web/.env.local.",
          })
        } else if (error instanceof AnthropicBedrockMantle.RateLimitError) {
          send({
            type: "error",
            message: "Too many requests right now. Try again in a moment.",
          })
        } else if (error instanceof AnthropicBedrockMantle.APIError) {
          send({
            type: "error",
            message: `Bedrock error (${error.status}). Try again.`,
          })
        } else {
          // A tool input that couldn't be parsed, or the output check failed;
          // asking again usually works
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

  return ndjson(readable)
}
