

import { getDatabase } from "@/lib/mongodb"
import { COLLECTIONS } from "@/shared/names"

export async function revokeAgentInDatabase(
  agentId: string,
  ownerId: string
) {
  const db = await getDatabase()

  const agent = await db
    .collection(COLLECTIONS.AGENTS)
    .findOne({ _id: agentId, owner_id: ownerId })

  if (!agent) {
    return { success: false }
  }

  await db.collection(COLLECTIONS.AGENTS).updateOne(
    { _id: agentId, owner_id: ownerId },
    { $set: { revoked: true } }
  )

  await db.collection(COLLECTIONS.AGENT_TOKENS).updateMany(
    { agent_id: agentId },
    { $set: { revoked: true } }
  )

  return { success: true }
}
