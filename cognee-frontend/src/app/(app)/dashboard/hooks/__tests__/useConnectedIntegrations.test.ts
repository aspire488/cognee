import {
  getConnectedIntegrationsFromActiveConnections,
  type ActiveAgentConnection,
} from "../useConnectedIntegrations";

describe("getConnectedIntegrationsFromActiveConnections", () => {
  it("marks recognized integrations connected before a session row exists", () => {
    const connections: ActiveAgentConnection[] = [
      { session_id: "codex_123", agent_session_name: "codex-123" },
    ];

    expect(getConnectedIntegrationsFromActiveConnections(connections)).toEqual({
      codex: true,
    });
  });

  it("does not infer a connection from an unrelated session prefix", () => {
    const connections: ActiveAgentConnection[] = [
      { session_id: "other_123", agent_session_name: "other-123" },
    ];

    expect(getConnectedIntegrationsFromActiveConnections(connections)).toEqual({});
  });

  it("handles missing session identifiers", () => {
    const connections: ActiveAgentConnection[] = [
      { session_id: null },
      { agent_session_name: "codex-123" },
    ];

    expect(getConnectedIntegrationsFromActiveConnections(connections)).toEqual({});
  });
});
