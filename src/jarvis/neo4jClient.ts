import neo4j, { type Driver } from "neo4j-driver";

// Singleton driver, same pattern as src/lib/prisma.ts's cached client.
// Read-only for Jarvis Core — no Cypher write ever issued from this module.
const globalForNeo4j = globalThis as unknown as { neo4jDriver: Driver | undefined };

function createDriver(): Driver {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !password) {
    throw new Error("Neo4j is not configured (NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD).");
  }
  return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

export function getNeo4jDriver(): Driver {
  if (!globalForNeo4j.neo4jDriver) {
    globalForNeo4j.neo4jDriver = createDriver();
  }
  return globalForNeo4j.neo4jDriver;
}

/** Runs a single read-only Cypher query in its own session. */
export async function runReadQuery<T = Record<string, unknown>>(cypher: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const session = getNeo4jDriver().session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}
