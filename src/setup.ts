#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

const homedir = os.homedir();

function ask(q: string, def = ""): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = def ? `${q} [${def}]: ` : `${q}: `;
  return new Promise(resolve => rl.question(prompt, a => { rl.close(); resolve(a || def); }));
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
  return {
    command: "npx",
    args: ["-y", "@neonn0d/twin"],
    env: { OBSIDIAN_VAULT: vaultPath },
  };
}

function writeConfig(filepath: string, vaultPath: string): boolean {
  try {
    const dir = path.dirname(filepath);
    fs.mkdirSync(dir, { recursive: true });
    let config: any = {};
    if (fs.existsSync(filepath)) {
      try { config = JSON.parse(fs.readFileSync(filepath, "utf8")); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers.twin = serverConfig(vaultPath);
    fs.writeFileSync(filepath, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("twin setup\n");

  let vaultPath = process.env.OBSIDIAN_VAULT || "";

  if (!vaultPath) {
    const vaults = findObsidianVaults();
    if (vaults.length === 1) {
      const a = await ask(`Use vault: ${vaults[0]}?`, "y");
      if (a.toLowerCase() === "y" || a === "") vaultPath = vaults[0];
    } else if (vaults.length > 1) {
      console.log("Found vaults:");
      vaults.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
      const a = await ask("Pick one", "1");
      const idx = parseInt(a) - 1;
      if (idx >= 0 && idx < vaults.length) vaultPath = vaults[idx];
    }
    if (!vaultPath) {
      vaultPath = await ask("Vault path");
      if (!fs.existsSync(vaultPath)) {
        console.log(`Path not found: ${vaultPath}`);
        process.exit(1);
      }
    }
  }

  console.log(`\nVault: ${vaultPath}\n`);

  // Claude Desktop
  const claudePaths = [
    path.join(homedir, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json"),
    path.join(homedir, ".config", "Claude", "claude_desktop_config.json"),
  ];
  const claude = claudePaths.find(p => fs.existsSync(p)) || claudePaths[0];
  console.log(writeConfig(claude, vaultPath) ? `Claude Desktop  ok (${claude})` : `Claude Desktop  failed`);

  // Cursor
  const cursorPath = path.join(process.cwd(), ".cursor", "mcp.json");
  console.log(writeConfig(cursorPath, vaultPath) ? `Cursor  ok (${cursorPath})` : `Cursor  failed`);

  // pi
  const piSettings = path.join(homedir, ".pi", "agent", "settings.json");
  if (fs.existsSync(path.join(homedir, ".pi"))) {
    try {
      let cfg: any = {};
      if (fs.existsSync(piSettings)) cfg = JSON.parse(fs.readFileSync(piSettings, "utf8"));
      if (!cfg.packages) cfg.packages = [];
      if (!cfg.packages.includes("npm:@neonn0d/twin")) {
        cfg.packages.push("npm:@neonn0d/twin");
        fs.mkdirSync(path.dirname(piSettings), { recursive: true });
        fs.writeFileSync(piSettings, JSON.stringify(cfg, null, 2));
        console.log(`pi  ok (${piSettings})`);
      } else console.log("pi  already configured");
    } catch { console.log("pi  failed"); }
  }

  console.log("\nDone. Restart Claude Desktop / Cursor.");
}

main();
