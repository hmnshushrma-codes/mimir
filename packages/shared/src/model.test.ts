import { describe, expect, it } from "vitest";
import { MAIN_AGENT_ID } from "./workshop-event.js";
import type { HookEventEnvelope } from "./raw-hook-events.js";
import type { ProjectInfo } from "./project.js";
import { WorkshopModel } from "./model.js";

function envelope(payload: Record<string, unknown>, timestamp: string): HookEventEnvelope {
  return { ...payload, timestamp } as HookEventEnvelope;
}

function project(id: string, rootPath: string, branch: string | null = null): ProjectInfo {
  return { id, name: rootPath.split("/").pop() ?? rootPath, rootPath, worktreeOf: null, branch };
}

describe("WorkshopModel.ingest", () => {
  it("creates a session and main agent on SessionStart", () => {
    const model = new WorkshopModel();
    const { session, agent } = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/repo" }, "T0")
    );
    expect(session.id).toBe("s1");
    expect(session.cwd).toBe("/repo");
    expect(agent.id).toBe(MAIN_AGENT_ID);
    expect(agent.state.lifecycle).toBe("entering");
  });

  it("tracks a tool call from PreToolUse through PostToolUse", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));

    const { agent } = model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "tu1" },
        "2026-01-01T00:00:00.000Z"
      )
    );
    expect(agent.state.lifecycle).toBe("working");
    expect(agent.activeToolCalls.get("tu1")?.status).toBe("running");

    const { agent: after } = model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_output: "ok", tool_use_id: "tu1" },
        "2026-01-01T00:00:01.500Z"
      )
    );
    expect(after.state.lifecycle).toBe("idle");
    expect(after.activeToolCalls.has("tu1")).toBe(false);
    expect(after.finishedToolCalls).toHaveLength(1);
    expect(after.finishedToolCalls[0].status).toBe("succeeded");
    expect(after.finishedToolCalls[0].durationMs).toBe(1500);
  });

  it("pairs a delegate PreToolUse with the next SubagentStart via FIFO heuristic", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));

    model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "first" }, tool_use_id: "tu-a" },
        "T1"
      )
    );
    model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "second" }, tool_use_id: "tu-b" },
        "T2"
      )
    );

    const { agent: first } = model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "Explore", task_description: "first" },
        "T3"
      )
    );
    const { agent: second } = model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "SubagentStart", agent_id: "agent-2", agent_type: "Explore", task_description: "second" },
        "T4"
      )
    );

    expect(first.parentAgentId).toBe(MAIN_AGENT_ID);
    expect(first.correlation).toBe("heuristic");
    expect(second.parentAgentId).toBe(MAIN_AGENT_ID);
  });

  it("attaches a subagent's own tool calls to its own agent record via agent_id", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));
    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "Explore" }, "T1")
    );

    const { agent } = model.ingest(
      envelope(
        {
          session_id: "s1",
          hook_event_name: "PreToolUse",
          tool_name: "Read",
          tool_input: { file_path: "a.ts" },
          tool_use_id: "tu-c",
          agent_id: "agent-1",
          agent_type: "Explore"
        },
        "T2"
      )
    );

    expect(agent.id).toBe("agent-1");
    expect(agent.activeToolCalls.get("tu-c")?.toolName).toBe("Read");

    const session = model.getSession("s1");
    expect(session?.agents.get(MAIN_AGENT_ID)?.activeToolCalls.size).toBe(0);
  });

  it("resolveParentByToolUseId survives the FIFO queue being consumed", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));
    model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Task", tool_input: {}, tool_use_id: "tu-z" },
        "T1"
      )
    );
    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SubagentStart", agent_id: "agent-9", agent_type: "Explore" }, "T2")
    );

    expect(model.resolveParentByToolUseId("s1", "tu-z")).toBe(MAIN_AGENT_ID);
  });

  it("confirmDelegation upgrades correlation to confirmed", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));
    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "Explore" }, "T1")
    );

    model.confirmDelegation("s1", "agent-1", MAIN_AGENT_ID, "confirmed task");
    const agent = model.getSession("s1")?.agents.get("agent-1");
    expect(agent?.correlation).toBe("confirmed");
    expect(agent?.taskDescription).toBe("confirmed task");
  });

  it("sweepPresence marks agents idle then stale based on elapsed time", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"));

    model.sweepPresence("2026-01-01T00:00:10.000Z", 5_000, 60_000);
    expect(model.getSession("s1")?.agents.get(MAIN_AGENT_ID)?.presence).toBe("idle");

    model.sweepPresence("2026-01-01T00:02:00.000Z", 5_000, 60_000);
    expect(model.getSession("s1")?.agents.get(MAIN_AGENT_ID)?.presence).toBe("stale");
  });
});

describe("WorkshopModel project linkage", () => {
  it("links a session to the project resolved for its cwd", () => {
    const model = new WorkshopModel();
    const { session, project: proj } = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/repo/api" }, "T0"),
      project("proj-api", "/repo/api")
    );
    expect(session.projectId).toBe("proj-api");
    expect(proj.id).toBe("proj-api");
    expect(proj.name).toBe("api");
    expect(model.getProject("proj-api")?.rootPath).toBe("/repo/api");
  });

  it("falls back to a cwd-derived project when none is supplied (demo mode)", () => {
    const model = new WorkshopModel();
    const { session } = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/home/demo/my-app" }, "T0")
    );
    const proj = model.getProject(session.projectId);
    expect(proj?.name).toBe("my-app");
  });

  it("only refreshes branch when the resolver supplies a non-null value", () => {
    const model = new WorkshopModel();
    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/repo/api" }, "T0"),
      project("proj-api", "/repo/api", "main")
    );
    expect(model.getSession("s1")?.branch).toBe("main");

    // A later event where the resolver didn't bother re-querying branch
    // (branch: null) must not clobber the previously known branch.
    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "tu1" }, "T1"),
      project("proj-api", "/repo/api", null)
    );
    expect(model.getSession("s1")?.branch).toBe("main");

    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "do a thing" }, "T2"),
      project("proj-api", "/repo/api", "feature-x")
    );
    expect(model.getSession("s1")?.branch).toBe("feature-x");
  });

  it("two sessions in the same repo share one project record", () => {
    const model = new WorkshopModel();
    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup", cwd: "/repo/api" }, "T0"),
      project("proj-api", "/repo/api")
    );
    model.ingest(
      envelope({ session_id: "s2", hook_event_name: "SessionStart", source: "startup", cwd: "/repo/api" }, "T1"),
      project("proj-api", "/repo/api")
    );
    expect(model.getProjects()).toHaveLength(1);
    expect(model.getSession("s1")?.projectId).toBe(model.getSession("s2")?.projectId);
  });
});

describe("WorkshopModel session lifecycle", () => {
  it("SessionEnd marks the session ended immediately, independent of the sweep", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));
    const { session } = model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionEnd", reason: "other" }, "T1"));
    expect(session.status).toBe("ended");
  });

  it("sweepSessionStatus moves a quiet session through idle to ended", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"));

    model.sweepSessionStatus("2026-01-01T00:00:10.000Z", 5_000, 60_000);
    expect(model.getSession("s1")?.status).toBe("idle");

    model.sweepSessionStatus("2026-01-01T00:02:00.000Z", 5_000, 60_000);
    expect(model.getSession("s1")?.status).toBe("ended");
  });

  it("an explicitly ended session is never resurrected by the sweep", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"));
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionEnd", reason: "other" }, "2026-01-01T00:00:01.000Z"));

    const touched = model.sweepSessionStatus("2026-01-01T00:00:02.000Z", 5_000, 60_000);
    expect(touched).toHaveLength(0);
    expect(model.getSession("s1")?.status).toBe("ended");
  });

  it("a fresh event brings a session back to active after it went idle", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"));
    model.sweepSessionStatus("2026-01-01T00:00:10.000Z", 5_000, 60_000);
    expect(model.getSession("s1")?.status).toBe("idle");

    model.ingest(
      envelope({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "tu1" }, "2026-01-01T00:00:11.000Z")
    );
    expect(model.getSession("s1")?.status).toBe("active");
  });
});

describe("WorkshopModel cross-session isolation (critical)", () => {
  // Fixture: 3 sessions across 2 projects — s1 alone in project A, s2 and s3
  // both in project B (2 sessions, same repo). Every session reuses the
  // exact same agent_id, tool_use_id, and delegate tool_use_id strings, and
  // every SubagentStart fires at the identical timestamp, specifically to
  // stress the case where naive global (non-session-scoped) keying would
  // leak state across sessions.
  const PROJECT_A = project("proj-a", "/repos/project-a");
  const PROJECT_B = project("proj-b", "/repos/project-b");

  function runFixture() {
    const model = new WorkshopModel();
    const sessions = [
      { id: "s1", proj: PROJECT_A, taskDescription: "s1 task" },
      { id: "s2", proj: PROJECT_B, taskDescription: "s2 task" },
      { id: "s3", proj: PROJECT_B, taskDescription: "s3 task" }
    ];

    // Interleaved: SessionStart for all three before anything else happens.
    for (const s of sessions) {
      model.ingest(envelope({ session_id: s.id, hook_event_name: "SessionStart", source: "startup", cwd: s.proj.rootPath }, "T0"), s.proj);
    }

    // Interleaved delegate PreToolUse, same tool_use_id string in every session.
    for (const s of sessions) {
      model.ingest(
        envelope(
          { session_id: s.id, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: s.taskDescription }, tool_use_id: "tu-delegate" },
          "T1"
        ),
        s.proj
      );
    }

    // SubagentStart for all three at the identical timestamp, same agent_id.
    for (const s of sessions) {
      model.ingest(
        envelope({ session_id: s.id, hook_event_name: "SubagentStart", agent_id: "agent-1", agent_type: "Explore", task_description: s.taskDescription }, "T2"),
        s.proj
      );
    }

    // Each subagent runs a tool call, same tool_use_id string in every session.
    for (const s of sessions) {
      model.ingest(
        envelope(
          { session_id: s.id, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: `echo ${s.id}` }, tool_use_id: "tu-shared", agent_id: "agent-1", agent_type: "Explore" },
          "T3"
        ),
        s.proj
      );
    }
    for (const s of sessions) {
      model.ingest(
        envelope(
          { session_id: s.id, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: `echo ${s.id}` }, tool_output: s.id, tool_use_id: "tu-shared", agent_id: "agent-1", agent_type: "Explore" },
          "T4"
        ),
        s.proj
      );
    }

    return { model, sessions };
  }

  it("groups sessions under exactly their own projects", () => {
    const { model } = runFixture();
    expect(model.getProjects()).toHaveLength(2);
    expect(model.getSession("s1")?.projectId).toBe("proj-a");
    expect(model.getSession("s2")?.projectId).toBe("proj-b");
    expect(model.getSession("s3")?.projectId).toBe("proj-b");
  });

  it("each session's subagent is parented to its own main agent, never another session's", () => {
    const { model } = runFixture();
    for (const id of ["s1", "s2", "s3"]) {
      const subagent = model.getSession(id)?.agents.get("agent-1");
      expect(subagent?.parentAgentId).toBe(MAIN_AGENT_ID);
      expect(subagent?.sessionId).toBe(id);
    }
  });

  it("each session's subagent retains its own task description, not another session's", () => {
    const { model } = runFixture();
    expect(model.getSession("s1")?.agents.get("agent-1")?.taskDescription).toBe("s1 task");
    expect(model.getSession("s2")?.agents.get("agent-1")?.taskDescription).toBe("s2 task");
    expect(model.getSession("s3")?.agents.get("agent-1")?.taskDescription).toBe("s3 task");
  });

  it("the shared tool_use_id resolves to each session's own delegate, never a different session's", () => {
    const { model } = runFixture();
    for (const id of ["s1", "s2", "s3"]) {
      expect(model.resolveParentByToolUseId(id, "tu-delegate")).toBe(MAIN_AGENT_ID);
    }
    // Cross-session lookups must come back empty, not accidentally resolved
    // via some other session's queue.
    expect(model.resolveParentByToolUseId("does-not-exist", "tu-delegate")).toBeNull();
  });

  it("the shared tool_use_id's finished tool call carries each session's own output, never another's", () => {
    const { model } = runFixture();
    for (const id of ["s1", "s2", "s3"]) {
      const subagent = model.getSession(id)?.agents.get("agent-1");
      const call = subagent?.finishedToolCalls.find((c) => c.toolUseId === "tu-shared");
      expect(call?.status).toBe("succeeded");
      expect(call?.target).toBe(`echo ${id}`);
    }
  });

  it("confirming delegation in one session never touches another session's agent of the same id", () => {
    const { model } = runFixture();
    // taskDescription is already known from SubagentStart, so confirmDelegation
    // (by design) won't overwrite it — only the correlation flag changes here.
    model.confirmDelegation("s2", "agent-1", MAIN_AGENT_ID, "confirmed only for s2");

    expect(model.getSession("s2")?.agents.get("agent-1")?.correlation).toBe("confirmed");
    expect(model.getSession("s2")?.agents.get("agent-1")?.taskDescription).toBe("s2 task");

    expect(model.getSession("s1")?.agents.get("agent-1")?.correlation).toBe("heuristic");
    expect(model.getSession("s1")?.agents.get("agent-1")?.taskDescription).toBe("s1 task");
    expect(model.getSession("s3")?.agents.get("agent-1")?.correlation).toBe("heuristic");
    expect(model.getSession("s3")?.agents.get("agent-1")?.taskDescription).toBe("s3 task");
  });
});

describe("WorkshopModel mood integration", () => {
  it("sets mood from the lifecycle reached after each ingest", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));

    const working = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "tu1" }, "2026-01-01T00:00:00.000Z")
    );
    expect(working.agent.mood).toBe("focused");

    const idle = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_output: "ok", tool_use_id: "tu1" }, "2026-01-01T00:00:01.000Z")
    );
    expect(idle.agent.mood).toBe("sleepy");
  });

  it("a delegate tool call sets mood to excited", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));
    const { agent } = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: {}, tool_use_id: "tu1" }, "T1")
    );
    expect(agent.mood).toBe("excited");
  });

  it("waiting_permission sets mood to worried", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));
    const { agent } = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "Notification", notification_type: "permission_prompt", message: "..." }, "T1")
    );
    expect(agent.mood).toBe("worried");
  });

  it("escalates from dizzy to frustrated after 3 consecutive tool failures, and resets on success", () => {
    const model = new WorkshopModel();
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "T0"));

    function fail(toolUseId: string, at: string) {
      return model.ingest(
        envelope({ session_id: "s1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, tool_use_id: toolUseId, error: "boom" }, at)
      );
    }

    expect(fail("tu1", "T1").agent.mood).toBe("dizzy");
    expect(fail("tu2", "T2").agent.mood).toBe("dizzy");
    expect(fail("tu3", "T3").agent.mood).toBe("frustrated");
    expect(model.getSession("s1")?.agents.get(MAIN_AGENT_ID)?.consecutiveErrors).toBe(3);

    const recovered = model.ingest(
      envelope({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_output: "ok", tool_use_id: "tu4" }, "T4")
    );
    expect(recovered.agent.consecutiveErrors).toBe(0);

    const nextFailure = fail("tu5", "T5");
    expect(nextFailure.agent.mood).toBe("dizzy");
  });

  it("sweepMoods transitions working -> concentrating once a tool call has run long enough, with no new event", () => {
    const model = new WorkshopModel(15_000);
    model.ingest(envelope({ session_id: "s1", hook_event_name: "SessionStart", source: "startup" }, "2026-01-01T00:00:00.000Z"));
    const { agent } = model.ingest(
      envelope(
        { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "sleep 30" }, tool_use_id: "tu1" },
        "2026-01-01T00:00:00.000Z"
      )
    );
    expect(agent.mood).toBe("focused");

    const unchanged = model.sweepMoods("2026-01-01T00:00:05.000Z");
    expect(unchanged).toHaveLength(0);
    expect(model.getSession("s1")?.agents.get(MAIN_AGENT_ID)?.mood).toBe("focused");

    const touched = model.sweepMoods("2026-01-01T00:00:20.000Z");
    expect(touched).toEqual([{ sessionId: "s1", agentId: MAIN_AGENT_ID }]);
    expect(model.getSession("s1")?.agents.get(MAIN_AGENT_ID)?.mood).toBe("concentrating");
  });
});
