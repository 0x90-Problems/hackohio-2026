
import { MongoClient } from "mongodb"
import { DB_NAME } from "@/shared/names"

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("MONGODB_URI is not configured")
}

const client = new MongoClient(uri)

export const clientPromise = client.connect()

export async function getDatabase() {
  const connectedClient = await clientPromise
  return connectedClient.db(DB_NAME)
}

