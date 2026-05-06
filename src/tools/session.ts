import fs from "node:fs";
import path from "node:path";
import { VAULT_PATH, ensureSessionFile, sessionFilePath, projectNotePath, toStr, wrap } from "../utils.js";

export function logSession(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const title = params.title as string;
  const summary = params.summary as string;
  const items = params.items as Array<{ item: string; detail: string }> | undefined;
  const discoveries = (params.discoveries as string[])?.map(toStr);
  const warnings = (params.warnings as string[])?.map(toStr);
  const tips = (params.tips as string[])?.map(toStr);
  const nextSession = params.next_session as string | undefined;
  const diagram = params.diagram as string | undefined;

  const sf = sessionFilePath(cwd);
  const project = path.basename(cwd);
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push(`## ${now} \u2014 ${title}`, "", summary, "");

  if (items?.length) {
    lines.push("| File / Thing | What |", "|:-------------|:-----|");
    for (const it of items) lines.push(`| \`${it.item.trim()}\` | ${it.detail.trim()} |`);
    lines.push("");
  }

  if (diagram) { lines.push("```mermaid", diagram.trim(), "```", ""); }

  if (discoveries) for (const d of discoveries) { lines.push("> [!info]"); for (const dl of wrap(d, 100)) lines.push(`> ${dl}`); lines.push(""); }
  if (warnings) for (const w of warnings) { lines.push("> [!warning]"); for (const wl of wrap(w, 100)) lines.push(`> ${wl}`); lines.push(""); }
  if (tips) for (const t of tips) { lines.push("> [!tip]"); for (const tl of wrap(t, 100)) lines.push(`> ${tl}`); lines.push(""); }

  if (nextSession) { lines.push(`**Next session:** ${nextSession}`); lines.push(""); }

  const block = lines.join("\n");

  if (!fs.existsSync(sf)) {
    fs.mkdirSync(path.dirname(sf), { recursive: true });
    fs.writeFileSync(sf, `---\ntags: [${project}, session, ${today}]\n---\n# ${project} \u2014 ${today}\n\n${block}`);
  } else {
    fs.writeFileSync(sf, fs.readFileSync(sf, "utf8").trimEnd() + "\n\n" + block);
  }

  const readme = projectNotePath(cwd);
  if (fs.existsSync(readme)) {
    let text = fs.readFileSync(readme, "utf8");
    const link = `[[sessions/${today}]]`;
    if (!text.includes(link)) {
      const entry = `- ${link} \u2014 ${title}\n`;
      text = text.includes("## Sessions") ? text.replace("## Sessions\n", `## Sessions\n\n${entry}`).replace(/\n{3,}/g, "\n\n") : text.trimEnd() + `\n\n## Sessions\n\n${entry}`;
      fs.writeFileSync(readme, text);
    }
  }

  return `Session logged \u2192 ${path.relative(VAULT_PATH, sf)}`;
}

export function updateProgress(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const text = params.text as string;
  const sf = ensureSessionFile(cwd);
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  fs.writeFileSync(sf, fs.readFileSync(sf, "utf8").trimEnd() + `\n- [${now}] ${text}\n`);
  return `Progress logged \u2192 ${path.relative(VAULT_PATH, sf)}`;
}

export function sessionStart(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const goal = (params.goal as string) || "";
  const name = path.basename(cwd);
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const today = new Date().toISOString().slice(0, 10);

  const readme = projectNotePath(cwd);
  if (!fs.existsSync(readme)) {
    fs.mkdirSync(path.dirname(readme), { recursive: true });
    fs.writeFileSync(readme, `# ${name}\n\n## Context\n\n\n## Next Steps\n\n\n## Sessions\n\n`);
  }
  let text = fs.readFileSync(readme, "utf8");
  const link = `[[sessions/${today}]]`;
  if (!text.includes(link)) {
    let entry = `- ${link}`;
    if (goal) entry += ` \u2014 ${goal}`;
    entry += "\n";
    text = text.includes("## Sessions") ? text.replace("## Sessions\n", `## Sessions\n\n${entry}`).replace(/\n{3,}/g, "\n\n") : text.trimEnd() + `\n\n## Sessions\n\n${entry}`;
    fs.writeFileSync(readme, text);
  }

  const sf = ensureSessionFile(cwd);
  let section = `\n## ${now}`;
  if (goal) section += ` \u2014 ${goal}`;
  section += "\n\n- Session started\n";
  fs.writeFileSync(sf, fs.readFileSync(sf, "utf8").trimEnd() + "\n" + section);
  return `Session started \u2192 ${path.relative(VAULT_PATH, sf)}`;
}

export function sessionEnd(params: Record<string, unknown>): string {
  const cwd = params.cwd as string;
  const summary = params.summary as string;
  const sf = ensureSessionFile(cwd);
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  fs.writeFileSync(sf, fs.readFileSync(sf, "utf8").trimEnd() + `\n- [${now}] Session ended: ${summary}\n`);
  return `Session logged \u2192 ${path.relative(VAULT_PATH, sf)}`;
}
