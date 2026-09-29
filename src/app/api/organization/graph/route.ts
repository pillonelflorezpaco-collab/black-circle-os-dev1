import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrganizationGraph } from "@/services/organization.service";

/**
 * Read-only Neo4j organizational graph, for the BlackOS dashboard. Session-
 * authed like the rest of the dashboard (not /api/engine/**, since there's
 * no per-agency scoping concept for the org graph — it's the same graph
 * for the whole system, same as /ecosysteme's mock data is today).
 *
 * This is the documented "adapter" endpoint requested for the Command
 * Center's Organization panel (see docs/command-center.md) — it does not
 * exist as a client-facing route until this file; the Command Center page
 * itself calls the same underlying service function server-side rather than
 * fetching its own API, but this route exists for any other consumer.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const graph = await getOrganizationGraph();
    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
