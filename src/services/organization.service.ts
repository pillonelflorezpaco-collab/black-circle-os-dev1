import { runReadQuery } from "@/jarvis/neo4jClient";
import type { OrganizationGraphData } from "@/types/organization";

/** Neo4j returns count(...) as its own Integer type, not a plain JS number. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Reads the real Neo4j organizational graph (seeded in
 * /opt/neo4j/seed_foundation.cypher) for the BlackOS frontend. Read-only —
 * reuses the existing Jarvis Core Neo4j client (src/jarvis/neo4jClient.ts)
 * rather than opening a second connection or duplicating query logic.
 * Never writes, never touches Jarvis Core's own resolution logic.
 */
export async function getOrganizationGraph(): Promise<OrganizationGraphData> {
  const [departments, agents, capabilities, tools] = await Promise.all([
    runReadQuery<{ key: string; name: string; status: string; agentCount: number }>(
      `MATCH (d:Department)
       OPTIONAL MATCH (d)-[:CONTAINS_AGENT]->(a:Agent)
       RETURN d.key AS key, d.name AS name, d.status AS status, count(a) AS agentCount
       ORDER BY d.key`,
    ),
    runReadQuery<{ key: string; name: string; type: string; status: string; departmentKey: string | null }>(
      `MATCH (a:Agent)
       OPTIONAL MATCH (a)-[:BELONGS_TO]->(d:Department)
       RETURN a.key AS key, a.name AS name, a.type AS type, a.status AS status, d.key AS departmentKey
       ORDER BY a.key`,
    ),
    runReadQuery<{ key: string; name: string; riskLevel: string; agentKey: string | null; toolKeys: string[] }>(
      `MATCH (c:Capability)
       OPTIONAL MATCH (a:Agent)-[:HAS_CAPABILITY]->(c)
       OPTIONAL MATCH (c)-[:PERFORMED_VIA]->(t:Tool)
       RETURN c.key AS key, c.name AS name, c.riskLevel AS riskLevel, a.key AS agentKey, collect(DISTINCT t.key) AS toolKeys
       ORDER BY c.key`,
    ),
    runReadQuery<{ key: string; name: string; type: string }>(`MATCH (t:Tool) RETURN t.key AS key, t.name AS name, t.type AS type ORDER BY t.key`),
  ]);

  return {
    departments: departments.map((d) => ({ ...d, agentCount: toNumber(d.agentCount) })),
    agents,
    capabilities: capabilities.map((c) => ({ ...c, riskLevel: c.riskLevel as "LOW" | "MEDIUM" | "HIGH" })),
    tools,
  };
}
