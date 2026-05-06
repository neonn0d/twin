# twin

MCP server for AI memory in an Obsidian vault.

```
npm install -g @neonn0d/twin
```

Needs Node 18+, an Obsidian vault, and `OBSIDIAN_VAULT` env var set.

## Setup

Claude Desktop:

```json
{
  "mcpServers": {
    "twin": {
      "command": "npx",
      "args": ["-y", "@neonn0d/twin"],
      "env": { "OBSIDIAN_VAULT": "/home/you/Documents/Vault" }
    }
  }
}
```

Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "twin": {
      "command": "npx",
      "args": ["-y", "@neonn0d/twin"],
      "env": { "OBSIDIAN_VAULT": "/home/you/Documents/Vault" }
    }
  }
}
```

Also a pi extension: `pi install npm:@neonn0d/twin`

## Tools

Project memory: `log_session`, `save_knowledge`, `get_knowledge`, `search_knowledge`, `list_knowledge`, `get_project_context`, `set_project_context`, `set_next_steps`, `update_progress`

General vault: `list_notes`, `read_note`, `create_note`, `edit_note`, `append_to_note`, `search_notes`, `daily_note`, `list_tags`, `list_folders`, `move_note`, `note_info`, `delete_note`

## Vault layout

```
vault/
  twin/
    path/to/project/
      README.md
      brain/          <-- topic notes, auto-merge
      sessions/       <-- daily session logs
```

## Merging

`save_knowledge` never overwrites. New sections replace old ones for the same heading. Items, discoveries, warnings, tips, questions, and tasks are appended and deduplicated. Diagrams are replaced if a new one is given.

MIT
