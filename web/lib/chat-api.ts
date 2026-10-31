"use client"

import { readSession } from "@/lib/board-auth"
import type { Actor } from "@/lib/types"

// Client for workspace chat (proxied at /api/workspace-chat/* to /chat/v1/*).
// Field names match the chat service: docs/chat-plan.md in Buc2AgentTerraform.

export type ChannelKind = "text" | "dm" | "group_dm"

export type ChatPerson = { type: "human" | "agent"; id: string; name: string; owner_id?: string }

export type Channel = {
  id: string
  kind: ChannelKind
  name: string
  topic: string
  visibility: "public" | "private"
  section_id?: string | null
  position: number
  paused: boolean
  last_msg_id?: string | null
  last_read_msg_id?: string | null
  // Present when there's something unread, except past the server's per-request limit.
  unread_count?: number
  mention_count?: number
  unread_capped?: boolean
  role?: "member" | "manager"
  members?: (ChatPerson & { role?: string })[]
  created_at?: string
}

export type Section = { id: string; name: string; position: number }

export type ChatWorkspace = {
  ws_id: string
  team: string
  is_owner: boolean
  agents_paused: boolean
  sections: Section[]
  channels: Channel[]
  joinable: Channel[]
  people: ChatPerson[]
  agents: ChatPerson[]
}

export type ChatMessage = {
  id: string
  channel_id: string
  thread_root_id?: string | null
  type: "text" | "system" | string
  from?: string
  author: Actor & { token_id?: string }
  body: string
  mentions: { type: "human" | "agent"; id: string }[]
  created_at: string
  reply_count?: number
  last_reply_at?: string
  edited_at?: string
  deleted_at?: string
  hidden?: boolean
  hidden_reason?: string
}

export type ChannelUnread = { id: string; kind: ChannelKind; unread_count: number; mention_count: number; unread_capped?: boolean }

export class ChatError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ChatError"
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const session = readSession()
  const headers: Record<string, string> = { accept: "application/json" }
  if (session?.secret) headers.authorization = `Bearer ${session.secret}`
  if (init.body !== undefined) headers["content-type"] = "application/json"
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey
  let response: Response
  try {
    response = await fetch(`/api/workspace-chat/${path}`, {
      method: init.method ?? "GET",
      headers,
      cache: "no-store",
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })
  } catch {
    throw new ChatError("network", "Couldn't reach chat. Check your connection.", 0)
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null
  if (!response.ok) {
    throw new ChatError(body?.error?.code ?? "error", body?.error?.message ?? `Chat returned ${response.status}`, response.status)
  }
  return body as T
}

const seg = encodeURIComponent

function query(fields: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
  const text = params.toString()
  return text ? `?${text}` : ""
}

export const chatApi = {
  async enabled(): Promise<boolean> {
    try {
      return Boolean((await call<{ enabled?: boolean }>("health")).enabled)
    } catch {
      return false
    }
  },
  workspace: () => call<ChatWorkspace>("workspace"),
  unread: () => call<{ channels: ChannelUnread[] }>("unread"),
  liveSession: () => call<{ url: string; protocols: string[]; expires_in: number }>("live/session", { method: "POST", body: {} }),
  channel: (id: string) => call<Channel>(`channels/${seg(id)}`),
  createChannel: (input: { name: string; visibility: "public" | "private"; topic?: string; section_id?: string | null }) =>
    call<Channel>("channels", { method: "POST", body: input }),
  updateChannel: (id: string, changes: Partial<Pick<Channel, "name" | "topic" | "section_id" | "position">>) =>
    call<Channel>(`channels/${seg(id)}`, { method: "PATCH", body: changes }),
  archive: (id: string) => call<{ id: string }>(`channels/${seg(id)}/archive`, { method: "POST", body: {} }),
  join: (id: string) => call<{ id: string }>(`channels/${seg(id)}/join`, { method: "POST", body: {} }),
  leave: (id: string) => call<{ id: string }>(`channels/${seg(id)}/members`, { method: "DELETE" }),
  addMember: (id: string, principal: string) => call<{ added: boolean }>(`channels/${seg(id)}/members`, { method: "POST", body: { principal } }),
  removeMember: (id: string, principal: string) =>
    call<{ removed: boolean }>(`channels/${seg(id)}/members${query({ principal })}`, { method: "DELETE" }),
  openDm: (principals: string[]) => call<Channel>("dms", { method: "POST", body: { principals } }),
  messages: (id: string, opts: { before?: string; after?: string; limit?: number } = {}) =>
    call<{ messages: ChatMessage[]; more: boolean; channel: Channel }>(`channels/${seg(id)}/messages${query(opts)}`),
  thread: (id: string, rootId: string, after?: string) =>
    call<{ root: ChatMessage; replies: ChatMessage[]; more: boolean }>(`channels/${seg(id)}/threads/${seg(rootId)}${query({ after })}`),
  post: (id: string, body: string, opts: { threadRootId?: string; idempotencyKey: string; instruction?: boolean }) =>
    call<{ message: ChatMessage; duplicate?: boolean; woken?: string[] }>(
      `channels/${seg(id)}/${opts.instruction ? "instruction" : "messages"}`,
      { method: "POST", body: { body, ...(opts.threadRootId ? { thread_root_id: opts.threadRootId } : {}) }, idempotencyKey: opts.idempotencyKey }
    ),
  edit: (id: string, msgId: string, body: string) =>
    call<{ message: ChatMessage }>(`channels/${seg(id)}/messages/${seg(msgId)}`, { method: "PATCH", body: { body } }),
  remove: (id: string, msgId: string) => call<{ message: ChatMessage }>(`channels/${seg(id)}/messages/${seg(msgId)}`, { method: "DELETE" }),
  hide: (id: string, msgId: string, reason: string) =>
    call<{ hidden: boolean }>(`channels/${seg(id)}/messages/${seg(msgId)}/hide`, { method: "POST", body: { reason } }),
  markRead: (id: string, msgId: string) => call<{ last_read_msg_id: string }>(`channels/${seg(id)}/read`, { method: "PUT", body: { msg_id: msgId } }),
  setPaused: (id: string, paused: boolean, reason = "") =>
    call<{ paused: boolean }>(`channels/${seg(id)}/${paused ? "pause" : "resume"}`, { method: "POST", body: { reason } }),
  createSection: (name: string) => call<Section>("sections", { method: "POST", body: { name } }),
  renameSection: (id: string, name: string) => call<Section>(`sections/${seg(id)}`, { method: "PATCH", body: { name } }),
  deleteSection: (id: string) => call<{ deleted: boolean }>(`sections/${seg(id)}`, { method: "DELETE" }),
}

/** A channel has something unread when its newest message is past my read pointer. */
export function isUnread(channel: Channel): boolean {
  return Boolean(channel.last_msg_id && (!channel.last_read_msg_id || channel.last_msg_id > channel.last_read_msg_id))
}

/** What deserves a badge: mentions, and everything in a DM (it was sent to you). */
export function attentionCount(channel: { kind: ChannelKind; unread_count?: number; mention_count?: number }): number {
  return channel.kind === "text" ? (channel.mention_count ?? 0) : (channel.unread_count ?? 0)
}

export function principalOf(person: Pick<ChatPerson, "type" | "id">): string {
  return `${person.type === "agent" ? "agent" : "user"}:${person.id}`
}
