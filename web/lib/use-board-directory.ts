"use client"

import { useEffect, useState } from "react"

import { listBoardAgents, listBoardUsers } from "@/lib/connect-agent"
import type { Agent } from "@/lib/types"

type Person = { _id: string; name: string }

let peopleCache: Person[] | null = null
let peoplePending: Promise<Person[]> | null = null
let agentCache: Agent[] | null = null
let agentPending: Promise<Agent[]> | null = null

function loadPeople() {
  peoplePending ??= listBoardUsers()
    .then((users) => {
      peopleCache = users
      return users
    })
    .catch(() => {
      peoplePending = null
      return peopleCache ?? []
    })
  return peoplePending
}

function loadAgents() {
  agentPending ??= listBoardAgents()
    .then((agents) => {
      agentCache = agents
      return agents
    })
    .catch(() => {
      agentPending = null
      return agentCache ?? []
    })
  return agentPending
}

export function useBoardDirectory() {
  const [people, setPeople] = useState<Person[]>(peopleCache ?? [])
  const [agents, setAgents] = useState<Agent[]>(agentCache ?? [])
  // True once GET /agents has answered, so an agent missing from it was deleted.
  const [agentsLoaded, setAgentsLoaded] = useState(agentCache !== null)

  useEffect(() => {
    let cancelled = false
    loadPeople().then((users) => {
      if (!cancelled) setPeople(users)
    })
    loadAgents().then((rows) => {
      if (cancelled) return
      setAgents(rows)
      setAgentsLoaded(agentCache !== null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { people, agents, agentsLoaded }
}
