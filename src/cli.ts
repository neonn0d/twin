#!/usr/bin/env node
// Dispatcher: --setup runs the setup wizard, otherwise starts MCP server.
if (process.argv.includes("--setup") || process.argv.includes("-s")) {
  import("./setup.js");
} else {
  import("./index.js");
}
