# twin

<img width="320" alt="twin" src="https://github.com/user-attachments/assets/df5e7674-0be4-4415-9b7e-a9a1550333d3" />

**Persistent memory for AI coding agents, saved as Markdown in your Obsidian vault.**

twin is an MCP server. It gives your agent (Claude Code, Cursor, Windsurf, Claude Desktop, Goose, pi, or any MCP client) tools to:

- **remember** what it learns about a project: architecture, gotchas, decisions
- **log** each work session: what changed, what's next
- **load** all of that back at the start of the next session

Everything is plain `.md` files you can read and edit in Obsidian. No database, no cloud, no API keys.

## Quick start

You need Node 18+ and a folder for your notes. Obsidian itself is optional.

**1. Install**

```bash
git clone https://github.com/neonn0d/twin
cd twin
npm install
```

**2. Connect it to your agent**

```bash
node dist/cli.js --setup
```

The wizard finds your Obsidian vault and the AI apps you have installed, then configures the ones you pick. For other clients, see [Connect manually](#connect-manually).

**3. Tell your agent when to use it**

Add this to `CLAUDE.md` (or your client's rules file) in any project:

```md
At the start of every session in this repo, call `get_project_context` from the
twin MCP server with this directory as `cwd`. While working, save anything worth
remembering with `save_knowledge`. When you finish, call `log_session`.
```

Without this, the agent has the tools but only uses them when you ask.

Restart your agent and you're done.

## Install it with an AI agent

Paste this into Claude Code, Cursor or any agent that can run commands:

```text
Install the twin MCP server (https://github.com/neonn0d/twin):
1. Clone it somewhere permanent, e.g. ~/twin, and run `npm install` there.
2. Ask me for the path to my Obsidian vault (or the folder for notes).
3. Register it with my MCP client. Command: `node <clone>/dist/index.js`,
   env: OBSIDIAN_VAULT=<vault path>. For Claude Code use:
   claude mcp add twin -s user -e OBSIDIAN_VAULT=<vault> -- node <clone>/dist/index.js
4. Add the twin usage note from the README's "Quick start" step 3 to my CLAUDE.md.
5. Tell me to restart, then call get_project_context to confirm it works.
```

## Connect manually

Every MCP client uses the same server config. Replace both paths:

```json
{
  "mcpServers": {
    "twin": {
      "command": "node",
      "args": ["/absolute/path/to/twin/dist/index.js"],
      "env": { "OBSIDIAN_VAULT": "/absolute/path/to/your/vault" }
    }
  }
}
```

Don't want to clone? Use `"command": "npx", "args": ["-y", "github:neonn0d/twin"]` instead. It needs `git` and network on first run.

| Client | Where the config goes |
|--------|------------------------|
| Claude Code | Run `claude mcp add twin -s user -e OBSIDIAN_VAULT=/path/to/vault -- node /path/to/twin/dist/index.js` |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json`<br>Windows `%APPDATA%\Claude\claude_desktop_config.json`<br>Linux `~/.config/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in your project |
| Windsurf | `~/.codeium/windsurf/mcp.json` |
| Goose | `~/.config/goose/mcp.json` |
| Continue | `~/.continue/config.json`, under `experimental.mcpServers` |
| pi | Add `github:neonn0d/twin` to `packages` in `~/.pi/agent/settings.json`, and set `OBSIDIAN_VAULT` in your shell profile |

Restart the app after changing its config.

## Using it

Just ask in plain language:

| You say | The agent calls |
|---------|-----------------|
| "Where did we leave off?" | `get_project_context` |
| "Remember how the auth flow works" | `save_knowledge` |
| "What do we know about the database?" | `search_knowledge` |
| "Log this session and set next steps" | `log_session`, `set_next_steps` |
| "Delete the note about the old payments flow" | `delete_knowledge` |

### All tools

Every tool takes `cwd`: the project folder the agent is working in. That's how twin knows which project the notes belong to.

| Tool | What it does |
|------|--------------|
| `get_project_context` | Read the project README and today's session log. **Call this first.** |
| `save_knowledge` | Save a topic note. Merges into an existing note with the same topic. |
| `get_knowledge` | Read one topic note (or list all if no topic is given). |
| `list_knowledge` | List all topic notes for the project. |
| `search_knowledge` | Search all topic notes (regex, case-insensitive by default). |
| `delete_knowledge` | Move a topic note to `brain/.trash/`. |
| `log_session` | Write a structured session entry: summary, files touched, discoveries, warnings, next steps. |
| `session_start` | Create the project README and today's session log. |
| `update_progress` | Add a quick timestamped line to today's log. |
| `session_end` | Add a one-line end-of-session summary. Prefer `log_session`. |
| `set_project_context` | Replace the README's **Context** section. |
| `set_next_steps` | Replace the README's **Next Steps** section. |

## Where notes go

Each project gets a folder under `twin/` in your vault, mirroring its path from your home folder:

```
~/Work/my-app  →  <vault>/twin/Work/my-app/
                    README.md           context, next steps, links to sessions
                    brain/<topic>.md    topic notes ("Auth Flow" → auth-flow.md)
                    sessions/<date>.md  one log per day
```

Projects outside your home folder go under `twin/<folder-name>/`. If `OBSIDIAN_VAULT` isn't set, twin uses `~/Documents/Obsidian`.

## How saving merges

`save_knowledge` never wipes a note. When the topic already exists:

- **Replaced:** summary, a `## section` with the same heading, an item or pattern with the same name, the diagram (if a new one is given)
- **Appended + deduplicated:** discoveries, warnings, tips, questions, tasks
- **Kept:** everything you didn't send again

Topic names can be in any language (`مصادقة` → `brain/مصادقة.md`).

## Platforms

macOS, Linux, Windows and WSL. It's plain Node with no native dependencies. On WSL, run twin and your AI app on the same side, or point `OBSIDIAN_VAULT` at a path both can see (`/mnt/c/...` from WSL, `\\wsl$\...` from Windows).

## License

MIT
