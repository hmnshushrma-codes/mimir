# Mimir

Live animated visualization of Claude Code sessions — watch your AI agents
work at their desks in a workshop room.

Each agent is a character sitting at a desk with a monitor. The foreman
(main agent) receives instructions from you, delegates to workers
(subagents), and you can see every tool call, permission wait, error,
and delegation happening in real time.

```
You (User) --> Foreman --> Workers (subagents)
   |              |            |
   prompt    delegates    tool calls
                           (read, write, bash, grep...)
```

## Quick start

**Requires Node >= 22.5** (for built-in SQLite).

```bash
# Install from npm
npx mimir-dev install    # Wire up Claude Code hooks (one-time)
npx mimir-dev            # Start the visualization

# Or from source
git clone https://github.com/hmnshushrma-codes/mimir.git
cd mimir
pnpm install && pnpm build
pnpm start
```

Open `http://localhost:4000` in your browser. Start a Claude Code session
and watch the agents appear.

## Demo mode

See it without a real Claude Code session:

```bash
npx mimir-dev demo
```

## Commands

| Command | Description |
|---|---|
| `mimir` | Start collector + web UI |
| `mimir demo` | Start with demo data |
| `mimir install` | Install Claude Code hooks (user scope) |
| `mimir install --project` | Install hooks for current project only |
| `mimir uninstall` | Remove hooks |
| `mimir status` | Check hook install & collector status |

## What you'll see

- **Workshop room** with pegboard, window, and time-based lighting (sunlight during day, warm lamps at night)
- **You** — a customizable avatar (click the pencil icon to change hair, skin, glasses, shirt, expression)
- **Foreman** — the main Claude Code agent at a big desk with a monitor showing code
- **Workers** — subagents at smaller desks, each with role labels (Explore, Plan, general-purpose)
- **Cable-managed wires** — trunk + branch wiring from foreman to each worker
- **Delegation blobs** — animated dots traveling along wires when work is delegated
- **Moods** — focused (typing), worried (permission wait, jumping + ?), dizzy/frustrated (errors), sleepy (idle, holding phone)
- **Blinking eyes** — characters blink periodically
- **Side panel** — click any character to see their tool call timeline

## How it works

```
Claude Code hooks --> POST events --> Collector server --> WebSocket --> React app
                                         |
                                       SQLite (event log)
```

1. Claude Code fires hook events (tool calls, subagent spawns, etc.)
2. A tiny hook script POSTs them to the local collector server
3. The collector normalizes events, updates the state model, stores in SQLite
4. The React app receives updates via WebSocket and renders the workshop

## Privacy

- Everything is **local** — hooks send to `127.0.0.1`, no external network calls
- Tool inputs/outputs are stored as short previews (500 chars) — set `AGENT_WORKSHOP_PREVIEWS=false` for none
- Uninstall removes all hooks cleanly, never touches other tools' hooks

## Configuration

All via environment variables, all optional:

| Variable | Default | Description |
|---|---|---|
| `AGENT_WORKSHOP_PORT` | `4000` | Server port |
| `AGENT_WORKSHOP_HOST` | `127.0.0.1` | Bind address |
| `AGENT_WORKSHOP_PREVIEWS` | `true` | Store tool previews |
| `AGENT_WORKSHOP_IDLE_MS` | `120000` | Agent idle timeout (ms) |

## Development

```bash
pnpm install
pnpm dev          # Collector (:4000) + Vite (:5173) with hot reload
pnpm test         # 189 tests across all packages
pnpm typecheck
pnpm lint
```

## License

MIT
