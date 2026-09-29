import { runReadQuery } from "./neo4jClient";
import type { IntentKey, ResolvedAgent, ResolvedCapability, ResolvedDepartment, ResolvedTool, RiskLevel } from "./types";

export interface GraphResolution {
  department: ResolvedDepartment;
  agent: ResolvedAgent;
  capability: ResolvedCapability;
  tools: ResolvedTool[];
}

/**
 * Resolves a capability's full organizational context from the Neo4j graph
 * seeded in /opt/neo4j/seed_foundation.cypher: which agent has it, which
 * department that agent belongs to, and which tool(s) perform it. Read-only
 * — never writes, never invents structure not already present in the graph.
 * Returns null if the capability (or an agent holding it) doesn't exist.
 */
export async function resolveCapabilityContext(intent: IntentKey): Promise<GraphResolution | null> {
  const rows = await runReadQuery<{
    departmentKey: string;
    departmentName: string;
    agentKey: string;
    agentName: string;
    agentType: string;
    capabilityKey: string;
    riskLevel: string;
    toolKey: string;
    toolType: string;
  }>(
    `
    MATCH (a:Agent)-[:HAS_CAPABILITY]->(c:Capability {key: $intent})
    MATCH (a)-[:BELONGS_TO]->(d:Department)
    OPTIONAL MATCH (c)-[:PERFORMED_VIA]->(t:Tool)
    RETURN d.key AS departmentKey, d.name AS departmentName,
           a.key AS agentKey, a.name AS agentName, a.type AS agentType,
           c.key AS capabilityKey, c.riskLevel AS riskLevel,
           t.key AS toolKey, t.type AS toolType
    `,
    { intent },
  );

  if (rows.length === 0) return null;

  const first = rows[0];
  const tools: ResolvedTool[] = rows.filter((r) => r.toolKey).map((r) => ({ key: r.toolKey, type: r.toolType }));

  return {
    department: { key: first.departmentKey, name: first.departmentName },
    agent: { key: first.agentKey, name: first.agentName, type: first.agentType },
    capability: { key: first.capabilityKey, riskLevel: first.riskLevel as RiskLevel },
    tools,
  };
}
