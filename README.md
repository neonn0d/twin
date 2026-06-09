# twin

MCP server for AI memory in an Obsidian vault.

> Not published to npm. Install from source (recommended) or run straight from
> GitHub with `npx`. `dist/` is committed, so there's no build step either way.

## Install

### From source (recommended — offline, pinned to your checkout)

```
git clone https://github.com/neonn0d/twin
cd twin
npm install
```

`dist/` is already built and committed, so you don't need to run `npm run build`
unless you change the source. Then either run the wizard:

```
node dist/cli.js --setup
```

…which auto-configures detected clients with the absolute path to this checkout,
or add the config manually (see [Manual config](#manual-config)).

### Quick (no clone — runs from GitHub each launch)

```
npx github:neonn0d/twin --setup
```

Needs `git` + network on first run; npx caches it afterward. Configures clients
to launch via `npx github:neonn0d/twin`.

## Supported clients

| App | How |
|-----|-----|
| Claude Code (CLI) | `claude mcp add` (below), or auto-configured by setup |
| Claude Desktop | Auto-configured by setup |
| Cursor | Auto-configured by setup |
| Windsurf | Auto-configured by setup |
| Goose | Auto-configured by setup |
| pi | Auto-configured by setup. Needs `OBSIDIAN_VAULT` env var |
| Any MCP client | Manual config below |

## Manual config

Pick the command that matches how you installed.

**From source** — point `node` at the absolute path of `dist/index.js` in your clone:

```json
{
  "mcpServers": {
    "twin": {
      "command": "node",
      "args": ["/absolute/path/to/twin/dist/index.js"],
      "env": { "OBSIDIAN_VAULT": "/path/to/your/vault" }
    }
  }
}
```

**From GitHub** — let npx fetch and run it:

```json
{
  "mcpServers": {
    "twin": {
      "command": "npx",
      "args": ["-y", "github:neonn0d/twin"],
      "env": { "OBSIDIAN_VAULT": "/path/to/your/vault" }
    }
  }
}
```

### Claude Code (CLI)

The cleanest route — register it with the CLI (from-source form shown):

```
claude mcp add twin -e OBSIDIAN_VAULT=/path/to/your/vault \
  -- node /absolute/path/to/twin/dist/index.js
```

Or the GitHub form: `-- npx -y github:neonn0d/twin`.

### Config file locations

| App | Config file |
|-----|-------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)<br>`%APPDATA%\Claude\claude_desktop_config.json` (Windows)<br>`~/.config/Claude/claude_desktop_config.json` (Linux) |
| Cursor | `.cursor/mcp.json` in your project |
| Windsurf | `~/.codeium/windsurf/mcp.json` |
| Continue (VS Code) | `~/.continue/config.json` under `experimental.mcpServers` |
| pi | Add `github:neonn0d/twin` to `packages` in `~/.pi/agent/settings.json`, then `export OBSIDIAN_VAULT=/path/to/vault` in your shell config (`.zshrc` / `.bashrc`, or `setx` on Windows) |
| Goose | `~/.config/goose/mcp.json` |
| Any stdio MCP | Same JSON format |

Restart the app after saving.

## Platform support

Works on **macOS, Linux, WSL, and Windows** — it's plain Node, no native deps.

- **macOS / Linux / WSL** — fully supported, this is the common path.
- **WSL** — run twin and your AI client on the same side. If the client is the
  Windows app and the vault lives in WSL (or vice-versa), point `OBSIDIAN_VAULT`
  at a path that side can actually see (e.g. `/mnt/c/Users/you/vault` from WSL,
  or `\\wsl$\...` from Windows). Mixing sides is the only real gotcha.
- **Windows (native)** — works. Use `node` + a full path, or `npx`. Setup detects
  Claude Desktop via `%APPDATA%`.

Requires Node 18+ (ESM). Obsidian itself is optional — twin only needs the vault
folder to exist; you don't have to run the Obsidian app.

## Tools

**Project memory:** `get_project_context`, `session_start`, `session_end`, `log_session`, `update_progress`, `save_knowledge`, `get_knowledge`, `list_knowledge`, `search_knowledge`, `delete_knowledge`, `set_project_context`, `set_next_steps`

## Vault structure

```
vault/
  twin/
    path/to/project/
      README.md
      brain/          topic notes, auto-merge
      sessions/       daily session logs
```

## Merging

`save_knowledge` never overwrites. New sections replace old ones for the same heading. Items, discoveries, warnings, tips, questions, and tasks are appended and deduplicated. Diagrams are replaced if a new one is given.

MIT

## Using twin

Twin gives the agent tools — it doesn't run itself. Memory persists only when the agent calls `save_knowledge` / `log_session` to write, and only loads back when the agent calls `get_project_context` / `get_knowledge` to read. The vault is solid; the loop closes when both ends fire.

### What the AI does (when prompted, or auto-instructed)

1. **Session start** — calls `get_project_context` to load your README and today's session
2. **While working** — calls `save_knowledge` when it discovers patterns, gotchas, or architecture details
3. **Session end** — calls `log_session` with a title, summary, files touched, discoveries, and next steps. Then `set_next_steps`

### Make it automatic

Add a `CLAUDE.md` (or equivalent system-prompt file for your client) at the root of any project where you want twin to load context without you asking:

```md
At the start of every session in this repo, call `mcp__twin__get_project_context`
with this directory as `cwd` before answering. When you finish meaningful work,
save discoveries with `mcp__twin__save_knowledge` and wrap with
`mcp__twin__log_session`.
```

Without this hint, the agent has the tools but no schedule — it'll only call them when you ask explicitly.

### Asking your AI to use it

**Start a project:**
> Load my project context and tell me where we left off

**Save something useful:**
> Save a brain note about the auth flow we just built

**Find past knowledge:**
> Search brain notes for anything about the database schema

**End a session:**
> Log this session and set next steps

**Drop a stale note:**
> Delete the brain note about the old payments flow
