#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
const homedir = os.homedir();
function exists(p) { try {
    return fs.existsSync(p);
}
catch {
    return false;
} }
function isMac() { return process.platform === "darwin"; }
function isWin() { return process.platform === "win32"; }
function readKey() {
    if (!process.stdin.isTTY)
        return readLine();
    return new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once("data", d => { process.stdin.setRawMode(false); process.stdin.pause(); resolve(d.toString()); });
    });
}
async function readLine() {
    if (!process.stdin.isTTY) {
        return new Promise(resolve => {
            process.stdin.resume();
            process.stdin.once("data", d => { process.stdin.pause(); resolve(d.toString().trim()); });
        });
    }
    let val = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise(resolve => {
        const onData = (d) => {
            for (const c of d.toString()) {
                if (c === "\r" || c === "\n") {
                    process.stdin.removeListener("data", onData);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdout.write("\n");
                    resolve(val);
                    return;
                }
                if (c === "\x7f" || c === "\b") {
                    if (val.length) {
                        val = val.slice(0, -1);
                        process.stdout.write("\b \b");
                    }
                    continue;
                }
                if (c === "\x03") {
                    process.stdout.write("\n");
                    process.exit(0);
                }
                if (c >= " ") {
                    val += c;
                    process.stdout.write(c);
                }
            }
        };
        process.stdin.on("data", onData);
    });
}
function findObsidianVaults() {
    const cfgPaths = [
        path.join(homedir, ".config", "obsidian", "obsidian.json"),
        path.join(homedir, ".var", "app", "md.obsidian.Obsidian", "config", "obsidian", "obsidian.json"),
        path.join(homedir, "Library", "Application Support", "obsidian", "obsidian.json"),
        path.join(process.env.APPDATA || "", "obsidian", "obsidian.json"),
    ];
    for (const p of cfgPaths) {
        try {
            const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
            return Object.values(cfg.vaults || {}).map((v) => v.path).filter((p) => exists(p));
        }
        catch { }
    }
    return [];
}
function serverConfig(vaultPath) {
    return { command: "npx", args: ["-y", "@neonn0d/twin@latest"], env: { OBSIDIAN_VAULT: vaultPath } };
}
function writeMCPConfig(filepath, vaultPath) {
    try {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        let config = {};
        if (exists(filepath)) {
            try {
                config = JSON.parse(fs.readFileSync(filepath, "utf8"));
            }
            catch { }
        }
        if (!config.mcpServers)
            config.mcpServers = {};
        config.mcpServers.twin = serverConfig(vaultPath);
        fs.writeFileSync(filepath, JSON.stringify(config, null, 2));
        return true;
    }
    catch {
        return false;
    }
}
async function picker(title, items) {
    const selected = new Set(items.map((_, i) => i));
    let cursor = 0;
    function draw() {
        process.stdout.write("\x1b[2J\x1b[H");
        console.log(`${title}\n`);
        items.forEach((item, i) => {
            const mark = selected.has(i) ? "\x1b[32m\u2713\x1b[0m" : " ";
            const arrow = i === cursor ? "\x1b[36m\u276f\x1b[0m" : " ";
            console.log(` ${arrow} [${mark}] ${item}`);
        });
        console.log("\n \u2191\u2193 move  Space toggle  Enter confirm");
    }
    draw();
    while (true) {
        const key = await readKey();
        if (key === "\x1b[A" || key === "k")
            cursor = Math.max(0, cursor - 1);
        else if (key === "\x1b[B" || key === "j")
            cursor = Math.min(items.length - 1, cursor + 1);
        else if (key === " ") {
            if (selected.has(cursor))
                selected.delete(cursor);
            else
                selected.add(cursor);
        }
        else if (key === "\r")
            break;
        else if (key === "\x03")
            process.exit(0);
        draw();
    }
    return selected;
}
function hasCommand(cmd) {
    try {
        execSync(`which "${cmd}"`, { stdio: "pipe" });
        return true;
    }
    catch {
        return false;
    }
}
async function main() {
    console.log("\x1b[2J\x1b[H");
    console.log("twin setup\n");
    let vaultPath = process.env.OBSIDIAN_VAULT || "";
    if (!vaultPath) {
        const vaults = findObsidianVaults();
        if (vaults.length === 1) {
            process.stdout.write(`Vault: ${vaults[0]} [Y/n]: `);
            const a = (await readLine()).toLowerCase();
            if (a === "y" || a === "")
                vaultPath = vaults[0];
            else {
                console.log("Skipped.");
                process.exit(0);
            }
        }
        else if (vaults.length > 1) {
            console.log("Found vaults:");
            vaults.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
            process.stdout.write("\nPick [1]: ");
            const a = await readLine();
            const idx = (parseInt(a) || 1) - 1;
            if (idx >= 0 && idx < vaults.length)
                vaultPath = vaults[idx];
            else {
                console.log("Invalid.");
                process.exit(1);
            }
        }
        if (!vaultPath) {
            process.stdout.write("Vault path: ");
            vaultPath = await readLine();
            if (!exists(vaultPath)) {
                console.log(`Not found: ${vaultPath}`);
                process.exit(1);
            }
        }
    }
    console.log(`\nVault: ${vaultPath}\n`);
    const apps = [];
    // Claude Desktop
    if (isMac() && exists(path.join(homedir, "Library", "Application Support", "Claude"))) {
        const p = path.join(homedir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
        apps.push({ name: "Claude Desktop", configure: () => console.log(writeMCPConfig(p, vaultPath) ? "Claude Desktop  ok" : "Claude Desktop  failed") });
    }
    if (isWin() && exists(path.join(process.env.APPDATA || "", "Claude"))) {
        const p = path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
        apps.push({ name: "Claude Desktop", configure: () => console.log(writeMCPConfig(p, vaultPath) ? "Claude Desktop  ok" : "Claude Desktop  failed") });
    }
    // Claude Code
    if (hasCommand("claude")) {
        const p = path.join(homedir, ".claude", "mcp.json");
        apps.push({ name: "Claude Code (CLI)", configure: () => console.log(writeMCPConfig(p, vaultPath) ? "Claude Code  ok" : "Claude Code  failed") });
    }
    // Cursor
    if (hasCommand("cursor") || exists(path.join(homedir, ".cursor"))) {
        apps.push({ name: "Cursor", configure: () => {
                const p = path.join(process.cwd(), ".cursor", "mcp.json");
                console.log(writeMCPConfig(p, vaultPath) ? "Cursor  ok" : "Cursor  failed");
            } });
    }
    // Windsurf
    if (exists(path.join(homedir, ".codeium", "windsurf")) || exists(path.join(homedir, ".windsurf"))) {
        const p = path.join(homedir, ".codeium", "windsurf", "mcp.json");
        apps.push({ name: "Windsurf", configure: () => console.log(writeMCPConfig(p, vaultPath) ? "Windsurf  ok" : "Windsurf  failed") });
    }
    // pi
    if (exists(path.join(homedir, ".pi"))) {
        apps.push({ name: "pi", configure: () => {
                const piSettings = path.join(homedir, ".pi", "agent", "settings.json");
                try {
                    let cfg = {};
                    if (exists(piSettings))
                        cfg = JSON.parse(fs.readFileSync(piSettings, "utf8"));
                    if (!cfg.packages)
                        cfg.packages = [];
                    if (!cfg.packages.includes("npm:@neonn0d/twin")) {
                        cfg.packages.push("npm:@neonn0d/twin");
                        fs.mkdirSync(path.dirname(piSettings), { recursive: true });
                        fs.writeFileSync(piSettings, JSON.stringify(cfg, null, 2));
                        console.log("pi  ok");
                    }
                    else
                        console.log("pi  already configured");
                }
                catch {
                    console.log("pi  failed");
                }
                if (isWin())
                    console.log(`\n  ⚠  Set before running pi:\n  setx OBSIDIAN_VAULT "${vaultPath}"`);
                else {
                    const rc = process.env.SHELL?.includes("zsh") ? ".zshrc" : ".bashrc";
                    console.log(`\n  ⚠  Add to ~/${rc}:\n  export OBSIDIAN_VAULT="${vaultPath}"`);
                }
            } });
    }
    // Goose
    if (exists(path.join(homedir, ".config", "goose"))) {
        const p = path.join(homedir, ".config", "goose", "mcp.json");
        apps.push({ name: "Goose", configure: () => console.log(writeMCPConfig(p, vaultPath) ? "Goose  ok" : "Goose  failed") });
    }
    if (apps.length === 0) {
        console.log("No supported apps detected. Add twin manually to your MCP config:\n");
        console.log(JSON.stringify({ mcpServers: { twin: serverConfig(vaultPath) } }, null, 2));
        console.log(`\nOBSIDIAN_VAULT=${vaultPath}`);
        process.exit(0);
    }
    const selected = await picker("Where to configure twin?", apps.map(a => a.name));
    for (const i of selected)
        apps[i].configure();
    console.log("\nDone.");
}
main();
