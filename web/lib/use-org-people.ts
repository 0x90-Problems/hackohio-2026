"use client"

import { useAuthUser } from "@/components/auth/auth-gate"
import { useBoardDirectory } from "@/lib/use-board-directory"

/**
 * The people someone can pick (reviewer, owner filter, Person fields): the organization's people
 * from the board, plus the signed-in person, who can always pick themself. Never the sample users
 * in mock-data, which aren't real people in any organization.
 */
export function useOrgPeople(): { _id: string; name: string }[] {
  const { people } = useBoardDirectory()
  const account = useAuthUser()
  if (!account || people.some((person) => person._id === account._id)) return people
  return [...people, { _id: account._id, name: account.name }]
}
