# twin

MCP server for AI memory in an Obsidian vault.

```
npx @neonn0d/twin@latest --setup
```

Finds your vault, picks where to install, done.

## Supported clients

| App | How |
|-----|-----|
| Claude Desktop | Auto-configured by setup |
| Claude Code (CLI) | Manual config below |
| Cursor | Auto-configured by setup |
| pi | Auto-configured by setup. Needs `OBSIDIAN_VAULT` env var |
| Windsurf | Manual config below |
| Any MCP client | Manual config below |

## Manual config

If setup can't find your app, add this to its MCP config JSON:

```json
{
  "mcpServers": {
    "twin": {
      "command": "npx",
      "args": ["-y", "@neonn0d/twin@latest"],
      "env": { "OBSIDIAN_VAULT": "/path/to/your/vault" }
    }
  }
}
```

| App | Config file |
|-----|-------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)<br>`%APPDATA%\Claude\claude_desktop_config.json` (Windows)<br>`~/.config/Claude/claude_desktop_config.json` (Linux) |
| Claude Code (CLI) | `~/.claude.json` |
| Cursor | `.cursor/mcp.json` in your project |
| Windsurf | `~/.codeium/windsurf/mcp.json` |
| Continue (VS Code) | `~/.continue/config.json` under `experimental.mcpServers` |
| pi | `pi install npm:@neonn0d/twin` then add `export OBSIDIAN_VAULT=/path/to/vault` to your shell config (`.zshrc` / `.bashrc` on macOS/Linux, `setx` on Windows) |
| Goose | `~/.config/goose/mcp.json` |
| Any stdio MCP | Same JSON format, `command: "npx"` |

Restart the app after saving.

## Tools

**Project memory:** `log_session`, `save_knowledge`, `get_knowledge`, `search_knowledge`, `list_knowledge`, `get_project_context`, `set_project_context`, `set_next_steps`, `update_progress`

**General vault:** `list_notes`, `read_note`, `create_note`, `edit_note`, `append_to_note`, `search_notes`, `daily_note`, `list_tags`, `list_folders`, `move_note`, `note_info`, `delete_note`

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

Once installed, forget about it. Your AI agent handles everything. When you start a session, it loads your project context from the vault. When you finish, it saves what happened.

### What the AI does

1. **Session start** — calls `get_project_context` to load your README and today's session
2. **While working** — calls `save_knowledge` when it discovers patterns, gotchas, or architecture details
3. **Session end** — calls `log_session` with a title, summary, files touched, discoveries, and next steps. Then `set_next_steps`

### Asking your AI to use it

**Start a project:**
> Load my project context and tell me where we left off

**Save something useful:**
> Save a brain note about the auth flow we just built

**Find past knowledge:**
> Search brain notes for anything about the database schema

**End a session:**
> Log this session and set next steps
