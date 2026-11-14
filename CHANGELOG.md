# Changelog

All notable changes to Mimir are documented here.

## [Unreleased]

### Added
- **Prompts page** — 8-dimension prompt quality scoring with outcome attribution, per-prompt token usage from transcript, correction detection, coaching tips, rewrite suggestions
- **Per-turn token breakdown** — server endpoint `/analytics/tokens/:id/turns` computes tokens per prompt from transcript

### Fixed
- **Tokens context %** — was showing 100% red (cumulative tokens / 200K). Now correctly uses latest request's context / 1M

## [0.5.0] — 2026-11-14

### Added
- **View switch** — Workshop | Data | Split segmented control with URL routing (`?view=data&page=tokens`)
- **Data dashboard** — full analytics page with 220px sidebar, 12 KPI cards, tool usage bar chart, tokens over time chart, recent sessions table
- **Split view** — workshop top + live KPI strip with activity ticker bottom
- **8 sidebar pages** — Sessions, Tools, Files, Git, Projects, Tokens, Waste, Permissions
- **Data derivation** — lines added/removed from Edit/Write diffs, git operations from Bash, MCP calls, files modified, success rate
- **Dark theme** — dedicated design tokens (#12151B background, Inter font, green/blue/amber/red accents)
- **Keyboard shortcuts** — Ctrl+1/2/3 for Workshop/Data/Split

### Removed
- **Reel mode** — removed experimental reel/privacy toggles from header (caused layout breakage)

## [0.4.0] — 2026-11-13

### Added
- **Remote permission approval** — answer Claude Code permission prompts from the Mimir browser dashboard
- **PermissionRequest hook** — fail-safe hook that POSTs to server, polls for decision, exits silent on error
- **Auth token** — random 32-byte hex at `~/.claude/agent-workshop/mimir-token` with 0600 permissions
- **Permission manager** — pending request lifecycle, dedup, expiry, audit log
- **Docked permission panel** — full tool detail, risk tags (DESTRUCTIVE/EXTERNAL), Allow/Deny/Terminal buttons
- **Clickable mascot signs** — YES/NO signs answer the pending permission request on click
- **hookConnected flag** — buttons only show when PermissionRequest hook is actually connected

### Fixed
- **Hook command format** — single command string with absolute node path (prevents bare `node` eval bug)
- **perm-hook ESM** — replaced `require()` with `await import()` (require undefined in .mjs)
- **Close button** on permission cards

## [0.3.0] — 2026-11-12

### Added
- **Real-time prompt bubble** — dedicated Zustand field survives timeline trim, "just now / 12s ago" labels, click-to-expand, 5-prompt history
- **Secret redaction** — API keys, tokens, passwords, connection strings redacted before storing
- **Permission popup (Phase A)** — info-only toast showing tool details, risk tags, waiting timer
- **Risk classification** — destructive (rm -rf, force push, drop table), external (curl, git push)
- **Demo permission scenarios** — Destructive, Force Push, File Edit buttons in control bar
- **Cross-platform fixes** — path.basename() for Windows, path.delimiter for PATH, .gitattributes for line endings, Node.js demo build scripts

### Fixed
- **Session card overlap** — project-desks wrapping, project-group min-width
- **State label clipping** — max-width 150→280px, removed overflow:hidden from parents

## [0.2.0] — 2026-11-12

### Added
- **Token analytics** — transcript parser with incremental reading, streaming dedup, subagent discovery
- **User-friendly Tokens tab** — hero cards (Conversations, AI Responses, Words Written, Memory Used), memory gauge, cost breakdown in plain English
- **Cost intelligence** — corrected Opus 4.6 pricing ($5/$25 not $15/$75), 6 Claude model pricing
- **Session lifecycle** — sleeping→removal with 4s delay, End Session demo button

## [0.1.0] — 2026-11-11

### Added
- **Live Workshop** — animated foreman and worker characters with states (typing, reading, thinking, error, permission, sleeping)
- **Intelligence layer** — session analytics, tool execution stats, agent performance, prompt quality scoring, knowledge intelligence, permission tracking
- **Session tools** — timeline, historical replay, session comparison
- **Demo mode** — 75-second looping scenario, interactive control bar
- **Hook system** — bidirectional Claude Code hooks for all 10 event types
- **CLI** — `mimir start`, `mimir install`, `mimir demo`, `mimir status`
