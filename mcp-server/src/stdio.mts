#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.mjs";
import { createNFLMetaMcpServer } from "./server.mjs";

const server = createNFLMetaMcpServer(loadConfig());

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

try {
  await server.connect(new StdioServerTransport());
  console.error("NFLMeta MCP server connected over stdio");
} catch (error) {
  console.error("NFLMeta MCP server failed:", error);
  process.exit(1);
}
