// Adapter contract between the BlackOS UI and the Neo4j organizational graph
// (see /opt/neo4j/README.md). Kept as a plain data shape so React components
// never talk to Neo4j directly — only src/services/organization.service.ts
// (server-side) knows how to produce this shape.
export interface OrganizationDepartment {
  key: string;
  name: string;
  status: string;
  agentCount: number;
}

export interface OrganizationAgent {
  key: string;
  name: string;
  type: string;
  status: string;
  departmentKey: string | null;
}

export interface OrganizationCapability {
  key: string;
  name: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  agentKey: string | null;
  toolKeys: string[];
}

export interface OrganizationTool {
  key: string;
  name: string;
  type: string;
}

export interface OrganizationGraphData {
  departments: OrganizationDepartment[];
  agents: OrganizationAgent[];
  capabilities: OrganizationCapability[];
  tools: OrganizationTool[];
}
