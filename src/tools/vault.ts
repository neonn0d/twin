import fs from "node:fs";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { VAULT_PATH, resolveVault, parseFrontmatter } from "../utils.js";

export function listNotes(params: Record<string, unknown>): string {
  const folder = (params.folder as string) || "";
  const tag = (params.tag as string) || "";
  const base = folder ? path.join(VAULT_PATH, folder) : VAULT_PATH;
  if (!fs.existsSync(base)) return `Folder not found: ${folder}`;
  const notes: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) {
        if (tag) {
          const { fm, body } = parseFrontmatter(fs.readFileSync(full, "utf8"));
          const tags = new Set([...(fm.tags as string[] || []), ...Array.from(body.matchAll(/(?:^|\s)#([a-zA-Z][\w/-]*)/g), m => m[1])]);
          if (!tags.has(tag)) continue;
        }
        notes.push(path.relative(VAULT_PATH, full));
      }
    }
  };
  walk(base);
  return notes.length ? notes.sort().join("\n") : "No notes found";
}

export function readNote(params: Record<string, unknown>): string {
  const p = resolveVault(params.name as string);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : `Note not found: ${params.name}`;
}

export function createNote(params: Record<string, unknown>): string {
  const name = params.name as string;
  let content = ((params.content as string) || "").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  const tags = params.tags as string[] | undefined;
  const p = resolveVault(name);
  if (fs.existsSync(p)) return `Note already exists: ${name}`;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (tags?.length) content = `---\n${stringifyYaml({ tags })}---\n${content}`;
  fs.writeFileSync(p, content);
  return `Created: ${path.relative(VAULT_PATH, p)}`;
}

export function editNote(params: Record<string, unknown>): string {
  const p = resolveVault(params.name as string);
  if (!fs.existsSync(p)) return `Note not found: ${params.name}`;
  fs.writeFileSync(p, ((params.content as string) || "").replace(/\\n/g, "\n").replace(/\\t/g, "\t"));
  return `Updated: ${path.relative(VAULT_PATH, p)}`;
}

export function appendToNote(params: Record<string, unknown>): string {
  const p = resolveVault(params.name as string);
  if (!fs.existsSync(p)) return `Note not found: ${params.name}`;
  const text = ((params.text as string) || "").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  const existing = fs.readFileSync(p, "utf8");
  fs.writeFileSync(p, existing + (existing && !existing.endsWith("\n") ? "\n" : "") + text);
  return `Appended to: ${path.relative(VAULT_PATH, p)}`;
}

export function searchNotes(params: Record<string, unknown>): string {
  const query = params.query as string;
  const cs = params.case_sensitive as boolean | undefined;
  let pattern: RegExp;
  try { pattern = new RegExp(query, cs ? "" : "i"); }
  catch { pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), cs ? "" : "i"); }
  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) {
        const matches: string[] = [];
        fs.readFileSync(full, "utf8").split("\n").forEach((line, i) => { if (pattern.test(line)) matches.push(`  L${i + 1}: ${line.trim().slice(0, 150)}`); });
        if (matches.length) {
          results.push(`${path.relative(VAULT_PATH, full)}\n${matches.slice(0, 5).join("\n")}`);
          if (matches.length > 5) results[results.length - 1] += `\n  ... +${matches.length - 5} more`;
        }
      }
    }
  };
  walk(VAULT_PATH);
  return results.length ? results.slice(0, 20).join("\n\n") : `No matches for: ${query}`;
}

export function dailyNote(params: Record<string, unknown>): string {
  const content = params.content as string | undefined;
  const today = new Date().toISOString().slice(0, 10);
  const p = path.join(VAULT_PATH, `${today}.md`);
  if (!fs.existsSync(p)) { fs.writeFileSync(p, `# ${today}\n\n${content || ""}`); return `Created daily note: ${today}.md`; }
  if (content) { fs.writeFileSync(p, fs.readFileSync(p, "utf8") + (fs.readFileSync(p, "utf8").endsWith("\n") ? "" : "\n") + content); return `Appended to daily note: ${today}.md`; }
  return fs.readFileSync(p, "utf8");
}

export function listTags(): string {
  const counts: Record<string, number> = {};
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) {
        const { fm, body } = parseFrontmatter(fs.readFileSync(full, "utf8"));
        for (const t of new Set([...(fm.tags as string[] || []), ...Array.from(body.matchAll(/(?:^|\s)#([a-zA-Z][\w/-]*)/g), m => m[1])])) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
    }
  };
  walk(VAULT_PATH);
  return Object.entries(counts).sort(([,a], [,b]) => b - a).map(([t, c]) => `#${t} (${c})`).join("\n") || "No tags found";
}

export function listFolders(): string {
  const folders = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) {
        const rel = path.relative(VAULT_PATH, path.dirname(full));
        if (rel !== ".") folders.add(rel);
      }
    }
  };
  walk(VAULT_PATH);
  return folders.size ? [...folders].sort().join("\n") : "(all notes in vault root)";
}

export function moveNote(params: Record<string, unknown>): string {
  const src = resolveVault(params.source as string);
  const dst = resolveVault(params.destination as string);
  if (!fs.existsSync(src)) return `Source not found: ${params.source}`;
  if (fs.existsSync(dst)) return `Destination already exists: ${params.destination}`;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  return `Moved: ${path.relative(VAULT_PATH, src)} \u2192 ${path.relative(VAULT_PATH, dst)}`;
}

export function noteInfo(params: Record<string, unknown>): string {
  const p = resolveVault(params.name as string);
  if (!fs.existsSync(p)) return `Note not found: ${params.name}`;
  const { fm, body } = parseFrontmatter(fs.readFileSync(p, "utf8"));
  const tags = [...new Set([...(fm.tags as string[] || []), ...Array.from(body.matchAll(/(?:^|\s)#([a-zA-Z][\w/-]*)/g), m => m[1])])];
  const links = Array.from(body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g), m => m[1]);
  const lines = body.trim().split("\n");
  return [
    `Path: ${path.relative(VAULT_PATH, p)}`,
    `Lines: ${lines.length}`,
    `Tags: ${tags.length ? tags.join(", ") : "none"}`,
    `Links: ${links.length ? links.join(", ") : "none"}`,
    ...(Object.keys(fm).length ? [`Frontmatter: ${JSON.stringify(fm)}`] : []),
  ].join("\n");
}

export function deleteNote(params: Record<string, unknown>): string {
  const p = resolveVault(params.name as string);
  if (!fs.existsSync(p)) return `Note not found: ${params.name}`;
  const trash = path.join(VAULT_PATH, ".trash");
  const dest = path.join(trash, path.relative(VAULT_PATH, p));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(p, dest);
  return `Moved to trash: ${params.name}`;
}
