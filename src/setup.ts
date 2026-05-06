#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const homedir = os.homedir();

function readKey(): Promise<string> {
  if (!process.stdin.isTTY) return readLine();
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", d => { process.stdin.setRawMode(false); process.stdin.pause(); resolve(d.toString()); });
  });
}

async function readLine(): Promise<string> {
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
    const onData = (d: Buffer) => {
      for (const c of d.toString()) {
        if (c === "\r" || c === "\n") { process.stdin.removeListener("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); resolve(val); return; }
        if (c === "\x7f" || c === "\b") { if (val.length) { val = val.slice(0, -1); process.stdout.write("\b \b"); } continue; }
        if (c === "\x03") { process.stdout.write("\n"); process.exit(0); }
        if (c >= " ") { val += c; process.stdout.write(c); }
      }
    };
    process.stdin.on("data", onData);
  });
}

function findObsidianVaults(): string[] {
  const cfgPaths = [
    path.join(homedir, ".config", "obsidian", "obsidian.json"),
    path.join(homedir, ".var", "app", "md.obsidian.Obsidian", "config", "obsidian", "obsidian.json"),
    path.join(homedir, "Library", "Application Support", "obsidian", "obsidian.json"),
    path.join(process.env.APPDATA || "", "obsidian", "obsidian.json"),
  ];
  for (const p of cfgPaths) {
    try {
      const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
      return Object.values(cfg.vaults || {}).map((v: any) => v.path).filter((p: string) => fs.existsSync(p));
    } catch {}
  }
  return [];
}

function serverConfig(vaultPath: string) {
  return { command: "npx", args: ["-y", "@neonn0d/twin"], env: { OBSIDIAN_VAULT: vaultPath } };
}

function writeMCPConfig(filepath: string, vaultPath: string): boolean {
  try {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    let config: any = {};
    if (fs.existsSync(filepath)) { try { config = JSON.parse(fs.readFileSync(filepath, "utf8")); } catch {} }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers.twin = serverConfig(vaultPath);
    fs.writeFileSync(filepath, JSON.stringify(config, null, 2));
    return true;
  } catch { return false; }
}

async function picker(title: string, items: string[]): Promise<Set<number>> {
  const selected = new Set(items.map((_, i) => i));
  let cursor = 0;

  function draw() {
    process.stdout.write("\x1b[2J\x1b[H"); // clear
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
    if (key === "\x1b[A" || key === "k") cursor = Math.max(0, cursor - 1);
    else if (key === "\x1b[B" || key === "j") cursor = Math.min(items.length - 1, cursor + 1);
    else if (key === " ") { if (selected.has(cursor)) selected.delete(cursor); else selected.add(cursor); }
    else if (key === "\r") break;
    else if (key === "\x03") process.exit(0);
    draw();
  }
  return selected;
}

async function main() {
  console.log("\x1b[2J\x1b[H"); // clear
  console.log("twin setup\n");

  let vaultPath = process.env.OBSIDIAN_VAULT || "";

  if (!vaultPath) {
    const vaults = findObsidianVaults();
    if (vaults.length === 1) {
      process.stdout.write(`Vault: ${vaults[0]} [Y/n]: `);
      const a = (await readLine()).toLowerCase();
      if (a === "y" || a === "") vaultPath = vaults[0];
      else { console.log("Skipped."); process.exit(0); }
    } else if (vaults.length > 1) {
      console.log("Found vaults:");
      vaults.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
      process.stdout.write("\nPick [1]: ");
      const a = await readLine();
      const idx = (parseInt(a) || 1) - 1;
      if (idx >= 0 && idx < vaults.length) vaultPath = vaults[idx];
      else { console.log("Invalid."); process.exit(1); }
    }
    if (!vaultPath) {
      process.stdout.write("Vault path: ");
      vaultPath = await readLine();
      if (!fs.existsSync(vaultPath)) { console.log(`Not found: ${vaultPath}`); process.exit(1); }
    }
  }

  console.log(`\nVault: ${vaultPath}\n`);

  const targets = ["Claude Desktop", "Cursor", ...(fs.existsSync(path.join(homedir, ".pi")) ? ["pi"] : [])];
  const selected = await picker("Where to configure twin?", targets);

  if (selected.has(0)) {
    const claudePaths = [
      path.join(homedir, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
      path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json"),
      path.join(homedir, ".config", "Claude", "claude_desktop_config.json"),
    ];
    const p = claudePaths.find(p => fs.existsSync(p)) || claudePaths[0];
    console.log(writeMCPConfig(p, vaultPath) ? "Claude Desktop  ok" : "Claude Desktop  failed");
  }

  if (selected.has(1)) {
    const p = path.join(process.cwd(), ".cursor", "mcp.json");
    console.log(writeMCPConfig(p, vaultPath) ? "Cursor  ok" : "Cursor  failed");
  }

  if (selected.has(2)) {
    const piSettings = path.join(homedir, ".pi", "agent", "settings.json");
    try {
      let cfg: any = {};
      if (fs.existsSync(piSettings)) cfg = JSON.parse(fs.readFileSync(piSettings, "utf8"));
      if (!cfg.packages) cfg.packages = [];
      if (!cfg.packages.includes("npm:@neonn0d/twin")) {
        cfg.packages.push("npm:@neonn0d/twin");
        fs.mkdirSync(path.dirname(piSettings), { recursive: true });
        fs.writeFileSync(piSettings, JSON.stringify(cfg, null, 2));
        console.log("pi  ok");
      } else console.log("pi  already configured");
    } catch { console.log("pi  failed"); }
  }

  console.log("\nDone.");
}

main();
