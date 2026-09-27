"use client";

import { useTransition } from "react";
import { toggleAgencyStatusAction } from "./actions";

export default function AgencyStatusToggle({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) {
  const [isPending, startTransition] = useTransition();
  const isActive = status === "ACTIVE";

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleAgencyStatusAction(id, isActive ? "SUSPENDED" : "ACTIVE"))}
      style={{
        background: isActive ? "rgba(127,174,134,.14)" : "var(--bc-surface-2)",
        color: isActive ? "var(--bc-green)" : "var(--bc-text-faint)",
        border: "1px solid var(--bc-border)",
        fontSize: 10.5,
        fontFamily: "var(--font-jbmono)",
        padding: "4px 10px",
        borderRadius: 20,
        cursor: isPending ? "wait" : "pointer",
      }}
    >
      {isActive ? "Active" : "Suspendue"}
    </button>
  );
}
