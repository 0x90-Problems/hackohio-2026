"use client"

// Suggestions your agents made for you (NSB-88), through /api/recommendations.

import { readSession } from "@/lib/board-auth"
import type { SuggestionTarget } from "@/lib/suggestion-links"
import { boardContextHeaders } from "@/lib/team-choice"
import type { Actor } from "@/lib/types"

export type Suggestion = {
  _id: string
  actor: Actor
  title: string
  body?: string
  target?: SuggestionTarget
  status: "open" | "dismissed" | "done"
  created_at: string
}

export class SuggestionsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const secret = readSession()?.secret
  if (!secret) throw new SuggestionsError("Sign in first", 401)
  let response: Response
  try {
    response = await fetch(`/api/recommendations${path}`, {
      method: init.method ?? "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${secret}`,
        ...boardContextHeaders(),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new SuggestionsError("Couldn't reach the board. Check your connection and try again.", 503)
  }
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  if (!response.ok) throw new SuggestionsError(body?.error?.message ?? "Something went wrong. Try again.", response.status)
  return body as T
}

export const suggestionsApi = {
  open: () => call<Suggestion[]>(""),
  dismiss: (ids: string[] | "all") => call<{ dismissed: string[] }>("/dismiss", { method: "POST", body: ids === "all" ? { all: true } : { ids } }),
  done: (id: string) => call<Suggestion>(`/${id}/done`, { method: "POST" }),
}
