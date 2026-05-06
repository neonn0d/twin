import fs from "node:fs";
import path from "node:path";
import { VAULT_PATH, projectNotePath, sessionFilePath, updateSection } from "../utils.js";
export function getProjectContext(params) {
    const cwd = params.cwd;
    const readme = projectNotePath(cwd);
    const sf = sessionFilePath(cwd);
    const out = [];
    if (fs.existsSync(readme))
        out.push(`=== README ===\n${fs.readFileSync(readme, "utf8")}`);
    else
        out.push(`No project README for '${path.basename(cwd)}'`);
    if (fs.existsSync(sf))
        out.push(`=== Today's session (${path.basename(sf)}) ===\n${fs.readFileSync(sf, "utf8")}`);
    return out.join("\n\n");
}
export function setProjectContext(params) {
    const cwd = params.cwd;
    const context = params.context;
    const readme = projectNotePath(cwd);
    if (!fs.existsSync(readme))
        return `No project README for '${path.basename(cwd)}'`;
    fs.writeFileSync(readme, updateSection(fs.readFileSync(readme, "utf8"), "## Context", context));
    return `Context updated \u2192 ${path.relative(VAULT_PATH, readme)}`;
}
export function setNextSteps(params) {
    const cwd = params.cwd;
    const steps = params.steps;
    const readme = projectNotePath(cwd);
    if (!fs.existsSync(readme))
        return `No project README for '${path.basename(cwd)}'`;
    fs.writeFileSync(readme, updateSection(fs.readFileSync(readme, "utf8"), "## Next Steps", steps));
    return `Next steps updated \u2192 ${path.relative(VAULT_PATH, readme)}`;
}
