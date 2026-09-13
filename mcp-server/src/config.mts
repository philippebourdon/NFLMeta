import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

for (const filename of ["../../.env.local", "../../.env"]) {
  dotenv.config({ path: fileURLToPath(new URL(filename, import.meta.url)), quiet: true });
}

export interface NFLMetaMcpConfig {
  apiBaseUrl: string;
  apiKey?: string;
  requestTimeoutMs: number;
  httpHost: string;
  httpPort: number;
  httpAuthMode: "legacy" | "clerk";
  toolProfile: "full" | "customer";
  httpBearerToken?: string;
  httpAllowedHosts?: string[];
  allowUnauthenticatedHttp: boolean;
  appDatabaseUrl?: string;
  apiKeyEncryptionKey?: string;
  clerkPublishableKey?: string;
  clerkSecretKey?: string;
  publicMcpUrl: string;
  oauthScope: string;
  upgradeUrl: string;
  cacheEnabled: boolean;
  cacheMaxEntries: number;
}

function integerFromEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function booleanFromEnv(value: string | undefined, fallback = false): boolean {
  if (value == null || !value.trim()) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function authModeFromEnv(value: string | undefined): "legacy" | "clerk" {
  return value?.trim().toLowerCase() === "clerk" ? "clerk" : "legacy";
}

function toolProfileFromEnv(value: string | undefined): "full" | "customer" {
  return value?.trim().toLowerCase() === "customer" ? "customer" : "full";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NFLMetaMcpConfig {
  const allowedHosts = env.NFLMETA_MCP_ALLOWED_HOSTS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const apiBaseUrl = (env.NFLMETA_API_BASE_URL || "https://nflmeta.org").replace(/\/+$/, "");
  return {
    apiBaseUrl,
    apiKey: env.NFLMETA_MCP_API_KEY || env.NFLMETA_API_KEY || env.NFLMETA_ENFORCED_API_KEY || undefined,
    requestTimeoutMs: integerFromEnv(env.NFLMETA_MCP_TIMEOUT_MS, 15_000, 1_000, 120_000),
    httpHost: env.NFLMETA_MCP_HOST || "127.0.0.1",
    httpPort: integerFromEnv(env.NFLMETA_MCP_PORT, 3001, 1, 65_535),
    httpAuthMode: authModeFromEnv(env.NFLMETA_MCP_AUTH_MODE),
    toolProfile: toolProfileFromEnv(env.NFLMETA_MCP_TOOL_PROFILE),
    httpBearerToken: env.NFLMETA_MCP_BEARER_TOKEN?.trim() || undefined,
    httpAllowedHosts: allowedHosts?.length ? allowedHosts : undefined,
    allowUnauthenticatedHttp: booleanFromEnv(env.NFLMETA_MCP_ALLOW_UNAUTHENTICATED),
    appDatabaseUrl: env.APP_DATABASE_URL?.trim() || undefined,
    apiKeyEncryptionKey: env.NFLMETA_API_KEY_ENCRYPTION_KEY?.trim() || undefined,
    clerkPublishableKey:
      env.CLERK_PUBLISHABLE_KEY?.trim() || env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || undefined,
    clerkSecretKey: env.CLERK_SECRET_KEY?.trim() || undefined,
    publicMcpUrl: (env.NFLMETA_MCP_PUBLIC_URL || `${apiBaseUrl}/mcp`).replace(/\/+$/, ""),
    oauthScope: env.NFLMETA_MCP_OAUTH_SCOPE?.trim() || "nflmeta:mcp:read",
    upgradeUrl: (env.NFLMETA_MCP_UPGRADE_URL || `${apiBaseUrl}/pricing`).replace(/\/+$/, ""),
    cacheEnabled: booleanFromEnv(env.NFLMETA_MCP_CACHE_ENABLED, true),
    cacheMaxEntries: integerFromEnv(env.NFLMETA_MCP_CACHE_MAX_ENTRIES, 500, 1, 10_000),
  };
}

export function assertSafeHttpConfig(config: NFLMetaMcpConfig): void {
  if (config.httpAuthMode === "clerk") {
    const missing = [
      ["APP_DATABASE_URL", config.appDatabaseUrl],
      ["NFLMETA_API_KEY_ENCRYPTION_KEY", config.apiKeyEncryptionKey],
      ["CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", config.clerkPublishableKey],
      ["CLERK_SECRET_KEY", config.clerkSecretKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) {
      throw new Error(`Clerk MCP authentication requires: ${missing.join(", ")}`);
    }

    let publicUrl: URL;
    try {
      publicUrl = new URL(config.publicMcpUrl);
    } catch {
      throw new Error("NFLMETA_MCP_PUBLIC_URL must be an absolute URL");
    }
    if (publicUrl.pathname !== "/mcp") {
      throw new Error("NFLMETA_MCP_PUBLIC_URL must identify the /mcp resource");
    }
    if (!config.oauthScope) {
      throw new Error("NFLMETA_MCP_OAUTH_SCOPE must not be empty");
    }
    return;
  }

  // A loopback bind is not by itself protection: a reverse proxy can publish a
  // loopback listener to the internet without the server ever knowing. Require a
  // token for every HTTP bind, and make running without one an explicit choice.
  if (config.httpBearerToken || config.allowUnauthenticatedHttp) return;
  throw new Error(
    "NFLMETA_MCP_BEARER_TOKEN is required to start the MCP HTTP server. This server holds an " +
    "upstream API key, so an unauthenticated caller would spend it. Binding to loopback is not " +
    "sufficient, because a reverse proxy can expose a loopback listener publicly. " +
    "Set NFLMETA_MCP_ALLOW_UNAUTHENTICATED=true only behind a proxy that authenticates every request.",
  );
}
