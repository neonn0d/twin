import fs from "node:fs";
import path from "node:path";
import { VAULT_PATH, parseFrontmatter, brainDir, slugify, toStr, wrap, mergeBrain } from "../utils.js";

export function deleteKnowledge(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const topic = params.topic as string;
  const slug = slugify(topic);
  const brain = brainDir(cwd);
  const p = path.join(brain, `${slug}.md`);
  if (!fs.existsSync(p)) return `No brain note for '${topic}' (looked in ${path.relative(VAULT_PATH, p)})`;
  const trash = path.join(brain, ".trash");
  fs.mkdirSync(trash, { recursive: true });
  fs.renameSync(p, path.join(trash, `${slug}.md`));
  return `Brain note '${topic}' moved to trash`;
}

export function saveKnowledge(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const topic = params.topic as string;
  const summary = params.summary as string;
  const sections = params.sections as Array<{ heading: string; content: string }> | undefined;
  const items = params.items as Array<{ item: string; detail: string }> | undefined;
  const discoveries = (params.discoveries as string[])?.map(toStr);
  const warnings = (params.warnings as string[])?.map(toStr);
  const tips = (params.tips as string[])?.map(toStr);
  const questions = (params.questions as string[])?.map(toStr);
  const tasks = (params.tasks as string[])?.map(toStr);
  const diagram = params.diagram as string | undefined;
  const patterns = params.patterns as Array<{ name: string; language: string; code: string }> | undefined;

  const project = path.basename(cwd);
  const slug = slugify(topic);
  const lines: string[] = [];

  lines.push(`# ${project} \u2014 ${topic}`, "", summary, "");

  if (sections) for (const s of sections) {
    const h = String(s?.heading || "").trim(), c = String(s?.content || "").trim();
    if (h) lines.push(`## ${h}`, "");
    if (c) lines.push(c, "");
  }

  if (items?.length) {
    lines.push("| Item | Detail |", "|:-----|:-------|");
    for (const it of items) lines.push(`| \`${String(it?.item || "").trim()}\` | ${String(it?.detail || "").trim()} |`);
    lines.push("");
  }

  if (diagram) { lines.push("```mermaid", diagram.trim(), "```", ""); }

  if (patterns) for (const p of patterns) {
    const n = String(p?.name || "").trim(), l = String(p?.language || "typescript").trim(), c = String(p?.code || "").trim();
    if (n) lines.push(`### ${n}`, "");
    lines.push(`\`\`\`${l}`, c, "```", "");
  }

  if (discoveries) for (const d of discoveries) { lines.push("> [!info]"); for (const dl of wrap(d, 100)) lines.push(`> ${dl}`); lines.push(""); }
  if (tips) for (const t of tips) { lines.push("> [!tip]"); for (const tl of wrap(t, 100)) lines.push(`> ${tl}`); lines.push(""); }
  if (warnings) for (const w of warnings) { lines.push("> [!warning]"); for (const wl of wrap(w, 100)) lines.push(`> ${wl}`); lines.push(""); }
  if (questions) for (const q of questions) { lines.push("> [!question]"); for (const ql of wrap(q, 100)) lines.push(`> ${ql}`); lines.push(""); }

  if (tasks?.length) {
    lines.push("## To Do", "");
    for (const t of tasks) lines.push(`- [ ] ${t}`);
    lines.push("");
  }

  const brain = brainDir(cwd);
  fs.mkdirSync(brain, { recursive: true });
  const p = path.join(brain, `${slug}.md`);

  if (fs.existsSync(p)) {
    const existing = fs.readFileSync(p, "utf8");
    const merged = mergeBrain(existing, lines);
    fs.writeFileSync(p, `---\ntags: [${project}, brain, ${slug}]\n---\n${merged}`);
    return `Brain merged \u2192 ${path.relative(VAULT_PATH, p)}`;
  }

  fs.writeFileSync(p, `---\ntags: [${project}, brain, ${slug}]\n---\n${lines.join("\n")}`);
  return `Brain created \u2192 ${path.relative(VAULT_PATH, p)}`;
}

export function getKnowledge(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const topic = params.topic as string;
  if (!topic) return listKnowledge(params);
  const slug = slugify(topic);
  const p = path.join(brainDir(cwd), `${slug}.md`);
  if (!fs.existsSync(p)) return `No brain note for '${topic}' (looked in ${path.relative(VAULT_PATH, p)})`;
  return fs.readFileSync(p, "utf8");
}

export function listKnowledge(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const brain = brainDir(cwd);
  const rel = path.relative(VAULT_PATH, brain);
  if (!fs.existsSync(brain)) return `No brain notes yet (looked in ${rel})`;
  const files = fs.readdirSync(brain).filter(f => f.endsWith(".md")).sort();
  if (!files.length) return `No brain notes yet (looked in ${rel})`;
  const rows: string[] = [];
  for (const f of files) {
    const topic = f.replace(".md", "");
    const { body } = parseFrontmatter(fs.readFileSync(path.join(brain, f), "utf8"));
    const heading = body.split("\n").find(l => l.startsWith("#"))?.replace(/^#+\s*/, "") || "";
    const desc = heading || body.split("\n").find(l => l.trim() && !l.startsWith("#"))?.slice(0, 70) || "\u2014";
    rows.push(`  ${topic.padEnd(20)} ${desc}`);
  }
  return `Brain topics for ${path.basename(cwd)}:\n${rows.join("\n")}`;
}

export function searchKnowledge(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const query = params.query as string;
  const cs = params.case_sensitive as boolean | undefined;
  const brain = brainDir(cwd);
  if (!fs.existsSync(brain)) return `No brain notes yet (looked in ${path.relative(VAULT_PATH, brain)})`;
  let pattern: RegExp;
  try { pattern = new RegExp(query, cs ? "" : "i"); }
  catch { pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), cs ? "" : "i"); }
  const results: string[] = [];
  for (const f of fs.readdirSync(brain).filter(f => f.endsWith(".md")).sort()) {
    const { body } = parseFrontmatter(fs.readFileSync(path.join(brain, f), "utf8"));
    const matches: string[] = [];
    body.split("\n").forEach((line, i) => { if (pattern.test(line)) matches.push(`  L${i + 1}: ${line.trim().slice(0, 120)}`); });
    if (matches.length) {
      results.push(`**${f.replace(".md", "")}** \u2014 ${matches.length} match(es):`);
      results.push(...matches.slice(0, 5));
      if (matches.length > 5) results.push(`  ... +${matches.length - 5} more`);
      results.push("");
    }
  }
  return results.length ? results.join("\n") : `No matches for '${query}'`;
}
