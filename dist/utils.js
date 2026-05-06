import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml } from "yaml";
export const VAULT_PATH = process.env.OBSIDIAN_VAULT || path.join(os.homedir(), "Documents", "Obsidian");
export function resolveVault(name) {
    if (!name.endsWith(".md"))
        name += ".md";
    const p = path.resolve(VAULT_PATH, name);
    if (!p.startsWith(path.resolve(VAULT_PATH)))
        throw new Error("Path traversal blocked");
    return p;
}
export function parseFrontmatter(content) {
    if (content.startsWith("---\n")) {
        const end = content.indexOf("\n---\n", 4);
        if (end !== -1) {
            try {
                return { fm: parseYaml(content.slice(4, end)) || {}, body: content.slice(end + 5) };
            }
            catch { /* ignore */ }
        }
    }
    return { fm: {}, body: content };
}
export function projectDir(cwd) {
    let rel;
    try {
        rel = path.relative(os.homedir(), cwd);
    }
    catch {
        rel = path.basename(cwd);
    }
    return path.join(VAULT_PATH, "twin", rel);
}
export function projectNotePath(cwd) {
    const d = projectDir(cwd);
    const target = path.join(d, "README.md");
    if (fs.existsSync(target))
        return target;
    const name = path.basename(cwd);
    for (const legacy of [
        path.join(VAULT_PATH, "twin", `${name}.md`),
        path.join(VAULT_PATH, "twin", name, "README.md"),
    ]) {
        if (fs.existsSync(legacy)) {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.renameSync(legacy, target);
            return target;
        }
    }
    return target;
}
export function brainDir(cwd) {
    return path.join(projectDir(cwd), "brain");
}
export function slugify(topic) {
    return topic.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}
export function sessionFilePath(cwd) {
    const today = new Date().toISOString().slice(0, 10);
    return path.join(projectDir(cwd), "sessions", `${today}.md`);
}
export function ensureSessionFile(cwd) {
    const sf = sessionFilePath(cwd);
    if (!fs.existsSync(sf)) {
        fs.mkdirSync(path.dirname(sf), { recursive: true });
        fs.writeFileSync(sf, `# ${path.basename(cwd)} \u2014 ${new Date().toISOString().slice(0, 10)}\n`);
    }
    return sf;
}
export function updateSection(content, header, newBody) {
    const level = header.match(/^#+/)?.[0]?.length || 2;
    const title = header.replace(/^#+\s*/, "");
    const pattern = new RegExp(`(^|\\n)${"#".repeat(level)} ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n.*?(?=\\n#|\\Z)`, "s");
    const section = `\n${header}\n${newBody}`;
    const match = content.match(pattern);
    if (match)
        return content.slice(0, match.index) + section + content.slice(match.index + match[0].length);
    return content.trimEnd() + "\n" + section + "\n";
}
export function toStr(v) {
    if (typeof v === "string")
        return v;
    if (typeof v === "object" && v !== null)
        return Object.values(v).map(String).join(" \u2014 ");
    return String(v);
}
export function wrap(text, width) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
        if (current && current.length + word.length + 1 > width) {
            lines.push(current);
            current = word;
        }
        else
            current = current ? `${current} ${word}` : word;
    }
    if (current)
        lines.push(current);
    return lines;
}
export function parseBrainSections(body) {
    const sections = {};
    let heading = null;
    const lines = [];
    for (const line of body.split("\n")) {
        const m = line.match(/^## (.+)$/);
        if (m) {
            if (heading)
                sections[heading] = lines.join("\n").trim();
            heading = m[1].trim();
            lines.length = 0;
        }
        else if (heading)
            lines.push(line);
    }
    if (heading)
        sections[heading] = lines.join("\n").trim();
    return sections;
}
export function parseBrainItems(body) {
    const items = {};
    let inTable = false;
    for (const line of body.split("\n")) {
        if (line.startsWith("| Item |") || line.startsWith("|:-----")) {
            inTable = true;
            continue;
        }
        if (inTable) {
            if (!line.startsWith("|"))
                break;
            const parts = line.split("|").map(p => p.trim());
            if (parts.length >= 3) {
                const itemName = parts[1].replace(/`/g, "").trim();
                if (itemName)
                    items[itemName] = parts[2].trim();
            }
        }
    }
    return items;
}
export function parseBrainCallouts(body, type) {
    const callouts = [];
    const pattern = new RegExp(`> \\[\\!${type}\\] .+?\\n(?:> .+?\\n)*`, "g");
    for (const match of body.matchAll(pattern)) {
        const lines = match[0].split("\n").filter(l => l.startsWith("> ")).map(l => l.slice(2).trim());
        if (lines.length > 0)
            lines[0] = lines[0].replace(/^\[!\w+\]\s*/, "");
        callouts.push(lines.join(" "));
    }
    return callouts;
}
export function parseBrainTasks(body) {
    const tasks = [];
    let inTodo = false;
    for (const line of body.split("\n")) {
        if (/^## To Do/.test(line)) {
            inTodo = true;
            continue;
        }
        if (inTodo) {
            if (line.startsWith("## "))
                break;
            const m = line.match(/^- \[.\] (.+)$/);
            if (m)
                tasks.push(m[1].trim());
        }
    }
    return tasks;
}
export function parseBrainPatterns(body) {
    const patterns = {};
    let name = null;
    let inFence = false;
    let lang = "";
    const lines = [];
    for (const line of body.split("\n")) {
        const hm = line.match(/^### (.+)$/);
        if (hm) {
            name = hm[1].trim();
            continue;
        }
        const fm = line.match(/^```(\w*)$/);
        if (fm) {
            if (inFence) {
                if (name)
                    patterns[name] = [lang, lines.join("\n").trim()];
                inFence = false;
                lines.length = 0;
            }
            else {
                inFence = true;
                lang = fm[1];
            }
            continue;
        }
        if (inFence)
            lines.push(line);
    }
    return patterns;
}
export function mergeBrain(existing, newLines) {
    const { body } = parseFrontmatter(existing);
    const oldSections = parseBrainSections(body);
    const oldItems = parseBrainItems(body);
    const oldDiscoveries = parseBrainCallouts(body, "info");
    const oldWarnings = parseBrainCallouts(body, "warning");
    const oldTips = parseBrainCallouts(body, "tip");
    const oldQuestions = parseBrainCallouts(body, "question");
    const oldTasks = parseBrainTasks(body);
    const oldPatterns = parseBrainPatterns(body);
    const newText = newLines.join("\n");
    const newSections = parseBrainSections(newText);
    const newItems = parseBrainItems(newText);
    const newDiscoveries = parseBrainCallouts(newText, "info");
    const newWarnings = parseBrainCallouts(newText, "warning");
    const newTips = parseBrainCallouts(newText, "tip");
    const newQuestions = parseBrainCallouts(newText, "question");
    const newTasksList = parseBrainTasks(newText);
    const newPatterns = parseBrainPatterns(newText);
    let newTitle = "", newSummary = "";
    for (const line of newLines) {
        if (line.startsWith("# ") && !newTitle)
            newTitle = line;
        else if (newTitle && line && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("```") && !line.startsWith(">")) {
            if (!newSummary)
                newSummary = line;
            break;
        }
    }
    const mergedSections = { ...oldSections, ...newSections };
    const mergedItems = { ...oldItems, ...newItems };
    const mergedPatterns = { ...oldPatterns, ...newPatterns };
    const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const mergeList = (old, add) => {
        const r = [...old];
        const n = new Set(old.map(norm));
        for (const x of add) {
            if (!n.has(norm(x))) {
                r.push(x);
                n.add(norm(x));
            }
        }
        return r;
    };
    const mergedDiscoveries = mergeList(oldDiscoveries, newDiscoveries);
    const mergedWarnings = mergeList(oldWarnings, newWarnings);
    const mergedTips = mergeList(oldTips, newTips);
    const mergedQuestions = mergeList(oldQuestions, newQuestions);
    const mergedTasks = mergeList(oldTasks, newTasksList);
    let newDiagram = null;
    let inFence = false;
    const fenceLines = [];
    for (const line of newLines) {
        if (line.startsWith("```mermaid")) {
            inFence = true;
            continue;
        }
        if (inFence) {
            if (line.startsWith("```")) {
                newDiagram = fenceLines.join("\n").trim();
                break;
            }
            fenceLines.push(line);
        }
    }
    let oldDiagram = null;
    inFence = false;
    fenceLines.length = 0;
    for (const line of body.split("\n")) {
        if (line.startsWith("```mermaid")) {
            inFence = true;
            continue;
        }
        if (inFence) {
            if (line.startsWith("```")) {
                oldDiagram = fenceLines.join("\n").trim();
                break;
            }
            fenceLines.push(line);
        }
    }
    const result = [];
    result.push(newTitle || body.split("\n").find(l => l.startsWith("# ")) || "");
    result.push("");
    if (newSummary)
        result.push(newSummary);
    else {
        const fb = body.split("\n").find(l => l.trim() && !l.startsWith("#") && !l.startsWith("|") && !l.startsWith("```") && !l.startsWith(">"));
        if (fb)
            result.push(fb.trim());
    }
    result.push("");
    for (const [h, c] of Object.entries(mergedSections)) {
        result.push(`## ${h}`, "");
        if (c) {
            result.push(c);
            result.push("");
        }
    }
    if (Object.keys(mergedItems).length) {
        result.push("| Item | Detail |", "|:-----|:-------|");
        for (const [n, d] of Object.entries(mergedItems))
            result.push(`| \`${n}\` | ${d} |`);
        result.push("");
    }
    const diag = newDiagram || oldDiagram;
    if (diag) {
        result.push("```mermaid", diag, "```", "");
    }
    for (const [n, [l, c]] of Object.entries(mergedPatterns)) {
        result.push(`### ${n}`, "", `\`\`\`${l}`, c, "```", "");
    }
    for (const d of mergedDiscoveries) {
        result.push("> [!info] Key Finding");
        for (const dl of wrap(d, 100))
            result.push(`> ${dl}`);
        result.push("");
    }
    for (const t of mergedTips) {
        result.push("> [!tip] Best Practice");
        for (const tl of wrap(t, 100))
            result.push(`> ${tl}`);
        result.push("");
    }
    for (const w of mergedWarnings) {
        result.push("> [!warning] Watch out");
        for (const wl of wrap(w, 100))
            result.push(`> ${wl}`);
        result.push("");
    }
    for (const q of mergedQuestions) {
        result.push("> [!question] To Investigate");
        for (const ql of wrap(q, 100))
            result.push(`> ${ql}`);
        result.push("");
    }
    if (mergedTasks.length) {
        result.push("## To Do", "");
        for (const t of mergedTasks)
            result.push(`- [ ] ${t}`);
        result.push("");
    }
    return result.join("\n");
}
