#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { saveKnowledge, getKnowledge, listKnowledge, searchKnowledge, deleteKnowledge } from "./tools/brain.js";
import { logSession, updateProgress, sessionStart, sessionEnd } from "./tools/session.js";
import { getProjectContext, setProjectContext, setNextSteps } from "./tools/project.js";
import { listNotes, readNote, createNote, editNote, appendToNote, searchNotes, dailyNote, listTags, listFolders, moveNote, noteInfo, deleteNote } from "./tools/vault.js";
const server = new Server({ name: "twin", version: "0.1.0" }, { capabilities: { tools: {} } });
const tools = [
    { name: "get_project_context", description: "Get project README and today's session file", inputSchema: { type: "object", properties: { cwd: { type: "string" } }, required: ["cwd"] } },
    { name: "log_session", description: "Structured session log with work table, discoveries, warnings, tips", inputSchema: { type: "object", properties: { cwd: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, items: { type: "array", items: { type: "object", properties: { item: { type: "string" }, detail: { type: "string" } }, required: ["item", "detail"] } }, discoveries: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } }, tips: { type: "array", items: { type: "string" } }, next_session: { type: "string" }, diagram: { type: "string" } }, required: ["cwd", "title", "summary"] } },
    { name: "update_progress", description: "Quick mid-session timestamped note", inputSchema: { type: "object", properties: { cwd: { type: "string" }, text: { type: "string" } }, required: ["cwd", "text"] } },
    { name: "session_start", description: "Create README + today's session file. Wrap the session with log_session for the structured summary.", inputSchema: { type: "object", properties: { cwd: { type: "string" }, goal: { type: "string" } }, required: ["cwd"] } },
    { name: "session_end", description: "Append a quick end-of-session summary line. Prefer log_session for structured wrap-ups.", inputSchema: { type: "object", properties: { cwd: { type: "string" }, summary: { type: "string" } }, required: ["cwd", "summary"] } },
    { name: "save_knowledge", description: "Save brain knowledge, merges with existing notes", inputSchema: { type: "object", properties: { cwd: { type: "string" }, topic: { type: "string" }, summary: { type: "string" }, sections: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, content: { type: "string" } }, required: ["heading", "content"] } }, items: { type: "array", items: { type: "object", properties: { item: { type: "string" }, detail: { type: "string" } }, required: ["item", "detail"] } }, discoveries: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } }, tips: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "string" } }, tasks: { type: "array", items: { type: "string" } }, diagram: { type: "string" }, patterns: { type: "array", items: { type: "object", properties: { name: { type: "string" }, language: { type: "string" }, code: { type: "string" } }, required: ["name", "code"] } } }, required: ["cwd", "topic", "summary"] } },
    { name: "get_knowledge", description: "Read a brain note, list all if topic empty", inputSchema: { type: "object", properties: { cwd: { type: "string" }, topic: { type: "string" } }, required: ["cwd"] } },
    { name: "list_knowledge", description: "List all brain topics", inputSchema: { type: "object", properties: { cwd: { type: "string" } }, required: ["cwd"] } },
    { name: "search_knowledge", description: "Search all brain notes at once", inputSchema: { type: "object", properties: { cwd: { type: "string" }, query: { type: "string" }, case_sensitive: { type: "boolean" } }, required: ["cwd", "query"] } },
    { name: "delete_knowledge", description: "Move a brain note to brain/.trash/", inputSchema: { type: "object", properties: { cwd: { type: "string" }, topic: { type: "string" } }, required: ["cwd", "topic"] } },
    { name: "set_next_steps", description: "Update README next steps", inputSchema: { type: "object", properties: { cwd: { type: "string" }, steps: { type: "string" } }, required: ["cwd", "steps"] } },
    { name: "set_project_context", description: "Update README context section", inputSchema: { type: "object", properties: { cwd: { type: "string" }, context: { type: "string" } }, required: ["cwd", "context"] } },
    { name: "list_notes", description: "List notes by folder or tag", inputSchema: { type: "object", properties: { folder: { type: "string" }, tag: { type: "string" } } } },
    { name: "read_note", description: "Read full note content", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "create_note", description: "Create a note, fails if exists", inputSchema: { type: "object", properties: { name: { type: "string" }, content: { type: "string" }, tags: { type: "array" } }, required: ["name", "content"] } },
    { name: "edit_note", description: "Replace entire note content", inputSchema: { type: "object", properties: { name: { type: "string" }, content: { type: "string" } }, required: ["name", "content"] } },
    { name: "append_to_note", description: "Append text to a note", inputSchema: { type: "object", properties: { name: { type: "string" }, text: { type: "string" } }, required: ["name", "text"] } },
    { name: "search_notes", description: "Regex search across all notes", inputSchema: { type: "object", properties: { query: { type: "string" }, case_sensitive: { type: "boolean" } }, required: ["query"] } },
    { name: "daily_note", description: "Get or create today's daily note", inputSchema: { type: "object", properties: { content: { type: "string" } } } },
    { name: "list_tags", description: "All tags with usage counts", inputSchema: { type: "object", properties: {} } },
    { name: "list_folders", description: "Vault folder structure", inputSchema: { type: "object", properties: {} } },
    { name: "move_note", description: "Move or rename a note", inputSchema: { type: "object", properties: { source: { type: "string" }, destination: { type: "string" } }, required: ["source", "destination"] } },
    { name: "note_info", description: "Note tags, links, line count", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "delete_note", description: "Move note to .trash/", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
];
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const p = (args || {});
    const h = {
        get_project_context: getProjectContext, log_session: logSession, update_progress: updateProgress,
        session_start: sessionStart, session_end: sessionEnd, save_knowledge: saveKnowledge,
        get_knowledge: getKnowledge, list_knowledge: listKnowledge, search_knowledge: searchKnowledge, delete_knowledge: deleteKnowledge,
        set_next_steps: setNextSteps, set_project_context: setProjectContext,
        list_notes: listNotes, read_note: readNote, create_note: createNote, edit_note: editNote,
        append_to_note: appendToNote, search_notes: searchNotes, daily_note: dailyNote,
        list_tags: () => listTags(), list_folders: () => listFolders(),
        move_note: moveNote, note_info: noteInfo, delete_note: deleteNote,
    };
    const fn = h[name];
    if (!fn)
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    try {
        return { content: [{ type: "text", text: fn(p) }] };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
});
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("twin MCP server running");
