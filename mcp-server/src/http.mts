#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

import { clerkMiddleware } from "@clerk/express";
import {
  corsHeaders,
  fetchClerkAuthorizationServerMetadata,
  generateClerkProtectedResourceMetadata,
} from "@clerk/mcp-tools/server";
import { mcpAuthClerk } from "@clerk/mcp-tools/express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { assertSafeHttpConfig, loadConfig, type NFLMetaMcpConfig } from "./config.mjs";
import {
  createDatabaseMcpCustomerAccessResolver,
  McpCustomerAccessError,
  type McpCustomerAccess,
  type McpCustomerAccessResolver,
} from "./customer-access.mjs";
import { createNFLMetaMcpServer } from "./server.mjs";

function tokensMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export interface HttpAppDependencies {
  /** Test seam for Clerk's OAuth middleware. Production always uses Clerk. */
  oauthAuthenticate?: RequestHandler;
  resolveCustomerAccess?: McpCustomerAccessResolver;
}

function protectedResourceMetadataUrl(config: NFLMetaMcpConfig): string {
  const resource = new URL(config.publicMcpUrl);
  return new URL("/.well-known/oauth-protected-resource/mcp", resource.origin).toString();
}

function sendAccessError(res: Response, error: unknown, config: NFLMetaMcpConfig): void {
  const accessError = error instanceof McpCustomerAccessError ? error : null;
  const status = accessError?.status ?? 503;
  const code = accessError?.code ?? "access_check_unavailable";
  const message = accessError?.message ?? "NFLMeta MCP could not verify account access. Please try again later.";
  res.setHeader("Cache-Control", "private, no-store");
  res.status(status).json({
    error: code,
    message,
    ...(code === "upgrade_required" ? { upgrade_url: config.upgradeUrl } : {}),
  });
}

export function createHttpApp(
  config: NFLMetaMcpConfig,
  fetchImpl?: typeof fetch,
  dependencies: HttpAppDependencies = {},
) {
  assertSafeHttpConfig(config);
  const app = createMcpExpressApp({ host: config.httpHost, allowedHosts: config.httpAllowedHosts });
  app.set("trust proxy", true);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", server: "nflmeta-mcp", apiBaseUrl: config.apiBaseUrl });
  });

  let resolveCustomerAccess: McpCustomerAccessResolver | undefined;
  if (config.httpAuthMode === "clerk") {
    const publishableKey = config.clerkPublishableKey as string;
    const secretKey = config.clerkSecretKey as string;
    const metadata = generateClerkProtectedResourceMetadata({
      publishableKey,
      resourceUrl: config.publicMcpUrl,
      properties: {
        resource_name: "NFLMeta MCP",
        scopes_supported: [config.oauthScope],
        service_documentation: `${config.apiBaseUrl}/mcp-access`,
      },
    });
    const metadataHandler = (_req: Request, res: Response) => {
      res.set(corsHeaders).setHeader("Cache-Control", "public, max-age=300");
      res.json(metadata);
    };
    app.get("/.well-known/oauth-protected-resource", metadataHandler);
    app.get("/.well-known/oauth-protected-resource/mcp", metadataHandler);
    app.options("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
      res.set(corsHeaders).sendStatus(204);
    });
    app.options("/.well-known/oauth-protected-resource/mcp", (_req: Request, res: Response) => {
      res.set(corsHeaders).sendStatus(204);
    });
    app.get("/.well-known/oauth-authorization-server", async (_req: Request, res: Response) => {
      try {
        const authorizationMetadata = await fetchClerkAuthorizationServerMetadata({ publishableKey });
        res.set(corsHeaders).setHeader("Cache-Control", "public, max-age=300");
        res.json(authorizationMetadata);
      } catch {
        res.status(502).json({ error: "authorization_metadata_unavailable" });
      }
    });

    if (dependencies.oauthAuthenticate) {
      app.use("/mcp", dependencies.oauthAuthenticate);
    } else {
      app.use(clerkMiddleware({ publishableKey, secretKey }));
      app.use("/mcp", mcpAuthClerk);
    }

    resolveCustomerAccess = dependencies.resolveCustomerAccess
      ?? createDatabaseMcpCustomerAccessResolver({
        connectionString: config.appDatabaseUrl as string,
        encryptionKey: config.apiKeyEncryptionKey as string,
      });

    app.use("/mcp", async (req: Request, res: Response, next: NextFunction) => {
      const authInfo = (req as Request & { auth?: AuthInfo }).auth;
      const clerkUserId = typeof authInfo?.extra?.userId === "string" ? authInfo.extra.userId : "";
      if (!authInfo || !clerkUserId) {
        res.setHeader(
          "WWW-Authenticate",
          `Bearer resource_metadata="${protectedResourceMetadataUrl(config)}"`,
        );
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      if (!authInfo.scopes.includes(config.oauthScope)) {
        res.setHeader(
          "WWW-Authenticate",
          `Bearer error="insufficient_scope", scope="${config.oauthScope}", resource_metadata="${protectedResourceMetadataUrl(config)}"`,
        );
        res.status(403).json({
          error: "insufficient_scope",
          message: `The ${config.oauthScope} scope is required.`,
        });
        return;
      }

      try {
        res.locals.nflmetaMcpCustomer = await resolveCustomerAccess!(clerkUserId);
        next();
      } catch (error) {
        sendAccessError(res, error, config);
      }
    });
  } else {
    app.use("/mcp", (req: Request, res: Response, next: NextFunction) => {
      if (!config.httpBearerToken) return next();
      const authorization = req.headers.authorization || "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
      if (!token || !tokensMatch(token, config.httpBearerToken)) {
        res.setHeader("WWW-Authenticate", "Bearer");
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      next();
    });
  }

  app.post("/mcp", async (req: Request, res: Response) => {
    const customer = res.locals.nflmetaMcpCustomer as McpCustomerAccess | undefined;
    const serverConfig = customer
      ? { ...config, apiKey: customer.apiKey, toolProfile: "customer" as const }
      : config;
    const server = createNFLMetaMcpServer(serverConfig, fetchImpl);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.setHeader("Cache-Control", "no-store");
    res.on("close", () => {
      void transport.close().catch(() => undefined);
      void server.close().catch(() => undefined);
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("NFLMeta MCP HTTP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const methodNotAllowed = (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed; this stateless server accepts POST." },
      id: null,
    });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  return app;
}

export function startHttpServer(config: NFLMetaMcpConfig = loadConfig()) {
  const app = createHttpApp(config);
  return app.listen(config.httpPort, config.httpHost, (error?: Error) => {
    if (error) {
      console.error("Failed to start NFLMeta MCP HTTP server:", error);
      process.exitCode = 1;
      return;
    }
    console.log(`NFLMeta MCP listening at http://${config.httpHost}:${config.httpPort}/mcp`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startHttpServer();
}
