import { AGENT_CONNECTION, type AgentConnection, type Scope } from "@/shared/names"
import { clearSession, readSession } from "@/lib/board-auth"
import { mcpLinksFromApi, type McpInstallLinks } from "@/lib/mcp-install"
import type { Agent } from "@/lib/types"

export type ConnectedAgent = {
  agent: Agent
  secret: string
  install: McpInstallLinks
  live: boolean
}

export class ConnectAgentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConnectAgentError"
  }
}

export async function connectAgent(input: {
  name: string
  ownerId: string
  username: string
  scopes: Scope[]
  connection?: AgentConnection
}): Promise<ConnectedAgent> {
  const connection = input.connection ?? AGENT_CONNECTION.MCP
  const session = readSession()
  if (!session) throw new ConnectAgentError("Sign in before connecting an agent")
  return requestLiveAgent(session.secret, { ...input, connection })
}

async function requestLiveAgent(
  secret: string,
  input: {
    name: string
    ownerId: string
    scopes: Scope[]
    connection: AgentConnection
  }
): Promise<ConnectedAgent> {
  let response: Response
  try {
    response = await fetch("/api/agents", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        scopes: input.scopes,
        connection: input.connection,
      }),
    })
  } catch {
    throw new ConnectAgentError("The board API could not be reached")
  }
  if (response.status === 503) throw new ConnectAgentError("The board API is not configured")
  if (response.status === 404) throw new ConnectAgentError("The board API cannot connect agents yet")
  if (!response.ok) throw new ConnectAgentError(staleSession(await errorMessage(response)))
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new ConnectAgentError("The board API returned an unexpected response")
  }
  const connected = parseConnected(parsed, input)
  if (!connected) throw new ConnectAgentError("The board API returned an unexpected response")
  return connected
}

function parseConnected(
  value: unknown,
  input: { ownerId: string; scopes: Scope[]; connection: AgentConnection }
): ConnectedAgent | null {
  if (value === null || typeof value !== "object") return null
  const body = value as {
    secret?: unknown
    agent?: Partial<Agent>
    mcp?: { json?: unknown; cursor_url?: unknown; claude_command?: unknown }
  }
  if (typeof body.secret !== "string" || body.secret.length === 0 || !body.mcp) return null
  if (
    typeof body.mcp.json !== "string" ||
    typeof body.mcp.cursor_url !== "string" ||
    typeof body.mcp.claude_command !== "string"
  ) {
    return null
  }
  const agent = body.agent
  if (!agent || typeof agent._id !== "string" || typeof agent.name !== "string") return null
  return {
    live: true,
    secret: body.secret,
    install: mcpLinksFromApi({
      json: body.mcp.json,
      cursor_url: body.mcp.cursor_url,
      claude_command: body.mcp.claude_command,
    }),
    agent: {
      _id: agent._id,
      name: agent.name,
      owner_id: typeof agent.owner_id === "string" ? agent.owner_id : input.ownerId,
      connection: agent.connection === AGENT_CONNECTION.API_KEY ? AGENT_CONNECTION.API_KEY : input.connection,
      scopes: input.scopes,
      revoked: agent.revoked === true,
    },
  }
}

export async function listBoardUsers(): Promise<{ _id: string; name: string }[]> {
  const session = readSession()
  if (!session) return []
  const response = await fetch("/api/users", {
    headers: { accept: "application/json", authorization: `Bearer ${session.secret}` },
  })
  if (!response.ok) return []
  const body = (await response.json()) as unknown
  if (!Array.isArray(body)) return []
  return body.flatMap((item) => {
    if (item === null || typeof item !== "object") return []
    const user = item as { _id?: unknown; name?: unknown }
    if (typeof user._id !== "string" || typeof user.name !== "string" || !user.name) return []
    return [{ _id: user._id, name: user.name }]
  })
}

export async function listBoardAgents(): Promise<Agent[]> {
  const session = readSession()
  if (!session) throw new ConnectAgentError("Sign in before loading agents")
  const response = await fetch("/api/agents", {
    headers: { accept: "application/json", authorization: `Bearer ${session.secret}` },
  })
  if (!response.ok) throw new ConnectAgentError(staleSession(await errorMessage(response)))
  const body = (await response.json()) as unknown
  if (!Array.isArray(body)) throw new ConnectAgentError("The board API returned an unexpected response")
  return body.flatMap((item) => {
    if (item === null || typeof item !== "object") return []
    const agent = item as Partial<Agent>
    if (typeof agent._id !== "string" || typeof agent.name !== "string" || typeof agent.owner_id !== "string") return []
    if (!Array.isArray(agent.scopes)) return []
    return [{
      _id: agent._id,
      name: agent.name,
      owner_id: agent.owner_id,
      connection: agent.connection === AGENT_CONNECTION.API_KEY ? AGENT_CONNECTION.API_KEY : AGENT_CONNECTION.MCP,
      scopes: agent.scopes as Agent["scopes"],
      revoked: agent.revoked === true,
    }]
  })
}

export async function revokeAgentAccess(agentId: string): Promise<void> {
  const session = readSession()
  if (!session) throw new ConnectAgentError("Sign in before revoking a key")
  const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/revoke`, {
    method: "POST",
    headers: { accept: "application/json", authorization: `Bearer ${session.secret}` },
  })
  if (!response.ok) throw new ConnectAgentError(staleSession(await errorMessage(response)))
}

function staleSession(message: string): string {
  if (message.includes("Token is not recognized") || message.includes("Token is expired") || message.includes("Token is revoked")) {
    clearSession()
    return "Sign in again. This session is no longer accepted by the board."
  }
  return message
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    return body.error?.message ?? "Couldn't connect that agent"
  } catch {
    return "Couldn't connect that agent"
  }
}
