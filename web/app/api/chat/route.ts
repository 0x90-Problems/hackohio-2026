// Nutty, the board assistant's AI: Amazon Nova on Amazon Bedrock, through the
// AWS SDK's Converse API. The browser sends the conversation; this route asks
// the model for the next reply and streams it back as JSON lines:
//   {"type":"text","text":"..."}                 pieces of the reply as they arrive
//   {"type":"message","content":[...],"stop_reason":"..."}   the finished reply
//   {"type":"error","message":"..."}
// Messages use Bedrock's Converse format. When the reply asks for tools, the
// browser runs them (lib/assistant/tools.ts) and calls this route again with
// the results.
//
// Needs AWS credentials and a region in web/.env.local (see docs/demo-script.md).
// Without them, GET reports ai: false and the chat uses the offline assistant.
// With BEDROCK_GUARDRAIL_ID set, Bedrock runs every question and reply through
// that guardrail.
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type Tool,
  type ToolInputSchema,
} from "@aws-sdk/client-bedrock-runtime"

import { ASSISTANT_SYSTEM_PROMPT, ASSISTANT_TOOLS } from "@/lib/assistant/tools"

export const runtime = "nodejs"

// Amazon's own models need no AWS Marketplace subscription, which the OSU
// sandbox role isn't allowed to accept (so Claude models fail there)
const MODEL = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0"

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
        streamProcessingMode: "sync" as const,
      }
    : undefined

const TOOLS: Tool[] = ASSISTANT_TOOLS.map((t) => ({
  toolSpec: {
    name: t.name,
    description: t.description,
    // Plain JSON Schema; the SDK's DocumentType just can't see that
    inputSchema: { json: t.input_schema } as ToolInputSchema,
  },
}))

// Nova writes its reasoning as <thinking>…</thinking> in the reply text.
// Returns the part people should see: without finished or still-open
// thinking, and holding back a tag that has only partly arrived.
function visibleText(raw: string) {
  const text = raw.replace(/<thinking>[\s\S]*?(<\/thinking>|$)/g, "")
  const partial = text.match(/<[a-z]*$/)?.[0]
  return partial && "<thinking>".startsWith(partial)
    ? text.slice(0, -partial.length)
    : text
}

// Created on first use so the site still builds and runs without AWS set up
let client: BedrockRuntimeClient | undefined

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
    messages?: Message[]
  } | null
  const messages = body?.messages
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 200
  ) {
    return Response.json({ error: "Send 1 to 200 messages" }, { status: 400 })
  }

  client ??= new BedrockRuntimeClient({ region: region() })
  const abort = new AbortController()

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const send = (line: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"))
      // The reply as it streams in: text, and tool calls whose input
      // arrives as pieces of JSON
      const blocks: { text?: string; toolUse?: { toolUseId: string; name: string; json: string } }[] = []
      let stopReason = "end_turn"
      try {
        const response = await client!.send(
          new ConverseStreamCommand({
            modelId: MODEL,
            system: [{ text: ASSISTANT_SYSTEM_PROMPT }],
            messages,
            toolConfig: { tools: TOOLS },
            inferenceConfig: { maxTokens: 4096 },
            guardrailConfig: guardrail(),
          }),
          { abortSignal: abort.signal }
        )
        for await (const event of response.stream ?? []) {
          if (event.contentBlockStart?.start?.toolUse) {
            const { toolUseId = "", name = "" } =
              event.contentBlockStart.start.toolUse
            blocks[event.contentBlockStart.contentBlockIndex ?? blocks.length] =
              { toolUse: { toolUseId, name, json: "" } }
          } else if (event.contentBlockDelta) {
            const i = event.contentBlockDelta.contentBlockIndex ?? 0
            const delta = event.contentBlockDelta.delta
            if (delta?.text !== undefined) {
              blocks[i] ??= { text: "" }
              const shown = visibleText(blocks[i].text ?? "").trimStart()
              blocks[i].text = (blocks[i].text ?? "") + delta.text
              const now = visibleText(blocks[i].text!).trimStart()
              if (now.length > shown.length && now.startsWith(shown)) {
                send({ type: "text", text: now.slice(shown.length) })
              }
            } else if (delta?.toolUse?.input !== undefined && blocks[i]?.toolUse) {
              blocks[i].toolUse!.json += delta.toolUse.input
            }
          } else if (event.messageStop) {
            stopReason = event.messageStop.stopReason ?? stopReason
          }
        }

        const content: ContentBlock[] = []
        for (const b of blocks) {
          if (b?.toolUse) {
            let input: unknown = {}
            try {
              input = b.toolUse.json ? JSON.parse(b.toolUse.json) : {}
            } catch {
              // Cut off mid-input: runTool rejects the empty input
            }
            content.push({
              toolUse: {
                toolUseId: b.toolUse.toolUseId,
                name: b.toolUse.name,
                input: input as never,
              },
            })
          } else if (b?.text) {
            const text = visibleText(b.text).trim()
            if (text) content.push({ text })
          }
        }
        send({ type: "message", content, stop_reason: stopReason })
      } catch (error) {
        const name = (error as { name?: string }).name ?? ""
        const status = (error as { $metadata?: { httpStatusCode?: number } })
          .$metadata?.httpStatusCode
        if (/CredentialsProvider|SSO|Token|ExpiredToken|UnrecognizedClient/i.test(name)) {
          send({
            type: "error",
            message:
              "AWS sign-in expired. Run `aws sso login --profile nutshell` and try again.",
          })
        } else if (name === "ThrottlingException") {
          send({
            type: "error",
            message: "Too many requests right now. Try again in a moment.",
          })
        } else if (name === "AccessDeniedException") {
          send({
            type: "error",
            message: "AWS denied access to the model. Check the Bedrock settings.",
          })
        } else if (name !== "AbortError") {
          send({
            type: "error",
            message: `Bedrock error${status ? ` (${status})` : ""}. Try again.`,
          })
        }
      }
      controller.close()
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  })
}
