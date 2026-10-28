# Agent Workshop

A live, animated view of what Claude Code is doing — the main agent, any
subagents it starts, and every tool call — rendered as a little cartoon
workshop scene. Includes a plain tree/log debug view for when you want facts
instead of characters.

```
Claude Code hooks ──POST JSON──▶ collector server ──WebSocket──▶ React app
                                   │                              (workshop scene + debug view)
                                   ▼
                                 SQLite (event log, replay)
```

- **`packages/shared`** — hook payload types, the normalizer, the agent
  state machine, and `WorkshopModel` (the in-memory session/agent/tool-call
  aggregator used by *both* the server and the web app's demo mode, so they
  never drift).
- **`packages/server`** — Fastify + `ws` + `node:sqlite` collector. Validates
  incoming events, stores them, normalizes them, and broadcasts live updates.
- **`packages/web`** — React + Vite + Zustand + Framer Motion frontend: the
  animated workshop scene and the debug view.
- **`packages/hooks`** — the hook script Claude Code actually runs, and the
  `agent-workshop install`/`uninstall` CLI that wires it into your settings.
- **`docs/hook-events.md`** — the actual, verified Claude Code hooks
  reference this whole project is built from (not from memory — fetched from
  the live docs and cross-checked against this repo's own session
  transcripts). Read it before touching anything in `packages/shared`'s raw
  hook types.

## Setup

Requires Node ≥ 22.5 (for the built-in `node:sqlite` module) and pnpm.

```bash
pnpm install
pnpm dev
```

This starts the collector on `http://127.0.0.1:4000` and the web app on
`http://localhost:5173`. At this point the web app has nothing to show yet —
it's waiting for either real hook traffic (see **Install the hooks** below)
or demo mode.

## Demo mode

See the whole thing animate with no Claude Code session required — one main
agent, three parallel subagents, a mix of read/edit/bash/web calls, a
permission wait, an error, and subagents finishing at different times:

```bash
pnpm demo
```

Or, with the regular dev server already running, open
`http://localhost:5173/?demo=1` — demo mode runs entirely client-side and
plays the same scripted event stream through the real `WorkshopModel`, so
it exercises the same normalization and state-machine code the real
collector uses, not a separate mock.

## Install the hooks

```bash
cd packages/hooks && pnpm build   # only needed once, or after pulling hook changes
node dist/cli.js install          # writes hooks into ~/.claude/settings.json
```

(Once published, this will just be `npx agent-workshop install`.)

- Add `--project` to target `.claude/settings.json` in the current directory
  instead of your global `~/.claude/settings.json`.
- The installer backs up whichever settings file it touches to
  `<file>.bak` before writing.
- It's idempotent — running `install` again replaces its own hook entries
  rather than duplicating them, and never touches another tool's hooks
  registered on the same event.
- The actual hook script is written once to
  `~/.claude/agent-workshop/hook-runner.mjs` (always under your real home
  directory, even with `--project` — only the settings-file target differs).

To remove everything:

```bash
node packages/hooks/dist/cli.js uninstall   # or --project
```

This restores the settings file to exactly what it looked like before
(apart from the removed hooks) and deletes the hook script.

Once installed, start a real Claude Code session (with the collector server
running) and tool calls, subagent spawns, permission prompts, errors, etc.
will appear live in the web app within about a second.

### What gets registered

`SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Notification`, `Stop`
— the brief's explicit list plus `PostToolUseFailure`, without which the
error/smoke-puff animation could only ever fire from demo data. See
`docs/hook-events.md` for the exact payload shapes and the full event list.

### The hook script's contract (non-negotiable)

- Timeout of ≤1 second (`timeout: 1` in the registered hook, plus its own
  internal 700ms fetch timeout and 900ms hard watchdog).
- Always exits 0.
- Writes nothing to stdout or stderr, ever.
- If the collector is down or unreachable, fails completely silently.

This is covered by an integration test
(`packages/hooks/src/hook-runner.test.ts`) that spawns the real script
against both a live test server and an unreachable one and asserts on
exactly these properties.

### Subagent correlation: what's solid, what's a heuristic

A subagent's own hook events (`PreToolUse` inside it, etc.) are reliably tied
to *that* subagent via `agent_id`/`agent_type`. But no hook payload —
confirmed against the live docs — tells you which parent tool call spawned a
given subagent. We pair a delegate `PreToolUse` with the next `SubagentStart`
on a FIFO basis (works correctly for the overwhelmingly common case: one
subagent at a time, or sequential spawns), and opportunistically upgrade that
guess to "confirmed" using an **undocumented** `agent-<id>.meta.json` file we
found sitting next to each subagent's transcript on disk, which happens to
contain the exact spawning `tool_use_id`. If that file is missing or the
format changes in a future Claude Code version, the heuristic pairing still
stands on its own — nothing breaks, it just stays a labeled guess. The
`correlation` field on each agent (visible in the debug tree) tells you which
one you're looking at. Full writeup and trade-off reasoning:
`docs/hook-events.md` §4.

## Configuration

All via environment variables, all optional.

**Collector server** (`packages/server`):

| Variable | Default | Meaning |
|---|---|---|
| `AGENT_WORKSHOP_PORT` | `4000` | HTTP/WS port |
| `AGENT_WORKSHOP_HOST` | `127.0.0.1` | Bind address |
| `AGENT_WORKSHOP_DB_PATH` | `./agent-workshop.sqlite` | SQLite file location |
| `AGENT_WORKSHOP_PREVIEWS` | `true` | Store tool input/output previews at all — see **Privacy** |
| `AGENT_WORKSHOP_PREVIEW_MAX_LEN` | `500` | Preview truncation length (characters) |
| `AGENT_WORKSHOP_IDLE_MS` | `30000` | No events for this long → agent marked idle (presence, not lifecycle) |
| `AGENT_WORKSHOP_STALE_MS` | `300000` | No events for this long → agent marked stale |
| `AGENT_WORKSHOP_SWEEP_INTERVAL_MS` | `5000` | How often presence/departure are re-checked |
| `AGENT_WORKSHOP_DEPART_AFTER_MS` | `4000` | How long a "done" worker shows its thumbs-up before walking out |

**Hook script** (`packages/hooks`):

| Variable | Default | Meaning |
|---|---|---|
| `AGENT_WORKSHOP_URL` | `http://127.0.0.1:4000/events` | Where the hook POSTs events |

**Web app** (`packages/web`, build-time `VITE_`-prefixed):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_COLLECTOR_WS_URL` | `ws://localhost:4000/ws` | Collector WebSocket URL (the REST base URL for replay is derived from this) |

## Privacy notes

- Everything is local: hook → `127.0.0.1` → SQLite on your own disk. No
  telemetry, no external network calls from any package in this repo.
- Tool call inputs/outputs are stored only as short previews (500 characters
  by default) — set `AGENT_WORKSHOP_PREVIEWS=false` to store none at all.
  Full raw event JSON is still stored either way (`raw_json` column) since
  that's needed for the normalizer and for replay; if that's a concern in
  your environment, point `AGENT_WORKSHOP_DB_PATH` at a location you control
  the retention of, or periodically delete the SQLite file.
- The collector's REST endpoints allow all origins (CORS) by design — it's a
  localhost developer tool with no auth, not something to expose beyond your
  own machine.
- Uninstalling removes the hook script and every hook entry this tool added;
  it never touches hooks belonging to other tools on the same event, and it
  always leaves a `.bak` of whatever settings file it last touched.

## Development

```bash
pnpm build       # build all packages (also runs automatically before dev/demo/test/typecheck)
pnpm test        # vitest across all packages (85 tests)
pnpm lint        # eslint across all packages
pnpm typecheck   # tsc --noEmit across all packages
```

`packages/shared` builds to `dist/` like everything else (not consumed as
raw TypeScript) — the root `predev`/`predemo`/`pretest`/`pretypecheck`
scripts build it automatically, so `pnpm install && pnpm dev` works on a
fresh clone with no extra steps, matching the acceptance criteria this
project was built against.
