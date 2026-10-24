// Opens a connection to MongoDB using MONGODB_URI from .env.local.
// Used by setup.js and seed.js so the connection code lives in one place.
import { MongoClient } from "mongodb";
import { DB_NAME } from "../shared/names.ts";

export async function connect() {
  // Read .env.local from the project root (built into Node, no extra package).
  try {
    process.loadEnvFile(new URL("../.env.local", import.meta.url));
  } catch {
    throw new Error("Could not read .env.local in the project root. Create it with MONGODB_URI=...");
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(DB_NAME), uri };
}
