"use client";

import { useState, useEffect } from "react";
import { useCogniInstance } from "@/modules/tenant/TenantProvider";
import type { SessionRow } from "@/modules/sessions/getSessions";
import {
  getConnectedIntegrations,
  setConnectedIntegrations as persistConnectedIntegrations,
} from "@/utils/browserStorage";

// Per-integration session_id prefix. Detection is coarse on purpose — any session
// whose id starts with the prefix counts as connected. Keep these in sync with
// the shipped integrations (claude-code → "cc_", codex → "codex_").
export const INTEGRATION_SESSION_PREFIX: Record<string, string> = {
  "claude-code": "cc_",
  codex: "codex_",
};

export interface ActiveAgentConnection {
  session_id?: string | null;
  agent_session_name?: string | null;
}

export function getConnectedIntegrationsFromActiveConnections(
  connections: ActiveAgentConnection[],
): Record<string, boolean> {
  const connected: Record<string, boolean> = {};
  for (const [key, prefix] of Object.entries(INTEGRATION_SESSION_PREFIX)) {
    if (connections.some((connection) => connection.session_id?.startsWith(prefix))) {
      connected[key] = true;
    }
  }
  return connected;
}

/**
 * Derives and persists per-integration "Connected" state from both active
 * agent connections and session_id prefixes. Active connections are queried
 * directly so a freshly registered agent is visible before its first session
 * row is created. Sticky localStorage remains the fallback for connections
 * that have already been observed.
 */
export function useConnectedIntegrations(
  sessions: SessionRow[],
  tenantId: string | null,
): Record<string, boolean> {
  const { cogniInstance } = useCogniInstance();
  const [activeConnections, setActiveConnections] = useState<ActiveAgentConnection[]>([]);
  const [connectedIntegrations, setConnectedIntegrations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!cogniInstance) return;

    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const response = await cogniInstance.fetch(
          "/v1/agents/connections?active_only=true&limit=500",
        );
        if (!response.ok) return;
        const body = await response.json() as { agents?: ActiveAgentConnection[] };
        if (!cancelled) setActiveConnections(Array.isArray(body.agents) ? body.agents : []);
      } catch {
        // Session-derived and persisted detection remain available if the
        // active-connection endpoint is unavailable.
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => { void refresh(); }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [cogniInstance]);

  useEffect(() => {
    if (!tenantId) return;

    const persisted = getConnectedIntegrations(tenantId);
    const next = { ...persisted };

    for (const [key, prefix] of Object.entries(INTEGRATION_SESSION_PREFIX)) {
      if (sessions.some((s) => s.session_id.startsWith(prefix))) next[key] = true;
    }

    Object.assign(next, getConnectedIntegrationsFromActiveConnections(activeConnections));

    if (JSON.stringify(next) !== JSON.stringify(persisted)) {
      persistConnectedIntegrations(tenantId, next);
    }
    setConnectedIntegrations((prev) =>
      JSON.stringify(prev) !== JSON.stringify(next) ? next : prev,
    );
  }, [activeConnections, sessions, tenantId]);

  return connectedIntegrations;
}
