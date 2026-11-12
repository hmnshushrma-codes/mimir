# Mimir

**[Live Demo](https://mimir-demo.ninoforge.com)** — try it in your browser, no install needed ·
**[Docs](https://mimir-demo.ninoforge.com/docs)**

> The demo is fully simulated — no real sessions, API keys, or backend required.

![The Mimir workshop: the Foreman delegating to subagents at their desks](packages/web/public/screenshots/workshop.png)

Watch your AI coding agents work in real time. Mimir visualizes Claude Code
sessions as animated characters sitting at desks — you see every tool call,
delegation, permission request, error, and celebration as it happens.

## Features

### Live Workshop
- **Foreman** at a desk with laptop, coffee mug, and idle animations
- **Workers** (subagents) spawn at smaller desks with role labels
- Smooth Bézier-curve arms, blinking eyes, breathing animations
- States: typing, reading, thinking, error (scratch head), permission (raise hand), sleeping (eyes closed + Zzz), celebrate (thumbs up + sparkles)

### Token & Cost Intelligence

![Tokens tab: conversations, responses, words, memory gauge, cost breakdown](packages/web/public/screenshots/tokens.png)

- **Plain-English Token Dashboard** — conversations, AI responses, words written, memory usage
- **Memory Gauge** — context window fill percentage with actionable tips (/compact, /clear)
- **Cost Breakdown** — API-equivalent estimates with clear "not your actual bill" labeling
- **Savings Tips** — automatic detection of context re-reads, long sessions, high memory usage
- **Per-Session & Subagent Breakdown** — expandable rows showing token usage per agent

### Permission Approval (Phase B)

![Permission popup: destructive command with Allow/Deny buttons and mascot YES/NO signs](packages/web/public/screenshots/permission.png)

- **Remote Approval** — answer Claude Code permission prompts from the browser dashboard
- **Docked Side Panel** — full tool detail (command, file path, URL), risk tags, counting timer
- **Risk Classification** — DESTRUCTIVE (rm -rf, force push, drop table), EXTERNAL (curl, git push)
- **Clickable Mascot Signs** — YES/NO signs on characters answer the pending request
- **First-Answer-Wins** — terminal and dashboard race; whoever answers first wins
- **Secret Redaction** — API keys, tokens, passwords redacted in display (not in execution)
- **Security** — auth token, Origin validation, single-use decisions, audit log

### Analytics

![Analytics overview: sessions, agents, tool calls, failures, permissions, total time](packages/web/public/screenshots/analytics.png)

- **Session Analytics** — agents, tool calls, failures, duration per session
- **Tool Execution Analytics** — most used tools, success/failure rates, avg duration, retries
- **Agent Performance** — per-session agent metrics
- **Prompt Quality Scoring** — 10-dimension deterministic assessment (no LLM needed)
- **Knowledge Intelligence** — CLAUDE.md detection, gap detection with recommendations
- **Permission Tracking** — full lifecycle (request → pending → approved/cancelled with wait duration)

### Session Tools
- **Timeline** — chronological tool call list per session
- **Historical Replay** — play/pause/step through past sessions
- **Session Comparison** — side-by-side metrics for two sessions

### Demo Mode
- Interactive control bar: trigger permission requests, spawn agents, errors, finish
- 75-second looping scenario with 3 subagents, error+retry, permission prompt
- Zero backend — runs entirely in the browser

```
You (User) --> Foreman --> Workers (subagents)
   |              |            |
   prompt    delegates    tool calls
                           (read, write, bash, grep...)
```

## Quick start

**Requires Node >= 22.13** (for built-in SQLite).

```bash
# Install from npm
npx mimir-dev install    # Wire up Claude Code hooks (one-time)
npx mimir-dev            # Start the visualization

# Or from source
git clone https://github.com/hmnshushrma-codes/mimir.git
cd mimir
nvm use            # optional — picks Node 22 from .nvmrc
pnpm bootstrap       # install, build, and link the `mimir` command globally
mimir install      # Wire up Claude Code hooks (one-time)
mimir start        # Start the visualization
```

`pnpm bootstrap` symlinks the `mimir` command into npm's global bin directory.
If you'd rather not link it, run `pnpm start` from the repo instead.

Open `http://localhost:4000` in your browser. Start a Claude Code session
and watch the agents appear.

Want a friendlier URL? Map `mimir.local` once and Mimir will use it automatically:

```bash
echo "127.0.0.1 mimir.local" | sudo tee -a /etc/hosts
```

## Demo mode

See it without a real Claude Code session:

```bash
npx mimir-dev demo
```

Or visit the [live demo](https://mimir-demo.ninoforge.com).

## Commands

| Command | Description |
|---|---|
| `mimir` | Start collector + web UI |
| `mimir demo` | Start with demo data |
| `mimir install` | Install Claude Code hooks (user scope) |
| `mimir install --project` | Install hooks for current project only |
| `mimir uninstall` | Remove hooks |
| `mimir status` | Check hook install & collector status |

## How it works

```
Claude Code hooks --> POST events --> Collector server --> WebSocket --> React app
                                         |                    |
                                       SQLite            Analytics
                                    (event log)     (tokens, cost, waste,
                                                     prompts, knowledge)
```

1. Claude Code fires hook events (tool calls, subagent spawns, etc.)
2. A tiny hook script POSTs them to the local collector server
3. The collector normalizes events, persists analytics, stores in SQLite
4. The React app receives updates via WebSocket and renders the workshop
5. The Analytics tab shows session metrics, tool stats, prompt quality, and more

## Privacy

- Everything is **local** — hooks send to `127.0.0.1`, no external network calls
- Tool inputs/outputs are stored as short previews (500 chars) — set `AGENT_WORKSHOP_PREVIEWS=false` for none
- Token data from transcripts is opt-in, never sent anywhere
- Uninstall removes all hooks cleanly, never touches other tools' hooks

## Configuration

All via environment variables, all optional:

| Variable | Default | Description |
|---|---|---|
| `AGENT_WORKSHOP_PORT` | `4000` | Server port |
| `AGENT_WORKSHOP_HOST` | `127.0.0.1` | Bind address |
| `AGENT_WORKSHOP_PREVIEWS` | `true` | Store tool previews |
| `AGENT_WORKSHOP_IDLE_MS` | `120000` | Agent idle timeout (ms) |
| `AGENT_WORKSHOP_DEPART_AFTER_MS` | `7000` | How long a finished agent lingers before departing |

## Development

```bash
pnpm install
pnpm dev          # Collector (:4000) + Vite (:5173) with hot reload
pnpm test         # 473 tests across all packages
pnpm typecheck
pnpm lint
```

## Deploying the demo

The public demo is a static `VITE_DEMO=true` build on Cloudflare Pages.

```bash
cp .env.demo.example .env.demo   # fill in CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
pnpm demo:build                  # build + check (scripts/build-demo.sh)
pnpm demo:preview                # build + serve locally on :4173
pnpm demo:deploy                 # build + check + deploy (scripts/deploy-demo.sh)
pnpm demo:images                 # regenerate README/docs screenshots + og-image.png (after demo:build)
```

`demo:images` drives your installed Google Chrome through the demo, so rerun
it whenever the UI changes and commit the updated PNGs.

CI runs the same scripts: `ci.yml` checks every PR (no deploy), and
`deploy-demo.yml` deploys when `main` changes or when run by hand from the
Actions tab, with the Cloudflare values coming from repository secrets.

## Tech stack

- **Frontend**: React, Vite, TypeScript, Framer Motion, Zustand
- **Backend**: Fastify, SQLite (Node built-in), WebSocket
- **Hooks**: Claude Code hook scripts (bidirectional — can return permission decisions)
- **Deploy**: Cloudflare Pages (demo), local Node server (production)

## Links

- [Live Demo](https://mimir-demo.ninoforge.com)
- [oyenino.com](https://oyenino.com) — by the creator
- [ninoforge.com](https://ninoforge.com) — more fun projects

## License

MIT
