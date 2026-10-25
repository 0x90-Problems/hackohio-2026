import { MongoClient, type Db } from "mongodb"

import { DB_NAME } from "@/shared/names"

const globalForMongo = globalThis as unknown as { mongo?: Promise<MongoClient> }

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error("MONGODB_URI is not set")
  if (!globalForMongo.mongo) {
    const client = new MongoClient(uri)
    globalForMongo.mongo = client.connect()
  }
  const client = await globalForMongo.mongo
  return client.db(DB_NAME)
}
