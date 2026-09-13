import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import { NFLMetaApiClient, NFLMetaApiError, type NFLMetaApiResult, type QueryValue } from "./api-client.mjs";
import {
  catalogForProfile,
  CUSTOMER_PROMPT_NAMES,
  CUSTOMER_TOOL_NAMES,
  SERVER_NAME,
  SERVER_VERSION,
} from "./catalog.mjs";
import type { NFLMetaMcpConfig } from "./config.mjs";
import { NFLMETA_GUIDE } from "./guide.mjs";
import {
  presentResult,
  presentationShape,
  type OutputFormat,
  type PresentationOptions,
} from "./presentation.mjs";
import { normalizeSearchText, similarity, suggestions } from "./similarity.mjs";

const MIN_SEASON = 1920;
const MAX_SEASON = new Date().getUTCFullYear();
const POSITION_GROUPS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "SPEC"] as const;
const GAME_STAT_FAMILIES = ["passing", "rushing", "receiving", "defense", "returns", "kicking", "punting", "fumbles", "misc"] as const;
const PLAY_ROLES = ["passer", "rusher", "receiver", "kicker", "scorer", "any"] as const;
const PLAY_SUMMARY_GROUPINGS = ["team", "opponent", "season", "week", "game", "down", "play_type", "quarter", "field_zone"] as const;
const PLAY_LEADER_ROLES = ["passer", "rusher", "receiver"] as const;
const PLAY_LEADER_SORTS = ["epa_per_play", "epa_total", "success_rate", "yards", "yards_per_play", "plays", "cpoe"] as const;
const TRANSACTION_EVENT_TYPES = [
  "joined", "signed", "signed_to_practice_squad", "promoted_from_practice_squad",
  "moved_to_practice_squad", "placed_on_injured_reserve", "activated_from_injured_reserve",
  "placed_on_pup", "suspended", "exempt_list", "released", "retired", "changed_team",
  "traded", "departed", "status_change",
] as const;
const INJURY_STATUSES = ["Out", "Doubtful", "Questionable"] as const;
const DEPTH_CHART_CHANGE_TYPES = ["promoted", "demoted", "added", "removed", "replaced"] as const;

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const toolOutputSchema = z.strictObject({
  data: z.json().describe("JSON NFLMeta result data, shaped for the selected tool and output format"),
  meta: z.json().describe("JSON pagination, source, and composite-request metadata"),
  rateLimit: z.strictObject({
    limit: z.number().int().optional(),
    remaining: z.number().int().optional(),
    reset: z.string().optional(),
    policy: z.string().optional(),
  }),
});

const limitSchema = z.number().int().min(1).max(100).default(25).describe("Maximum rows to return (1-100)");
const offsetSchema = z.number().int().min(0).max(100_000).default(0).describe("Pagination offset");
const yearSchema = z.number().int()
  .min(MIN_SEASON, `Season year is out of range; available ${MIN_SEASON}-${MAX_SEASON}`)
  .max(MAX_SEASON, `Season year is out of range; available ${MIN_SEASON}-${MAX_SEASON}`);
const teamSchema = z.string().trim().min(2).max(12).describe("Canonical team abbreviation; use resolve when unsure");
const positionGroupSchema = z.string().trim().toUpperCase().superRefine((value, context) => {
  if (!(POSITION_GROUPS as readonly string[]).includes(value)) {
    context.addIssue({
      code: "custom",
      message: `Invalid position group \"${value}\"; did you mean: ${suggestions(value, POSITION_GROUPS).join(", ")}?`,
    });
  }
});
const queryScalar = z.union([z.string(), z.number(), z.boolean()]);
const rawQuerySchema = z.record(z.string(), z.union([queryScalar, z.array(queryScalar).max(20)])).optional();
const seasonTypeSchema = z.enum(["REG", "POST", "ALL"]).default("ALL");

function strictInput<T extends z.ZodRawShape>(shape: T) {
  return z.strictObject({ ...shape, ...presentationShape });
}

function segment(value: string | number): string {
  return encodeURIComponent(String(value));
}

function query(values: Record<string, QueryValue>): Record<string, QueryValue> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== ""));
}

// Leader rows carry the whole stat line -- 53 columns for a weekly leader -- and
// the summary table can only show ten. Identity fields sort first and fill the
// budget on their own, so the one column the caller actually asked for never
// appeared: a request for rushing leaders answered with names, teams and dates
// and no rushing yards anywhere in it. Trimming each row to its identity plus
// the requested stat leaves the answer visible.
// Kept deliberately short. The renderer sorts identity fields ahead of
// everything else and then stops at ten columns, so every field listed here is
// one the stat has to outrank to be shown at all. season_year and season_type
// are dropped because the caller supplied them, and week and round never appear
// together on the same row.
const LEADER_IDENTITY_FIELDS = [
  "rank", "player_key", "display_name", "team_abbr", "opponent_abbr",
  "week", "round", "game_date",
];

function trimLeaderRow(row: unknown, stat: string): unknown {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const source = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of LEADER_IDENTITY_FIELDS) {
    if (key in source && source[key] != null) out[key] = source[key];
  }
  if (stat in source) out[stat] = source[stat];
  // Nothing recognisable to trim to; better the full row than an empty one.
  return Object.keys(out).length ? out : source;
}

function trimLeaders(data: unknown, stat: string): unknown {
  if (Array.isArray(data)) return data.map((item) => trimLeaders(item, stat));
  if (!data || typeof data !== "object") return data;
  const source = data as Record<string, unknown>;
  if (Array.isArray(source.leaders)) {
    return { ...source, leaders: source.leaders.map((row) => trimLeaderRow(row, stat)) };
  }
  return trimLeaderRow(source, stat);
}

function presentation(args: { fields?: string[]; format?: OutputFormat }, overrides: Partial<PresentationOptions> = {}): PresentationOptions {
  return { fields: args.fields, format: args.format, ...overrides };
}

function errorResult(error: unknown): CallToolResult {
  const apiError = error instanceof NFLMetaApiError ? error : null;
  const structuredContent: Record<string, unknown> = {
    error: {
      code: apiError?.code || "internal_error",
      message: error instanceof Error ? error.message : "Unexpected NFLMeta MCP error",
      status: apiError?.status ?? null,
      details: apiError?.details ?? null,
    },
  };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

async function runApi(
  operation: () => Promise<NFLMetaApiResult>,
  options: PresentationOptions = {},
): Promise<CallToolResult> {
  try {
    return presentResult(await operation(), options);
  } catch (error) {
    return errorResult(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rows(value: unknown, nestedKey?: string): Record<string, unknown>[] {
  const candidate = nestedKey && isRecord(value) ? value[nestedKey] : value;
  return Array.isArray(candidate) ? candidate.filter(isRecord) : [];
}

function aggregateResult(data: unknown, sources: Record<string, NFLMetaApiResult>): NFLMetaApiResult {
  const values = Object.values(sources);
  const limits = values.map((item) => item.rateLimit.limit).filter((item): item is number => item !== undefined);
  const remaining = values.map((item) => item.rateLimit.remaining).filter((item): item is number => item !== undefined);
  return {
    data,
    meta: {
      source_requests: Object.keys(sources),
      source_meta: Object.fromEntries(Object.entries(sources).map(([name, result]) => [name, result.meta ?? null])),
      source_rate_limits: Object.fromEntries(Object.entries(sources).map(([name, result]) => [name, result.rateLimit])),
    },
    rateLimit: {
      limit: limits.length ? Math.min(...limits) : undefined,
      remaining: remaining.length ? Math.min(...remaining) : undefined,
      reset: values.map((item) => item.rateLimit.reset).find(Boolean),
      policy: values.map((item) => item.rateLimit.policy).find(Boolean),
    },
  };
}

function sourceError(error: unknown): Record<string, unknown> {
  const apiError = error instanceof NFLMetaApiError ? error : null;
  return {
    code: apiError?.code ?? "source_error",
    status: apiError?.status ?? null,
    message: error instanceof Error ? error.message : "Source request failed",
  };
}

async function settleSources(sourcePromises: Record<string, Promise<NFLMetaApiResult>>): Promise<{
  results: Record<string, NFLMetaApiResult>;
  errors: Record<string, Record<string, unknown>>;
}> {
  const entries = Object.entries(sourcePromises);
  const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
  const results: Record<string, NFLMetaApiResult> = {};
  const errors: Record<string, Record<string, unknown>> = {};
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index][0];
    const outcome = settled[index];
    if (outcome.status === "fulfilled") results[name] = outcome.value;
    else errors[name] = sourceError(outcome.reason);
  }
  if (!Object.keys(results).length) {
    const firstFailure = settled.find((outcome) => outcome.status === "rejected");
    throw firstFailure?.status === "rejected" ? firstFailure.reason : new NFLMetaApiError("All composite sources failed");
  }
  return { results, errors };
}

function partialAggregateResult(
  data: unknown,
  results: Record<string, NFLMetaApiResult>,
  errors: Record<string, Record<string, unknown>>,
): NFLMetaApiResult {
  const aggregate = aggregateResult(data, results);
  return {
    ...aggregate,
    meta: {
      ...(isRecord(aggregate.meta) ? aggregate.meta : {}),
      partial: Object.keys(errors).length > 0,
      source_errors: errors,
    },
  };
}

function pick(source: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(source)) return {};
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}

// Internal bookkeeping that compactStats would otherwise present as a
// statistic: a career table rendered as nothing but player_id and
// refresh_run_id, and a season line ending "fumbles_lost 2, refresh_run_id 28".
const STAT_BOOKKEEPING_KEYS = new Set([
  "refresh_run_id", "player_id", "team_id", "season_id", "id",
  "team_resolution_status", "created_at", "updated_at",
]);

function compactStats(source: unknown, maxStats = 18): Record<string, unknown> {
  if (!isRecord(source)) return {};
  const identityKeys = ["season_year", "season_type", "season_team_abbr", "games", "games_played", "starts"];
  const result = pick(source, identityKeys);
  const stats = Object.entries(source).filter(([key, value]) =>
    !identityKeys.includes(key)
    && !STAT_BOOKKEEPING_KEYS.has(key)
    && typeof value === "number"
    && value !== 0
  ).slice(0, maxStats);
  for (const [key, value] of stats) result[key] = value;
  return result;
}

function reportSummaryPlayerSeason(data: Record<string, unknown>): Record<string, unknown> {
  const splits = isRecord(data.splits) ? data.splits : {};
  return {
    player_key: data.player_key,
    season: data.season,
    player: pick(splits.player, ["displayName", "playerKey"]),
    bio: pick(data.bio, ["birth_date", "birth_place", "height_in", "weight_lb", "college_name", "draft_year", "draft_round", "draft_pick", "draft_team"]),
    season_stats: Array.isArray(data.season_stats)
      ? data.season_stats.map((row) => compactStats(row))
      : compactStats(data.season_stats),
    totals: compactStats(splits.totals, 14),
    roster: Array.isArray(data.roster) ? data.roster.slice(0, 3).map((row) => pick(row, ["season_year", "source_team_abbr", "jersey_number", "status", "position"])) : [],
    roster_context: pick(data.roster_context, ["display_name", "latest_team_abbr", "jersey_number", "position", "status"]),
  };
}

function reportSummaryCareer(data: Record<string, unknown>): Record<string, unknown> {
  return {
    player_key: data.player_key,
    career: compactStats(data.career, 24),
    honors: data.honors,
    records: isRecord(data.records) ? { records: Array.isArray(data.records.records) ? data.records.records.slice(0, 5) : [] } : data.records,
    history: Array.isArray(data.history) ? data.history.slice(0, 5) : data.history,
  };
}

function reportSummaryTeam(data: Record<string, unknown>): Record<string, unknown> {
  const profile = isRecord(data.profile) ? data.profile : {};
  return {
    team: profile.team ?? pick(profile, ["displayName"]),
    season: data.season,
    record: isRecord(data.season) ? data.season.record : undefined,
    stats: data.stats,
    power_rankings: data.power_rankings,
    roster: Array.isArray(data.roster) ? data.roster.slice(0, 8).map((row) => pick(row, ["player_key", "display_name", "position", "jersey_number", "status"])) : [],
  };
}

function gameDate(row: Record<string, unknown>): string {
  return String(row.gameDate ?? row.game_date ?? "").slice(0, 10);
}

function singleSimpleField(fields: string[] | undefined): string | undefined {
  return fields?.length === 1 && !fields[0].includes(".") ? fields[0] : undefined;
}

function expandFieldResult(result: NFLMetaApiResult, field: string): NFLMetaApiResult {
  if (!isRecord(result.data) || result.data.field !== field || !("value" in result.data)) return result;
  return { ...result, data: { [field]: result.data.value } };
}

function completionMatches(value: string | undefined, candidates: readonly string[], limit = 100): string[] {
  const needle = normalizeSearchText(value ?? "");
  return [...new Set(candidates)]
    .filter((candidate) => !needle || normalizeSearchText(candidate).includes(needle))
    .slice(0, limit);
}

function templateVariable(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function createNFLMetaMcpServer(
  config: NFLMetaMcpConfig,
  fetchImpl?: typeof fetch,
): McpServer {
  const api = new NFLMetaApiClient({
    baseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
    timeoutMs: config.requestTimeoutMs,
    fetch: fetchImpl,
    cacheEnabled: config.cacheEnabled ?? true,
    cacheMaxEntries: config.cacheMaxEntries ?? 500,
  });

  let statsCatalogPromise: Promise<NFLMetaApiResult> | undefined;
  let teamsCatalogPromise: Promise<NFLMetaApiResult> | undefined;
  let seasonsCatalogPromise: Promise<NFLMetaApiResult> | undefined;

  const statsCatalog = async () => {
    statsCatalogPromise ??= api.get("/api/v1/stats/players/catalog").catch((error) => {
      statsCatalogPromise = undefined;
      throw error;
    });
    return statsCatalogPromise;
  };
  const teamsCatalog = async () => {
    teamsCatalogPromise ??= api.get("/api/v1/teams", { limit: 100, offset: 0 }).catch((error) => {
      teamsCatalogPromise = undefined;
      throw error;
    });
    return teamsCatalogPromise;
  };
  const seasonsCatalog = async () => {
    seasonsCatalogPromise ??= api.get("/api/v1/seasons", { limit: 100, offset: 0 }).catch((error) => {
      seasonsCatalogPromise = undefined;
      throw error;
    });
    return seasonsCatalogPromise;
  };

  const completeTeams = async (value: string | undefined) => {
    const result = await teamsCatalog();
    return completionMatches(value, rows(result.data).map((row) => String(row.abbr ?? "")).filter(Boolean));
  };
  const completeStats = async (value: string | undefined) => {
    const result = await statsCatalog();
    const data = isRecord(result.data) ? result.data : {};
    const candidates = ["season_stats", "career_stats", "game_stats"].flatMap((key) => Array.isArray(data[key]) ? data[key].map(String) : []);
    return completionMatches(value, candidates);
  };
  const completePositions = async (value: string | undefined) => completionMatches(value, POSITION_GROUPS);
  const completeSeasons = async (value: string | undefined) => {
    const result = await seasonsCatalog();
    return completionMatches(value, rows(result.data).map((row) => String(row.year ?? "")).filter(Boolean));
  };
  const completePlayers = async (value: string | undefined) => {
    const result = await api.get("/api/v1/players", { search: value, limit: 20, offset: 0 });
    return rows(result.data).map((row) => String(row.player_key ?? "")).filter(Boolean);
  };
  const completeGames = async (value: string | undefined) => {
    const result = await api.get("/api/v1/games", { order: "desc", include_playoffs: true, limit: 100, offset: 0 });
    const candidates = rows(result.data).flatMap((row) => [String(row.id ?? ""), `${row.id ?? ""} ${row.awayName ?? ""} at ${row.homeName ?? ""}`]);
    return [...new Set(completionMatches(value, candidates).map((candidate) => candidate.split(" ")[0]))];
  };

  async function assertValidStat(stat: string, category: "season_stats" | "career_stats" | "game_stats" = "season_stats") {
    const catalog = await statsCatalog();
    const valid = isRecord(catalog.data) && Array.isArray(catalog.data[category])
      ? catalog.data[category].map(String)
      : [];
    if (!valid.includes(stat)) {
      const didYouMean = suggestions(stat, valid);
      throw new NFLMetaApiError(
        `Invalid stat \"${stat}\"${didYouMean.length ? `; did you mean: ${didYouMean.join(", ")}?` : ""}`,
        { code: "invalid_stat", details: { provided: stat, valid, suggestions: didYouMean } },
      );
    }
  }

  async function teamError(error: unknown, team: string): Promise<never> {
    if (!(error instanceof NFLMetaApiError) || ![400, 404].includes(error.status ?? 0)) throw error;
    const catalog = await teamsCatalog();
    const candidates = rows(catalog.data).flatMap((row) => [row.abbr, row.fullName, row.nickname].filter((value): value is string => typeof value === "string"));
    const didYouMean = suggestions(team, candidates);
    throw new NFLMetaApiError(
      `Unknown team \"${team}\"${didYouMean.length ? `; did you mean: ${didYouMean.join(", ")}?` : ""}`,
      { status: error.status, code: "invalid_team", details: { provided: team, suggestions: didYouMean, original: error.details } },
    );
  }

  async function assertValidTeam(team: string): Promise<void> {
    const catalog = await teamsCatalog();
    const teamRows = rows(catalog.data);
    const abbreviations = teamRows.map((row) => String(row.abbr ?? "")).filter(Boolean);
    if (abbreviations.includes(team)) return;
    const candidates = teamRows.flatMap((row) => [row.abbr, row.fullName, row.nickname].filter((value): value is string => typeof value === "string"));
    const didYouMean = suggestions(team, candidates);
    throw new NFLMetaApiError(
      `Unknown team \"${team}\"${didYouMean.length ? `; did you mean: ${didYouMean.join(", ")}?` : ""}`,
      { code: "invalid_team", details: { provided: team, valid_abbreviations: abbreviations, suggestions: didYouMean } },
    );
  }

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Use NFLMeta for read-only NFL research. Use resolve for messy names and identifiers. " +
        "The search parameter is named search, never query. Prefer report tools for one-call answers, " +
        "summary format for compact responses, cite entity resource templates when useful, and use nflmeta_api_get only as a fallback. " +
        "Prompt and resource completions expose canonical values. Season inputs are NFL season labels.",
    },
  );
  const toolProfile = config.toolProfile ?? "full";
  const customerTools = new Set<string>(CUSTOMER_TOOL_NAMES);
  const customerPrompts = new Set<string>(CUSTOMER_PROMPT_NAMES);

  // outputSchema is OPT-IN via `declareOutputSchema: true` on a tool definition.
  //
  // Every tool returns the same {data, meta, rateLimit} envelope, so declaring
  // the schema on all of them repeated one ~1.3 KB JSON Schema 48 times --
  // 57.6 KB of the 110 KB tools/list payload, over half, re-sent on every
  // uncached request. presentResult() still returns structuredContent either
  // way, so clients keep the structured data; only the declaration is dropped.
  //
  // Re-enable per tool with `declareOutputSchema: true` if a client turns out to
  // need the schema present to consume structuredContent.
  const baseRegisterTool = server.registerTool.bind(server);
  // The SDK's registerTool overloads are generic over each tool's schema, so
  // there is no single concrete type this wrapper can take. Record/unknown is
  // as narrow as it goes without re-deriving those generics.
  type ToolDefinition = Record<string, unknown> & { declareOutputSchema?: boolean };
  type ToolCallback = Parameters<typeof baseRegisterTool>[2];
  const registerTool = ((name: string, definition: ToolDefinition, callback: ToolCallback) => {
    if (toolProfile === "customer" && !customerTools.has(name)) return undefined;
    const { declareOutputSchema, ...rest } = definition;
    return baseRegisterTool(name, {
      ...rest,
      ...(declareOutputSchema ? { outputSchema: toolOutputSchema } : {}),
      annotations: { ...readOnlyAnnotations, ...(definition.annotations ?? {}) },
    }, callback);
  }) as typeof server.registerTool;

  const baseRegisterPrompt = server.registerPrompt.bind(server);
  const registerPrompt = ((name: string, ...args: unknown[]) => {
    if (toolProfile === "customer" && !customerPrompts.has(name)) return undefined;
    return (baseRegisterPrompt as (...values: unknown[]) => unknown)(name, ...args);
  }) as typeof server.registerPrompt;

  server.registerResource(
    "nflmeta-catalog",
    "nflmeta://catalog",
    { title: "NFLMeta MCP catalog", description: "Tool-selection and identifier guide", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(catalogForProfile(toolProfile), null, 2) }] }),
  );

  server.registerResource(
    "nflmeta-api-health",
    "nflmeta://api/health",
    { title: "NFLMeta API health", description: "Live downstream API health envelope", mimeType: "application/json" },
    async (uri, extra) => {
      const result = await api.get("/api/v1/health", undefined, extra.signal);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerResource(
    "nflmeta-guide",
    "nflmeta://guide",
    { title: "NFLMeta agent guide", description: "Common one-call workflows, input rules, and data limits", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: NFLMETA_GUIDE }] }),
  );

  server.registerResource(
    "nflmeta-player",
    new ResourceTemplate("nflmeta://player/{player_key}", {
      list: undefined,
      complete: { player_key: completePlayers },
    }),
    { title: "NFLMeta player", description: "Citeable player profile by canonical player key", mimeType: "application/json" },
    async (uri, variables, extra) => {
      const playerKey = templateVariable(variables.player_key);
      const result = await api.get(`/api/v1/players/${segment(playerKey)}`, undefined, extra.signal);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerResource(
    "nflmeta-team",
    new ResourceTemplate("nflmeta://team/{abbr}", { list: undefined, complete: { abbr: completeTeams } }),
    { title: "NFLMeta team", description: "Citeable team profile by canonical abbreviation", mimeType: "application/json" },
    async (uri, variables, extra) => {
      const abbr = templateVariable(variables.abbr);
      await assertValidTeam(abbr);
      const result = await api.get(`/api/v1/teams/${segment(abbr)}/profile`, undefined, extra.signal);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerResource(
    "nflmeta-game",
    new ResourceTemplate("nflmeta://game/{id}", {
      list: undefined,
      complete: { id: completeGames },
    }),
    { title: "NFLMeta game", description: "Citeable regular-season or playoff game by canonical ID", mimeType: "application/json" },
    async (uri, variables, extra) => {
      const id = Number.parseInt(templateVariable(variables.id), 10);
      if (!Number.isFinite(id) || id <= 0) throw new NFLMetaApiError("Invalid game id", { code: "invalid_request" });
      let result: NFLMetaApiResult;
      try {
        result = await api.get(`/api/v1/games/${id}`, undefined, extra.signal);
      } catch (error) {
        if (!(error instanceof NFLMetaApiError) || error.status !== 404) throw error;
        result = await api.get(`/api/v1/playoff-games/${id}`, undefined, extra.signal);
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerResource(
    "nflmeta-season",
    new ResourceTemplate("nflmeta://season/{year}", { list: undefined, complete: { year: completeSeasons } }),
    { title: "NFLMeta season", description: "Citeable NFL season overview by season label", mimeType: "application/json" },
    async (uri, variables, extra) => {
      const year = Number.parseInt(templateVariable(variables.year), 10);
      if (!Number.isFinite(year) || year < MIN_SEASON || year > MAX_SEASON) {
        throw new NFLMetaApiError(`Season is out of range; available ${MIN_SEASON}-${MAX_SEASON}`, { code: "invalid_season" });
      }
      const result = await api.get(`/api/v1/season/${year}`, undefined, extra.signal);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(result, null, 2) }] };
    },
  );

  const promptPlayer = completable(z.string().min(1).describe("Player name or canonical key"), completePlayers);
  const promptTeam = completable(z.string().optional().describe("Optional canonical team abbreviation"), completeTeams);
  const promptStat = completable(z.string().min(1).describe("Canonical NFLMeta stat name"), completeStats);
  const promptPositionGroup = completable(z.string().optional().describe("Optional canonical position group"), completePositions);
  const promptSeason = completable(z.string().regex(/^\d{4}$/).describe("NFL season year"), completeSeasons);
  const promptOptionalSeason = completable(z.string().regex(/^\d{4}$/).optional().describe("Optional NFL season year"), completeSeasons);
  const promptWeek = completable(
    z.string().regex(/^(?:[1-9]|1[0-9]|2[0-5])$/).describe("NFL week number"),
    async (value) => completionMatches(value, Array.from({ length: 25 }, (_, index) => String(index + 1))),
  );
  const promptGame = completable(z.string().regex(/^\d+$/).describe("Canonical NFLMeta game ID"), completeGames);

  registerPrompt(
    "research-player",
    {
      title: "Research an NFL player",
      description: "Resolve a player and summarize a season or career with NFLMeta data.",
      argsSchema: { player: promptPlayer },
    },
    async ({ player }) => ({ messages: [{ role: "user", content: { type: "text", text: `Research ${player} using resolve, then player_season_report or player_career_report. Distinguish sourced facts from interpretation and mention data coverage limits.` } }] }),
  );

  registerPrompt(
    "weekly-preview",
    {
      title: "Build an NFL weekly preview",
      description: "Collect a season/week schedule and standings context for a concise preview.",
      argsSchema: { season: promptSeason, week: promptWeek },
    },
    async ({ season, week }) => ({ messages: [{ role: "user", content: { type: "text", text: `Build a factual preview for NFL season ${season}, week ${week}. Use list_games and get_standings, then game_preview for relevant matchups. Do not invent betting lines, injuries, or news not returned by NFLMeta.` } }] }),
  );

  registerPrompt(
    "trade-evaluation",
    {
      title: "Evaluate an NFL trade",
      description: "Compare players across teams using production and roster context.",
      argsSchema: {
        player_a: promptPlayer,
        player_b: promptPlayer,
        team_a: promptTeam,
        team_b: promptTeam,
        season: promptOptionalSeason,
      },
    },
    async ({ player_a, player_b, team_a, team_b, season }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Evaluate a hypothetical trade of ${player_a}${team_a ? ` (${team_a})` : ""} for ${player_b}${team_b ? ` (${team_b})` : ""}${season ? ` using ${season} context` : ""}. Resolve both players, use compare_players, player reports, and team_season_report or get_roster as appropriate. NFLMeta has no salary-cap or contract endpoint, so state that limitation explicitly and do not invent cap figures.` } }],
    }),
  );

  registerPrompt(
    "draft-scouting",
    {
      title: "Scout an NFL draft class",
      description: "Analyze a draft class by year, team, or position group.",
      argsSchema: {
        season: promptSeason,
        team: promptTeam,
        position_group: promptPositionGroup,
      },
    },
    async ({ season, team, position_group }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Analyze the ${season} NFL draft class${team ? ` for ${team}` : ""}${position_group ? ` at ${position_group}` : ""}. Use list_draft_picks with small pages, resolve notable players, and use player reports for NFL outcomes. Separate draft facts from retrospective interpretation.` } }],
    }),
  );

  registerPrompt(
    "fantasy-start-sit",
    {
      title: "Compare fantasy start/sit options",
      description: "Build a matchup-driven comparison without inventing projections or injury news.",
      argsSchema: {
        player_a: promptPlayer,
        player_b: promptPlayer,
        season: promptSeason,
        week: promptWeek,
      },
    },
    async ({ player_a, player_b, season, week }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Compare ${player_a} and ${player_b} as start/sit options for ${season} Week ${week}. Resolve both players, use player_season_report, get_player_game_log, list_games, and game_preview for matchup context. NFLMeta is historical/metadata driven; do not invent injuries, betting lines, projections, or breaking news.` } }],
    }),
  );

  registerPrompt(
    "historical-comparison",
    {
      title: "Compare NFL players across eras",
      description: "Compare two players with explicit era and data-coverage caveats.",
      argsSchema: {
        player_a: promptPlayer,
        player_b: promptPlayer,
        season_a: promptOptionalSeason,
        season_b: promptOptionalSeason,
      },
    },
    async ({ player_a, player_b, season_a, season_b }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Compare ${player_a}${season_a ? ` in ${season_a}` : ""} with ${player_b}${season_b ? ` in ${season_b}` : ""}. Resolve both, use compare_players and the relevant player reports. Normalize for schedule/era context qualitatively, identify NFLMeta coverage differences, and avoid pretending raw totals are directly equivalent across eras.` } }],
    }),
  );

  registerPrompt(
    "explain-stat",
    {
      title: "Explain an NFL statistic",
      description: "Explain a catalog stat and show leaders with appropriate context.",
      argsSchema: { stat: promptStat, season: promptOptionalSeason },
    },
    async ({ stat, season }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Explain the NFLMeta statistic ${stat}: what it measures, how to interpret it, and important limitations. Confirm it with get_stats_catalog, then show ${season ? `${season} leaders with get_player_leaders` : "career leaders with get_career_leaders"}. Keep the definition distinct from any interpretation.` } }],
    }),
  );

  registerPrompt(
    "game-breakdown",
    {
      title: "Break down one NFL game",
      description: "Guide a deep, sourced box-score and play-by-play analysis of a single game.",
      argsSchema: { game_id: promptGame },
    },
    async ({ game_id }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Break down NFLMeta game ${game_id}. Use game_recap for the joined result and team efficiency, then search_plays for the decisive sequence and win-probability swings. Use game_preview only when pregame matchup context is useful. Lead with the result, distinguish sourced facts from analysis, and mention missing sections rather than filling gaps.` } }],
    }),
  );

  registerTool(
    "nflmeta_health",
    {
      title: "Check NFLMeta API health",
      description: "Check downstream API health. Example: nflmeta_health({ format: 'summary' }).",
      inputSchema: strictInput({}),
      annotations: readOnlyAnnotations,
    },
    async (args, extra) => runApi(() => api.get("/api/v1/health", undefined, extra.signal), presentation(args)),
  );

  registerTool(
    "resolve",
    {
      title: "Resolve an NFL entity",
      description: "Resolve messy player, team, or coach text to canonical keys with confidence-ranked alternatives. Example: resolve({ text: 'the Steelers' }).",
      inputSchema: strictInput({ text: z.string().trim().min(1).max(160), limit: z.number().int().min(1).max(20).default(8) }),
      annotations: readOnlyAnnotations,
    },
    async ({ text, limit, fields, format }, extra) => runApi(async () => {
      const roleHint = /^coach\b/i.test(text) ? "coach" : undefined;
      const cleaned = text.replace(/^\s*(?:the|coach)\s+/i, "").trim();
      const settled = await Promise.allSettled([
        api.get("/api/v1/players", { search: cleaned, limit: 10, offset: 0 }, extra.signal),
        api.get("/api/v1/teams", { search: cleaned, limit: 10, offset: 0 }, extra.signal),
        api.get("/api/v1/coaches", undefined, extra.signal),
      ]);
      const successful = settled.filter((item): item is PromiseFulfilledResult<NFLMetaApiResult> => item.status === "fulfilled").map((item) => item.value);
      if (!successful.length) throw settled[0].status === "rejected" ? settled[0].reason : new NFLMetaApiError("Entity resolution failed");
      const candidates: Array<{
        type: "player" | "team" | "coach";
        key: string;
        name: string;
        team: string | null;
        confidence: number;
        selected?: boolean;
      }> = [];
      if (settled[0].status === "fulfilled") {
        for (const row of rows(settled[0].value.data)) {
          const name = String(row.display_name ?? row.name ?? "");
          candidates.push({ type: "player", key: String(row.player_key ?? ""), name, team: row.latest_team_abbr == null && row.team_abbr == null ? null : String(row.latest_team_abbr ?? row.team_abbr), confidence: similarity(cleaned, name) });
        }
      }
      if (settled[1].status === "fulfilled") {
        for (const row of rows(settled[1].value.data)) {
          const names = [row.abbr, row.nickname, row.fullName, `${row.city ?? ""} ${row.nickname ?? ""}`].map(String);
          const confidence = Math.max(...names.map((name) => similarity(cleaned, name)));
          candidates.push({ type: "team", key: String(row.abbr ?? ""), name: String(row.fullName ?? row.nickname ?? ""), team: String(row.abbr ?? ""), confidence });
        }
      }
      if (settled[2].status === "fulfilled") {
        for (const row of rows(settled[2].value.data, "coaches")) {
          const name = String(row.name ?? "");
          const confidence = Math.min(1, similarity(cleaned, name) + (roleHint ? 0.06 : 0));
          candidates.push({ type: "coach", key: String(row.coach_key ?? ""), name, team: row.team == null ? null : String(row.team), confidence });
        }
      }
      let ranked = candidates
        .filter((item) => Number(item.confidence) >= 0.2)
        .sort((a, b) => Number(b.confidence) - Number(a.confidence))
        .slice(0, limit)
        .map((item) => ({ ...item, confidence: Number(Number(item.confidence).toFixed(3)) }));
      const top = ranked[0];
      const second = ranked[1];
      const ambiguous = Boolean(top && second && Number(top.confidence) >= 0.65 && Number(second.confidence) >= 0.65
        && Number(top.confidence) - Number(second.confidence) <= 0.08);
      let elicitation: Record<string, unknown> = { attempted: false, action: null };
      if (ambiguous && server.server.getClientCapabilities()?.elicitation?.form) {
        const choices = ranked.slice(0, 5).map((item) => ({
          token: `${item.type}:${item.key}`,
          title: `${item.name} (${item.type}${item.team ? `, ${item.team}` : ""})`,
        }));
        try {
          const response = await server.server.elicitInput({
            mode: "form",
            message: `NFLMeta found several plausible matches for \"${text}\". Which entity did you mean?`,
            requestedSchema: {
              type: "object",
              properties: {
                selection: {
                  type: "string",
                  title: "NFL entity",
                  description: "Choose the intended NFLMeta entity.",
                  oneOf: choices.map((choice) => ({ const: choice.token, title: choice.title })),
                },
              },
              required: ["selection"],
            },
          }, { signal: extra.signal });
          elicitation = { attempted: true, action: response.action };
          const selectedToken = response.action === "accept" ? String(response.content?.selection ?? "") : "";
          const selectedIndex = ranked.findIndex((item) => `${item.type}:${item.key}` === selectedToken);
          if (selectedIndex >= 0) {
            const selected = { ...ranked[selectedIndex], selected: true };
            ranked = [selected, ...ranked.filter((_, index) => index !== selectedIndex)];
            elicitation = { ...elicitation, selected: selectedToken };
          }
        } catch (error) {
          elicitation = {
            attempted: true,
            action: "unavailable",
            error: error instanceof Error ? error.message : "Client elicitation failed",
          };
        }
      }
      const result = aggregateResult(ranked, Object.fromEntries(successful.map((source, index) => [`lookup_${index + 1}`, source])));
      return {
        ...result,
        meta: {
          ...(isRecord(result.meta) ? result.meta : {}),
          resolution: {
            ambiguous,
            needs_clarification: ambiguous && !ranked.some((item) => item.selected === true),
            elicitation,
          },
        },
      };
    }, presentation({ fields, format })),
  );

  registerTool(
    "search_players",
    {
      title: "Search NFL players",
      description: "Find player keys; the parameter is search, not query. Example: search_players({ search: 'Mahomes', limit: 5 }).",
      inputSchema: strictInput({
        search: z.string().max(120).optional(),
        team: z.string().max(12).optional(),
        position: z.string().max(20).optional(),
        position_group: positionGroupSchema.optional(),
        limit: limitSchema,
        offset: offsetSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/players", query(args), extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_player",
    {
      title: "Get an NFL player",
      description: "Read one player view by canonical key. Example: get_player({ player_key: 'patrick-mahomes', view: 'career' }).",
      inputSchema: strictInput({
        player_key: z.string().min(1).max(160),
        view: z.enum(["profile", "identity", "bio", "ids", "career", "career-seasons", "honors", "roster", "history", "records", "splits"]).default("profile"),
        season: yearSchema.optional(),
        season_type: seasonTypeSchema.optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_key, view, season, season_type, fields, format }, extra) => {
      const suffix = view === "profile" ? "" : view === "career-seasons" ? "/career/seasons" : `/${view}`;
      const field = singleSimpleField(fields);
      const supportsFieldRoute = !["profile", "career-seasons", "roster"].includes(view);
      // season_type defaults to ALL, and the career/seasons route only accepts
      // REG or POST -- so sending the default made this view fail every time.
      // ALL means "do not filter" to that route, which is an absent parameter.
      const seasonTypeParam = view === "career-seasons" && season_type === "ALL" ? undefined : season_type;
      return runApi(async () => {
        const result = await api.get(`/api/v1/players/${segment(player_key)}${suffix}${field && supportsFieldRoute ? `/${segment(field)}` : ""}`, query({ season, season_type: seasonTypeParam }), extra.signal);
        return field && supportsFieldRoute ? expandFieldResult(result, field) : result;
      }, presentation({ fields, format }));
    },
  );

  registerTool(
    "get_player_season_stats",
    {
      title: "Get player stats for one season",
      description: "Read one player's exact regular-season, postseason, or combined season stat line. Example: get_player_season_stats({ player_key: 'ben-roethlisberger', season: 2006, season_type: 'REG' }).",
      inputSchema: strictInput({
        player_key: z.string().min(1).max(160),
        season: yearSchema,
        season_type: seasonTypeSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_key, season, season_type, fields, format }, extra) => runApi(
      () => api.get(
        `/api/v1/players/${segment(player_key)}/career/seasons`,
        query({ season, season_type: season_type === "ALL" ? undefined : season_type, limit: 10, offset: 0 }),
        extra.signal,
      ),
      presentation({ fields, format }),
    ),
  );

  registerTool(
    "search_teams",
    {
      title: "Search NFL teams",
      description: "Find canonical abbreviations; the parameter is search, not query. Example: search_teams({ search: 'Chiefs' }).",
      inputSchema: strictInput({ search: z.string().max(120).optional(), conference: z.string().max(12).optional(), division: z.string().max(24).optional(), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/teams", query(args), extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_team",
    {
      title: "Get an NFL team",
      description: "Read a team snapshot or focused view. Example: get_team({ team_abbr: 'KC', view: 'profile', season: 2024 }).",
      inputSchema: strictInput({ team_abbr: teamSchema, view: z.enum(["snapshot", "profile", "identity", "season", "stats", "power-rankings", "stadium", "pro-bowl", "history"]).default("profile"), season: yearSchema.optional() }),
      annotations: readOnlyAnnotations,
    },
    async ({ team_abbr, view, season, fields, format }, extra) => runApi(async () => {
      const suffix = view === "snapshot" ? "" : `/${view}`;
      await assertValidTeam(team_abbr);
      const field = singleSimpleField(fields);
      const result = await api.get(`/api/v1/teams/${segment(team_abbr)}${suffix}${field && view !== "snapshot" ? `/${segment(field)}` : ""}`, query({ season }), extra.signal);
      return field && view !== "snapshot" ? expandFieldResult(result, field) : result;
    }, presentation({ fields, format })),
  );

  registerTool(
    "list_games",
    {
      title: "List NFL games",
      description: "Query games by season, week, team, or date. Example: list_games({ season: 2024, week: 1, team: 'KC' }).",
      inputSchema: strictInput({ season: yearSchema.optional(), week: z.number().int().min(1).max(25).optional(), team: z.string().max(12).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), order: z.enum(["asc", "desc"]).default("desc"), include_playoffs: z.boolean().default(true), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/games", query(args), extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_game",
    {
      title: "Get an NFL game",
      description: "Read regular-game detail, stats, or extras. Example: get_game({ game_id: 12001, view: 'stats' }).",
      inputSchema: strictInput({ game_id: z.number().int().positive(), view: z.enum(["detail", "stats", "extras"]).default("detail") }),
      annotations: readOnlyAnnotations,
    },
    async ({ game_id, view, fields, format }, extra) => runApi(async () => {
      const field = singleSimpleField(fields);
      const result = await api.get(`/api/v1/games/${game_id}${view === "detail" ? field ? `/${segment(field)}` : "" : `/${view}`}`, undefined, extra.signal);
      return field && view === "detail" ? expandFieldResult(result, field) : result;
    }, presentation({ fields, format })),
  );

  registerTool(
    "get_roster",
    {
      title: "Get a team roster",
      description: "Get a roster snapshot. Example: get_roster({ team_abbr: 'PIT', season: 2025, position: 'QB' }).",
      inputSchema: strictInput({ team_abbr: teamSchema, season: yearSchema.optional(), status: z.string().max(40).optional(), position: z.string().max(20).optional(), search: z.string().max(120).optional(), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ team_abbr, season, fields, format, ...rest }, extra) => runApi(async () => {
      await assertValidTeam(team_abbr);
      return api.get(`/api/v1/teams/${segment(team_abbr)}/roster`, query({ year: season, ...rest }), extra.signal);
    }, presentation({ fields, format })),
  );

  registerTool(
    "get_standings",
    {
      title: "Get NFL standings",
      description: "Get conference/division standings. Example: get_standings({ season: 2025 }).",
      inputSchema: strictInput({ season: yearSchema.optional() }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, fields, format }, extra) => runApi(() => api.get("/api/v1/standings", query({ season }), extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_season",
    {
      title: "Get an NFL season",
      description: "Read a season overview or summary. Example: get_season({ season: 2024, view: 'summary' }).",
      inputSchema: strictInput({ season: yearSchema, view: z.enum(["overview", "summary", "broadcast-rights", "power-rankings", "byes"]).default("overview") }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, view, fields, format }, extra) => {
      const field = singleSimpleField(fields);
      const path = view === "byes" ? `/api/v1/byes/${season}` : `/api/v1/season/${season}${view === "overview" ? field ? `/${segment(field)}` : "" : `/${view}`}`;
      return runApi(async () => {
        const result = await api.get(path, undefined, extra.signal);
        return field && view === "overview" ? expandFieldResult(result, field) : result;
      }, presentation({ fields, format }));
    },
  );

  registerTool(
    "get_stats_catalog",
    {
      title: "Discover NFL player stats",
      description: "List valid stat names before analytics calls. Example: get_stats_catalog({ fields: ['season_stats'] }).",
      inputSchema: strictInput({}),
      annotations: readOnlyAnnotations,
    },
    async (args) => runApi(statsCatalog, presentation(args)),
  );

  registerTool(
    "get_player_leaders",
    {
      title: "Get season player leaders",
      description: "Rank players by a valid season stat. Example: get_player_leaders({ season: 2024, stat: 'pass_yds', limit: 10 }).",
      inputSchema: strictInput({ season: yearSchema, stat: z.string().min(1).max(100), season_type: z.enum(["REG", "POST"]).optional(), team: z.string().max(12).optional(), position: z.string().max(20).optional(), order: z.enum(["asc", "desc"]).default("desc"), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, stat, fields, format, ...rest }, extra) => runApi(async () => {
      await assertValidStat(stat, "season_stats");
      return api.get(`/api/v1/stats/players/seasons/${season}/${segment(stat)}`, query(rest), extra.signal);
    }, presentation({ fields, format })),
  );

  registerTool(
    "get_career_leaders",
    {
      title: "Get career player leaders",
      description: "Rank players by a valid career stat. Example: get_career_leaders({ stat: 'pass_yds', limit: 10 }).",
      inputSchema: strictInput({ stat: z.string().min(1).max(100), team: z.string().max(12).optional(), position: z.string().max(20).optional(), order: z.enum(["asc", "desc"]).default("desc"), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ stat, fields, format, ...rest }, extra) => runApi(async () => {
      await assertValidStat(stat, "career_stats");
      return api.get(`/api/v1/stats/players/careers/${segment(stat)}`, query(rest), extra.signal);
    }, presentation({ fields, format })),
  );

  registerTool(
    "list_draft_picks",
    {
      title: "List NFL draft picks",
      description: "Query draft picks; the player-name parameter is search, not query. Example: list_draft_picks({ year: 2024, team: 'KC' }).",
      inputSchema: strictInput({ year: yearSchema.optional(), team: z.string().max(12).optional(), round: z.number().int().min(1).max(40).optional(), college: z.string().max(120).optional(), search: z.string().max(120).optional(), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/draft-picks", query(args), extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_super_bowl",
    {
      title: "Get Super Bowl history",
      description: "Get a Super Bowl, team record, or historical list. Example: get_super_bowl({ season: 2024 }).",
      inputSchema: strictInput({ season: yearSchema.optional(), team_abbr: teamSchema.optional(), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, team_abbr, limit, offset, fields, format }, extra) => {
      if (season && team_abbr) return errorResult(new NFLMetaApiError("Provide season or team_abbr, not both", { code: "invalid_request" }));
      const path = season ? `/api/v1/super-bowls/${season}` : team_abbr ? `/api/v1/super-bowls/teams/${segment(team_abbr)}` : "/api/v1/super-bowls";
      return runApi(async () => {
        if (team_abbr) await assertValidTeam(team_abbr);
        return api.get(path, query({ limit, offset }), extra.signal);
      }, presentation({ fields, format }));
    },
  );

  registerTool(
    "search_coaches",
    {
      title: "Search NFL coaches",
      description: "Search coaches; the name parameter is search, not query. Example: search_coaches({ search: 'Tomlin' }).",
      inputSchema: strictInput({ search: z.string().max(120).optional(), team: z.string().max(120).optional(), season: yearSchema.optional(), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ search, team, season, limit, offset, fields, format }, extra) => runApi(async () => {
      const result = await api.get("/api/v1/coaches", undefined, extra.signal);
      const searchNeedle = search?.trim().toLowerCase();
      const teamNeedle = team?.trim().toLowerCase();
      const filtered = rows(result.data, "coaches").filter((coach) => {
        const searchable = `${coach.name || ""} ${coach.coach_key || ""}`.toLowerCase();
        return (!searchNeedle || searchable.includes(searchNeedle))
          && (!teamNeedle || String(coach.team || "").toLowerCase().includes(teamNeedle))
          && (!season || Number(coach.season_year) === season);
      });
      return { ...result, data: filtered.slice(offset, offset + limit), meta: { total: filtered.length, limit, offset, returned: Math.max(0, Math.min(limit, filtered.length - offset)), has_more: offset + limit < filtered.length } };
    }, presentation({ fields, format })),
  );

  // High-priority Phase 1 coverage.
  registerTool(
    "get_playoff_picture",
    {
      title: "Get the playoff picture",
      description: "Get the postseason bracket by round and conference. Example: get_playoff_picture({ season: 2025 }).",
      inputSchema: strictInput({ season: yearSchema.optional() }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, fields, format }, extra) => runApi(() => api.get("/api/v1/playoffs/picture", query({ season }), extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_player_game_log",
    {
      title: "Get player game logs or splits",
      description: "Query ranked player game logs or aggregate split buckets. Example: get_player_game_log({ season: 2024, stat: 'pass_yds', search: 'Mahomes' }).",
      inputSchema: strictInput({ season: yearSchema, stat: z.string().min(1).max(100), split_by: z.enum(["week", "team", "opponent", "home_away", "result", "position", "season_type"]).optional(), season_type: seasonTypeSchema, week: z.number().int().min(1).max(25).optional(), week_from: z.number().int().min(1).max(25).optional(), week_to: z.number().int().min(1).max(25).optional(), team: z.string().max(12).optional(), opponent: z.string().max(12).optional(), home_away: z.enum(["home", "away"]).optional(), result: z.enum(["W", "L", "T"]).optional(), position: z.string().max(20).optional(), search: z.string().max(120).optional(), order: z.enum(["asc", "desc"]).default("desc"), limit: limitSchema, offset: offsetSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, stat, split_by, fields, format, ...rest }, extra) => runApi(async () => {
      await assertValidStat(stat, "game_stats");
      const path = split_by ? "/api/v1/stats/players/games/splits" : "/api/v1/stats/players/games";
      // The split path used to name the parameters it forwards, which quietly
      // dropped the rest: a search for Barkley's rushing by opponent came back
      // with Taylor, Henry and Pierce, because `search` was never sent. Wrong
      // data returned as an answer is worse than a refusal, so everything the
      // caller passed is forwarded and the API decides what it accepts.
      const allowed = { season_year: season, stat, ...(split_by ? { split_by } : {}), ...rest };
      return api.get(path, query(allowed), extra.signal);
      // Trimmed like the other stat-ranked tools. Without it the ten-column
      // budget is spent on identity fields and the game log shows no yardage.
    }, presentation({ fields, format }, { summaryTransform: (data) => trimLeaders(data, stat) })),
  );

  registerTool(
    "get_weekly_stats",
    {
      title: "Get weekly player leaders",
      description: "Get per-week leaders for one season and stat. Example: get_weekly_stats({ season: 2024, stat: 'rush_yds', limit_per_week: 5 }).",
      inputSchema: strictInput({ season: yearSchema, stat: z.string().min(1).max(100), season_type: seasonTypeSchema, limit_per_week: z.number().int().min(1).max(25).default(10) }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, stat, season_type, limit_per_week, fields, format }, extra) => runApi(async () => {
      await assertValidStat(stat, "game_stats");
      return api.get(`/api/v1/stats/players/season/${season}/weeks`, { stat, season_type, limit_per_week }, extra.signal);
    }, presentation({ fields, format }, { summaryTransform: (data) => trimLeaders(data, stat) })),
  );

  registerTool(
    "get_player_honors",
    {
      title: "Get player honors and records",
      description: "Get honors and optionally career/best-game records. Example: get_player_honors({ player_key: 'patrick-mahomes', include_records: true }).",
      inputSchema: strictInput({ player_key: z.string().min(1).max(160), include_records: z.boolean().default(true), season_type: seasonTypeSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_key, include_records, season_type, fields, format }, extra) => runApi(async () => {
      const honors = await api.get(`/api/v1/players/${segment(player_key)}/honors`, undefined, extra.signal);
      if (!include_records) return honors;
      const recordsResult = await api.get(`/api/v1/players/${segment(player_key)}/records`, { season_type }, extra.signal);
      return aggregateResult({ honors: honors.data, records: recordsResult.data }, { honors, records: recordsResult });
    }, presentation({ fields, format })),
  );

  registerTool(
    "get_team_cap_space",
    {
      title: "Get team cap space",
      description: "Get estimated available salary-cap space in USD for one team or all 32. Daily snapshot, not live; includes observed_at and stale metadata. Example: get_team_cap_space({ team_abbr: 'NE' }). Omit season for the current NFL season. Coverage starts in 2026.",
      inputSchema: strictInput({ season: yearSchema.optional(), team_abbr: teamSchema.optional() }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, team_abbr, fields, format }, extra) => runApi(() =>
      api.get('/api/v1/teams/cap-space', query({ season, team_abbr }), extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_game_inactives",
    {
      title: "Get game-day inactives",
      description: "Get confirmed inactive players for both teams in a regular-season game. Includes emergency quarterback notes. not_available means the list has not been collected, not that everyone is active.",
      inputSchema: strictInput({ game_id: z.number().int().positive() }),
      annotations: readOnlyAnnotations,
    },
    async ({ game_id, fields, format }, extra) => runApi(() =>
      api.get(`/api/v1/games/${game_id}/inactives`, undefined, extra.signal), presentation({ fields, format })),
  );

  registerTool(
    "get_power_rankings",
    {
      title: "Get NFL power rankings",
      description: "Get season rankings or one team's ranking history. Example: get_power_rankings({ season: 2025, team_abbr: 'KC' }).",
      inputSchema: strictInput({ season: yearSchema, team_abbr: teamSchema.optional() }),
      annotations: readOnlyAnnotations,
    },
    async ({ season, team_abbr, fields, format }, extra) => runApi(async () => {
      if (team_abbr) await assertValidTeam(team_abbr);
      return api.get(team_abbr ? `/api/v1/teams/${segment(team_abbr)}/power-rankings` : `/api/v1/season/${season}/power-rankings`, team_abbr ? { season } : undefined, extra.signal);
    }, presentation({ fields, format })),
  );

  registerTool(
    "compare_players",
    {
      title: "Compare NFL players",
      description: "Compare two or more canonical player keys. Example: compare_players({ player_keys: ['patrick-mahomes', 'josh-allen-1996'], season_years: [2024] }).",
      inputSchema: strictInput({ player_keys: z.array(z.string().min(1).max(160)).min(2).max(8), season_years: z.array(yearSchema).max(20).optional(), include_games: z.boolean().default(false) }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_keys, season_years, include_games, fields, format }, extra) => runApi(() => api.get("/api/v1/stats/players/compare", query({ player_keys: player_keys.join(","), season_years: season_years?.join(","), include_games }), extra.signal), presentation({ fields, format })),
  );

  // Composite reports.
  registerTool(
    "player_season_report",
    {
      title: "Build a player season report",
      description: "Answer how a player performed in one season with one call. Example: player_season_report({ player_key: 'patrick-mahomes', season: 2024 }).",
      inputSchema: strictInput({ player_key: z.string().min(1).max(160), season: yearSchema, season_type: seasonTypeSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_key, season, season_type, fields, format }, extra) => runApi(async () => {
      const base = `/api/v1/players/${segment(player_key)}`;
      const { results, errors } = await settleSources({
        bio: api.get(`${base}/bio`, undefined, extra.signal),
        seasons: api.get(`${base}/career/seasons`, { season, season_type: season_type === "ALL" ? undefined : season_type, limit: 10, offset: 0 }, extra.signal),
        splits: api.get(`${base}/splits`, { season, season_type }, extra.signal),
        roster: api.get(`${base}/roster`, undefined, extra.signal),
      });
      if (!results.roster) {
        try {
          results.profile_fallback = await api.get(base, undefined, extra.signal);
        } catch (fallbackError) {
          errors.profile_fallback = sourceError(fallbackError);
        }
      }
      const seasonRows = rows(results.seasons?.data).filter((row) => season_type === "ALL" || row.season_type === season_type);
      const rosterRows = rows(results.roster?.data).filter((row) => Number(row.season_year) === season);
      const data = {
        player_key,
        season,
        bio: results.bio?.data ?? null,
        season_stats: seasonRows.length === 1 ? seasonRows[0] : seasonRows,
        splits: results.splits?.data ?? null,
        roster: rosterRows,
        roster_context: results.roster ? null : results.profile_fallback?.data ?? null,
      };
      return partialAggregateResult(data, results, errors);
    }, presentation({ fields, format }, {
      maxSummaryChars: 1_450,
      maxSummaryItems: 6,
      summaryTransform: (data) => reportSummaryPlayerSeason(isRecord(data) ? data : {}),
    })),
  );

  registerTool(
    "player_career_report",
    {
      title: "Build a player career report",
      description: "Join career totals, honors, records, and history. Example: player_career_report({ player_key: 'patrick-mahomes' }).",
      inputSchema: strictInput({ player_key: z.string().min(1).max(160), season_type: seasonTypeSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_key, season_type, fields, format }, extra) => runApi(async () => {
      const base = `/api/v1/players/${segment(player_key)}`;
      const { results, errors } = await settleSources({
        career: api.get(`${base}/career`, undefined, extra.signal),
        honors: api.get(`${base}/honors`, undefined, extra.signal),
        records: api.get(`${base}/records`, { season_type }, extra.signal),
        history: api.get(`${base}/history`, undefined, extra.signal),
      });
      return partialAggregateResult({
        player_key,
        career: results.career?.data ?? null,
        honors: results.honors?.data ?? null,
        records: results.records?.data ?? null,
        history: results.history?.data ?? null,
      }, results, errors);
    }, presentation({ fields, format }, {
      maxSummaryChars: 1_450,
      maxSummaryItems: 6,
      summaryTransform: (data) => reportSummaryCareer(isRecord(data) ? data : {}),
    })),
  );

  registerTool(
    "team_season_report",
    {
      title: "Build a team season report",
      description: "Join team profile, record, stats, rankings, and roster. Example: team_season_report({ team_abbr: 'KC', season: 2024 }).",
      inputSchema: strictInput({ team_abbr: teamSchema, season: yearSchema, roster_limit: z.number().int().min(1).max(25).default(10) }),
      annotations: readOnlyAnnotations,
    },
    async ({ team_abbr, season, roster_limit, fields, format }, extra) => runApi(async () => {
      const base = `/api/v1/teams/${segment(team_abbr)}`;
      try {
        await assertValidTeam(team_abbr);
        const { results, errors } = await settleSources({
          profile: api.get(`${base}/profile`, { season }, extra.signal),
          season: api.get(`${base}/season`, { season }, extra.signal),
          stats: api.get(`${base}/stats`, { season }, extra.signal),
          rankings: api.get(`${base}/power-rankings`, { season }, extra.signal),
          roster: api.get(`${base}/roster`, { year: season, limit: roster_limit, offset: 0 }, extra.signal),
        });
        return partialAggregateResult({
          team_abbr,
          season_year: season,
          profile: results.profile?.data ?? null,
          season: results.season?.data ?? null,
          stats: results.stats?.data ?? null,
          power_rankings: results.rankings?.data ?? null,
          roster: results.roster?.data ?? [],
        }, results, errors);
      } catch (error) {
        return teamError(error, team_abbr);
      }
    }, presentation({ fields, format }, {
      maxSummaryChars: 2_500,
      maxSummaryItems: 8,
      summaryTransform: (data) => reportSummaryTeam(isRecord(data) ? data : {}),
    })),
  );

  registerTool(
    "game_preview",
    {
      title: "Build a game preview",
      description: "Join matchup, records, venue, officials, and head-to-head context. Example: game_preview({ game_id: 12001 }).",
      inputSchema: strictInput({ game_id: z.number().int().positive(), playoff: z.boolean().default(false), head_to_head_limit: z.number().int().min(1).max(10).default(5) }),
      annotations: readOnlyAnnotations,
    },
    async ({ game_id, playoff, head_to_head_limit, fields, format }, extra) => runApi(async () => {
      const family = playoff ? "playoff-games" : "games";
      const detail = await api.get(`/api/v1/${family}/${game_id}`, undefined, extra.signal);
      const game = isRecord(detail.data) ? detail.data : {};
      const away = isRecord(game.away_team) ? String(game.away_team.abbr ?? "") : String(game.awayAbbr ?? "");
      const home = isRecord(game.home_team) ? String(game.home_team.abbr ?? "") : String(game.homeAbbr ?? "");
      const season = Number(game.season_year ?? game.seasonYear);
      const { results, errors } = await settleSources({
        away_team: api.get(`/api/v1/teams/${segment(away)}/season`, { season }, extra.signal),
        home_team: api.get(`/api/v1/teams/${segment(home)}/season`, { season }, extra.signal),
        extras: api.get(`/api/v1/${family}/${game_id}/extras`, undefined, extra.signal),
        games: api.get("/api/v1/games", { team: away, order: "desc", include_playoffs: true, limit: 1000, offset: 0 }, extra.signal),
      });
      results.detail = detail;
      const headToHead = rows(results.games?.data).filter((row) => [row.awayAbbr, row.homeAbbr].map(String).includes(home) && Number(row.id) !== game_id).slice(0, head_to_head_limit);
      const extraData = isRecord(results.extras?.data) ? results.extras.data : {};
      const data = { game, records: { away: results.away_team?.data ?? null, home: results.home_team?.data ?? null }, venue: extraData.stadiumMeta ?? game.stadium, officials: extraData.officials ?? [], head_to_head: headToHead };
      return partialAggregateResult(data, results, errors);
    }, presentation({ fields, format }, { maxSummaryChars: 2_500, maxSummaryItems: 6 })),
  );

  registerTool(
    "game_recap",
    {
      title: "Build a game recap",
      description: "Join the result, box-score tables, venue context, and team play-efficiency splits. Example: game_recap({ game_id: 12001 }).",
      inputSchema: strictInput({ game_id: z.number().int().positive() }),
      annotations: readOnlyAnnotations,
    },
    async ({ game_id, fields, format }, extra) => runApi(async () => {
      const { results, errors } = await settleSources({
        detail: api.get(`/api/v1/games/${game_id}`, undefined, extra.signal),
        stats: api.get(`/api/v1/games/${game_id}/stats`, undefined, extra.signal),
        extras: api.get(`/api/v1/games/${game_id}/extras`, undefined, extra.signal),
        play_efficiency: api.get("/api/v1/plays/summary", { game_id, group_by: "team" }, extra.signal),
      });
      return partialAggregateResult({
        game: results.detail?.data ?? null,
        stats: results.stats?.data ?? null,
        extras: results.extras?.data ?? null,
        play_efficiency: results.play_efficiency?.data ?? null,
      }, results, errors);
    }, presentation({ fields, format }, { maxSummaryChars: 3_000, maxSummaryItems: 8 })),
  );

  registerTool(
    "search_plays",
    {
      title: "Read and search NFL play-by-play",
      description: "Read an ordered game, player, or tightly scoped season slice. Active-game rows are provisional and omit analytical fields such as EPA, win probability, and stable player keys until the validated daily import. Example: search_plays({ game_id: 12001, skip_markers: true, limit: 200 }).",
      inputSchema: strictInput({
        game_id: z.number().int().positive().optional(),
        season: yearSchema.optional(),
        week: z.number().int().min(1).max(25).optional(),
        season_type: seasonTypeSchema,
        team: z.string().trim().max(12).optional(),
        opponent: z.string().trim().max(12).optional(),
        player: z.string().trim().max(160).optional(),
        role: z.enum(PLAY_ROLES).default("any"),
        play_type: z.string().trim().max(40).optional(),
        down: z.number().int().min(1).max(4).optional(),
        quarter: z.number().int().min(1).max(6).optional(),
        red_zone: z.boolean().default(false),
        skip_markers: z.boolean().default(true),
        order: z.enum(["asc", "desc"]).default("asc"),
        limit: z.number().int().min(1).max(250).default(100),
        offset: z.number().int().min(0).max(1_000_000).default(0),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ fields, format, ...filters }, extra) => runApi(
      () => api.get("/api/v1/plays", query(filters), extra.signal),
      presentation({ fields, format }, { maxSummaryChars: 4_000, maxSummaryItems: 20 }),
    ),
  );

  registerTool(
    "summarize_play_efficiency",
    {
      title: "Analyze play-by-play efficiency",
      description: "Answer efficiency questions with compact aggregates instead of downloading thousands of plays. Scope by season, game, or season range. Example: summarize_play_efficiency({ season: 2025, group_by: 'team' }).",
      inputSchema: strictInput({
        season: yearSchema.optional(),
        game_id: z.number().int().positive().optional(),
        season_from: yearSchema.optional(),
        season_to: yearSchema.optional(),
        season_type: seasonTypeSchema,
        week: z.number().int().min(1).max(25).optional(),
        team: z.string().trim().max(12).optional(),
        opponent: z.string().trim().max(12).optional(),
        player: z.string().trim().max(160).optional(),
        play_type: z.string().trim().max(40).optional(),
        down: z.number().int().min(1).max(4).optional(),
        quarter: z.number().int().min(1).max(6).optional(),
        red_zone: z.boolean().default(false),
        group_by: z.enum(PLAY_SUMMARY_GROUPINGS).default("team"),
        limit: z.number().int().min(1).max(500).default(100),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ fields, format, ...filters }, extra) => runApi(
      () => api.get("/api/v1/plays/summary", query(filters), extra.signal),
      presentation({ fields, format }, { maxSummaryChars: 3_500, maxSummaryItems: 32 }),
    ),
  );

  registerTool(
    "get_play_efficiency_leaders",
    {
      title: "Rank players by play efficiency",
      description: "Rank passers, rushers, or receivers by EPA, success, yards, volume, or CPOE with a meaningful minimum-play floor. Example: get_play_efficiency_leaders({ season: 2025, role: 'passer', sort: 'epa_per_play' }).",
      inputSchema: strictInput({
        season: yearSchema,
        season_type: seasonTypeSchema,
        role: z.enum(PLAY_LEADER_ROLES).default("passer"),
        sort: z.enum(PLAY_LEADER_SORTS).default("epa_per_play"),
        team: z.string().trim().max(12).optional(),
        opponent: z.string().trim().max(12).optional(),
        week_from: z.number().int().min(1).max(25).optional(),
        week_to: z.number().int().min(1).max(25).optional(),
        min_plays: z.number().int().min(1).max(10_000).optional(),
        order: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).max(100_000).default(0),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ fields, format, ...filters }, extra) => runApi(
      () => api.get("/api/v1/plays/leaders", query(filters), extra.signal),
      presentation({ fields, format }, { maxSummaryChars: 3_500, maxSummaryItems: 25 }),
    ),
  );

  // Remaining Phase 1 coverage.
  registerTool("get_bye_weeks", { title: "Get NFL bye weeks", description: "Get bye weeks for a season. Example: get_bye_weeks({ season: 2025 }).", inputSchema: strictInput({ season: yearSchema }), annotations: readOnlyAnnotations }, async ({ season, fields, format }, extra) => runApi(() => api.get(`/api/v1/byes/${season}`, undefined, extra.signal), presentation({ fields, format })));

  registerTool("get_team_schedule", { title: "Get a team schedule", description: "Get recent games for a team. Example: get_team_schedule({ team_abbr: 'PIT', limit: 10 }).", inputSchema: strictInput({ team_abbr: teamSchema, limit: z.number().int().min(1).max(100).default(10) }), annotations: readOnlyAnnotations }, async ({ team_abbr, limit, fields, format }, extra) => runApi(async () => {
    await assertValidTeam(team_abbr);
    return api.get(`/api/v1/teams/${segment(team_abbr)}/games`, { limit }, extra.signal);
  }, presentation({ fields, format })));

  registerTool("get_hall_of_fame", { title: "Search Hall of Fame elections", description: "Search nominees or fetch one election year. Example: get_hall_of_fame({ election_year: 2025 }).", inputSchema: strictInput({ election_year: yearSchema.optional(), search: z.string().max(120).optional(), role: z.enum(["player", "coach", "contributor"]).optional(), ballot_type: z.enum(["inductee", "final", "senior", "semi"]).optional(), inductee: z.boolean().optional(), year_from: yearSchema.optional(), year_to: yearSchema.optional(), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ election_year, fields, format, ...rest }, extra) => runApi(() => api.get(election_year ? `/api/v1/hall-of-fame/${election_year}` : "/api/v1/hall-of-fame", election_year ? undefined : query(rest), extra.signal), presentation({ fields, format })));

  registerTool("get_pro_bowl", { title: "Get Pro Bowl selections", description: "Get curated and optional raw Pro Bowl selections. Example: get_pro_bowl({ season: 2024, include_reference: true }).", inputSchema: strictInput({ season: yearSchema, team: z.string().max(12).optional(), include_reference: z.boolean().default(false), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ season, team, include_reference, limit, offset, fields, format }, extra) => runApi(async () => {
    const curated = await api.get(`/api/v1/pro-bowls/${season}`, undefined, extra.signal);
    if (!include_reference) return curated;
    const reference = await api.get("/api/v1/reference/pro-bowl-selections", query({ season, team, limit, offset }), extra.signal);
    return aggregateResult({ curated: curated.data, reference: reference.data }, { curated, reference });
  }, presentation({ fields, format })));

  registerTool("get_playoff_game", { title: "Get a playoff game", description: "Read playoff detail, extras, or supplemental data. Example: get_playoff_game({ game_id: 39, view: 'extras' }).", inputSchema: strictInput({ game_id: z.number().int().positive(), view: z.enum(["detail", "extras", "supplemental"]).default("detail") }), annotations: readOnlyAnnotations }, async ({ game_id, view, fields, format }, extra) => runApi(async () => {
    const field = singleSimpleField(fields);
    const result = await api.get(`/api/v1/playoff-games/${game_id}${view === "detail" ? field ? `/${segment(field)}` : "" : `/${view}`}`, undefined, extra.signal);
    return field && view === "detail" ? expandFieldResult(result, field) : result;
  }, presentation({ fields, format })));

  registerTool("get_game_leaders", { title: "Get single-game leaders", description: "Get game leaders by stat family. Example: get_game_leaders({ season: 2024, stat_family: 'passing', stat: 'pass_yds' }).", inputSchema: strictInput({ season: yearSchema, stat_family: z.enum(GAME_STAT_FAMILIES), stat: z.string().max(100).optional(), season_type: seasonTypeSchema, team: z.string().max(12).optional(), opponent: z.string().max(12).optional(), position: z.string().max(20).optional(), search: z.string().max(120).optional(), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ season, stat_family, stat, fields, format, ...rest }, extra) => runApi(async () => {
    if (stat) await assertValidStat(stat, "game_stats");
    return api.get(`/api/v1/stats/players/games/leaders/${stat_family}`, query({ season_year: season, stat, ...rest }), extra.signal);
  }, presentation({ fields, format }, stat ? { summaryTransform: (data) => trimLeaders(data, stat) } : {})));

  registerTool("search_officials", { title: "Search NFL officials", description: "Search raw officials and optional assignment history; use search, not query. Example: search_officials({ search: 'Blakeman', include_history: true }).", inputSchema: strictInput({ search: z.string().max(120).optional(), include_history: z.boolean().default(false), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ search, include_history, limit, offset, fields, format }, extra) => runApi(async () => {
    const officials = await api.get("/api/v1/reference/officials", query({ search, limit, offset }), extra.signal);
    if (!include_history) return officials;
    const history = await api.get("/api/v1/history/officials", query({ search, limit, offset }), extra.signal);
    return aggregateResult({ officials: officials.data, history: history.data }, { officials, history });
  }, presentation({ fields, format })));

  registerTool("get_venue", { title: "Search NFL venues and stadiums", description: "Fetch a venue key or search venue/stadium/history records. Example: get_venue({ search: 'Arrowhead', kind: 'venues' }).", inputSchema: strictInput({ venue_key: z.string().max(160).optional(), search: z.string().max(120).optional(), team: z.string().max(12).optional(), kind: z.enum(["venues", "stadiums", "stadium-histories"]).default("venues"), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ venue_key, search, team, kind, limit, offset, fields, format }, extra) => runApi(() => {
    if (venue_key && kind !== "venues") throw new NFLMetaApiError("venue_key is only valid with kind='venues'", { code: "invalid_request" });
    const path = venue_key ? `/api/v1/reference/venues/${segment(venue_key)}` : `/api/v1/reference/${kind}`;
    return api.get(path, venue_key ? undefined : query({ search, team, limit, offset }), extra.signal);
  }, presentation({ fields, format })));

  registerTool("search_executives", { title: "Search NFL executives", description: "Search executives; use search, not query. Example: search_executives({ search: 'Rooney', team: 'PIT' }).", inputSchema: strictInput({ search: z.string().max(120).optional(), team: z.string().max(12).optional(), hall_of_fame: z.boolean().optional(), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/executives", query(args), extra.signal), presentation({ fields, format })));

  registerTool("search_staff", { title: "Search current NFL staff", description: "Search team staff; use search, not query. Example: search_staff({ title: 'Coordinator', team: 'PIT' }).", inputSchema: strictInput({ search: z.string().max(120).optional(), team: z.string().max(12).optional(), group: z.string().max(80).optional(), title: z.string().max(120).optional(), linked_to_coach: z.boolean().optional(), season: yearSchema.optional(), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ season, fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/staff", query({ ...args, season_year: season }), extra.signal), presentation({ fields, format })));

  registerTool("search_contributors", { title: "Search NFL contributors", description: "Search contributor profiles; use search, not query. Example: search_contributors({ search: 'Sabol' }).", inputSchema: strictInput({ search: z.string().max(120).optional(), inductee: z.boolean().optional(), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/contributors", query(args), extra.signal), presentation({ fields, format })));

  registerTool("get_team_branding", { title: "Get team branding history", description: "Get colors, logos, names, aliases, or all four. Example: get_team_branding({ team_abbr: 'PIT', kind: 'all' }).", inputSchema: strictInput({ team_abbr: teamSchema, kind: z.enum(["all", "colors", "logos", "names", "aliases"]).default("all"), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ team_abbr, kind, limit, offset, fields, format }, extra) => runApi(async () => {
    await assertValidTeam(team_abbr);
    const paths = { colors: "team-colors", logos: "team-logo-histories", names: "team-name-histories", aliases: "team-aliases" } as const;
    const selected = kind === "all" ? Object.entries(paths) : [[kind, paths[kind]]];
    const results = await Promise.all(selected.map(async ([name, path]) => [name, await api.get(`/api/v1/reference/${path}`, { team: team_abbr, limit, offset }, extra.signal)] as const));
    const sources = Object.fromEntries(results);
    return aggregateResult(Object.fromEntries(results.map(([name, result]) => [name, result.data])), sources);
  }, presentation({ fields, format })));

  registerTool("get_broadcast_rights", { title: "Get season broadcast rights", description: "Get broadcast-rights records for a season. Example: get_broadcast_rights({ season: 2025 }).", inputSchema: strictInput({ season: yearSchema }), annotations: readOnlyAnnotations }, async ({ season, fields, format }, extra) => runApi(() => api.get(`/api/v1/season/${season}/broadcast-rights`, undefined, extra.signal), presentation({ fields, format })));

  registerTool("list_top_100", { title: "Browse NFL Top 100 rankings", description: "Browse one season of the player-voted NFL Top 100, including an explicit publication status while the countdown is underway. Example: list_top_100({ year: 2026, team: 'PHI' }).", inputSchema: strictInput({ year: yearSchema.optional(), team: z.string().trim().max(12).optional(), position: z.string().trim().max(20).optional(), search: z.string().trim().max(120).optional(), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ fields, format, ...args }, extra) => runApi(() => api.get("/api/v1/nfl-top-100", query(args), extra.signal), presentation({ fields, format })));

  registerTool("get_player_jersey_history", { title: "Get a player's jersey-number history", description: "Get the jersey numbers and season spans recorded for one canonical player. Example: get_player_jersey_history({ player_key: 'tom-brady' }).", inputSchema: strictInput({ player_key: z.string().trim().min(1).max(160) }), annotations: readOnlyAnnotations }, async ({ player_key, fields, format }, extra) => runApi(() => api.get(`/api/v1/players/${segment(player_key)}/jersey-history`, undefined, extra.signal), presentation({ fields, format })));

  registerTool(
    "list_transactions",
    {
      title: "List NFL roster transactions",
      description: "Find recorded signings, releases, trades, reserve-list moves, practice-squad moves, and other roster changes across the league or for one team. Dates reflect when a change was observed in weekly roster data, not necessarily its announcement date. Example: list_transactions({ season: 2026, team_abbr: 'PIT', type: 'signed' }).",
      inputSchema: strictInput({
        season: yearSchema.optional(),
        team_abbr: teamSchema.optional(),
        type: z.enum(TRANSACTION_EVENT_TYPES).optional(),
        days: z.number().int().min(1).max(3650).optional().describe("Only changes with an effective date in the last N days"),
        limit: limitSchema,
        offset: offsetSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ team_abbr, fields, format, ...args }, extra) => runApi(async () => {
      if (team_abbr) await assertValidTeam(team_abbr);
      return api.get("/api/v1/transactions", query({ ...args, team: team_abbr }), extra.signal);
    }, presentation({ fields, format })),
  );

  registerTool(
    "get_player_transactions",
    {
      title: "Get a player's transaction history",
      description: "Read one player's recorded club and roster movement history, including spells that ended in a release. Example: get_player_transactions({ player_key: 'russell-wilson', season: 2025 }).",
      inputSchema: strictInput({
        player_key: z.string().trim().min(1).max(160),
        season: yearSchema.optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_key, season, fields, format }, extra) => runApi(
      () => api.get(`/api/v1/players/${segment(player_key)}/transactions`, query({ season }), extra.signal),
      presentation({ fields, format }),
    ),
  );

  registerTool(
    "list_injuries",
    {
      title: "List NFL injury reports",
      description: "Read recorded weekly practice participation and final game-status designations across the league or for one team. This is a report snapshot, not live medical or breaking-news data. Example: list_injuries({ season: 2025, week: 12, team_abbr: 'KC', status: 'Questionable' }).",
      inputSchema: strictInput({
        season: yearSchema.optional(),
        week: z.number().int().min(1).max(25).optional(),
        team_abbr: teamSchema.optional(),
        status: z.enum(INJURY_STATUSES).optional(),
        limit: limitSchema,
        offset: offsetSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ team_abbr, fields, format, ...args }, extra) => runApi(async () => {
      if (team_abbr) await assertValidTeam(team_abbr);
      return api.get("/api/v1/injuries", query({ ...args, team: team_abbr }), extra.signal);
    }, presentation({ fields, format })),
  );

  registerTool(
    "get_player_injuries",
    {
      title: "Get a player's injury-report history",
      description: "Read the weekly injury-report records held for one player, optionally narrowed to a season. This does not infer current health beyond the returned report dates and statuses. Example: get_player_injuries({ player_key: 'calais-campbell', season: 2025 }).",
      inputSchema: strictInput({
        player_key: z.string().trim().min(1).max(160),
        season: yearSchema.optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ player_key, season, fields, format }, extra) => runApi(
      () => api.get(`/api/v1/players/${segment(player_key)}/injuries`, query({ season }), extra.signal),
      presentation({ fields, format }),
    ),
  );

  registerTool(
    "get_depth_chart",
    {
      title: "Get a team's depth chart",
      description: "Read one team's depth chart as both grouped personnel packages and flat entries. Filter to a position, package, or starters when useful. This is a dated snapshot, not a live lineup guarantee. Example: get_depth_chart({ team_abbr: 'PIT', position: 'WR' }).",
      inputSchema: strictInput({
        team_abbr: teamSchema,
        season: yearSchema.optional(),
        position: z.string().trim().max(20).optional(),
        position_group: z.string().trim().max(80).optional().describe("Published personnel package, such as 3WR 1TE"),
        starters: z.boolean().default(false),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ team_abbr, fields, format, ...args }, extra) => runApi(async () => {
      await assertValidTeam(team_abbr);
      return api.get(`/api/v1/teams/${segment(team_abbr)}/depth-chart`, query(args), extra.signal);
    }, presentation({ fields, format }, { maxSummaryItems: 30 })),
  );

  registerTool(
    "list_depth_chart_changes",
    {
      title: "List depth-chart changes",
      description: "Find recorded promotions, demotions, additions, removals, and replacements, optionally for one team or player. Example: list_depth_chart_changes({ team_abbr: 'PIT', days: 7 }).",
      inputSchema: strictInput({
        season: yearSchema.optional(),
        team_abbr: teamSchema.optional(),
        player_key: z.string().trim().min(1).max(160).optional(),
        type: z.enum(DEPTH_CHART_CHANGE_TYPES).optional(),
        days: z.number().int().min(1).max(365).optional().describe("Only changes detected in the last N days"),
        limit: limitSchema,
        offset: offsetSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ team_abbr, fields, format, ...args }, extra) => runApi(async () => {
      if (team_abbr) await assertValidTeam(team_abbr);
      return api.get("/api/v1/depth-charts/changes", query({ ...args, team: team_abbr }), extra.signal);
    }, presentation({ fields, format })),
  );

  registerTool("get_my_usage", { title: "Get MCP API-key usage", description: "Check the downstream API key's quota and usage. Example: get_my_usage({ format: 'summary' }).", inputSchema: strictInput({}), annotations: readOnlyAnnotations }, async (args, extra) => runApi(() => api.get("/api/v1/usage", undefined, extra.signal), presentation(args)));

  registerTool("get_all_star_games", { title: "Get NFL all-star games", description: "Get curated, raw-reference, or combined all-star game records. Example: get_all_star_games({ source: 'both' }).", inputSchema: strictInput({ source: z.enum(["curated", "reference", "both"]).default("curated"), limit: limitSchema, offset: offsetSchema }), annotations: readOnlyAnnotations }, async ({ source, limit, offset, fields, format }, extra) => runApi(async () => {
    if (source === "curated") return api.get("/api/v1/all-star-games", undefined, extra.signal);
    if (source === "reference") return api.get("/api/v1/reference/all-star-games", { limit, offset }, extra.signal);
    const [curated, reference] = await Promise.all([api.get("/api/v1/all-star-games", undefined, extra.signal), api.get("/api/v1/reference/all-star-games", { limit, offset }, extra.signal)]);
    return aggregateResult({ curated: curated.data, reference: reference.data }, { curated, reference });
  }, presentation({ fields, format })));

  registerTool(
    "get_current_context",
    {
      title: "Get current NFL context",
      description: "Get current season/week, today's games, this week's games, byes, and latest completed week. Example: get_current_context({}).",
      inputSchema: strictInput({ as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional UTC date for deterministic research") }),
      annotations: readOnlyAnnotations,
    },
    async ({ as_of, fields, format }, extra) => runApi(async () => {
      const date = as_of ?? new Date().toISOString().slice(0, 10);
      const seasons = await api.get("/api/v1/seasons", { limit: 1, offset: 0 }, extra.signal);
      const availableSeasons = rows(seasons.data);
      const latestSeason = Number(availableSeasons[0]?.year);
      if (!Number.isFinite(latestSeason)) throw new NFLMetaApiError("NFLMeta did not return a current season", { code: "invalid_response" });
      // as_of asks "what did the league look like on this date", so the season
      // has to come from the date rather than from whichever season is newest.
      // Taking the newest regardless meant an as_of in 2025 reported the 2026
      // season while deriving its week number from 2025 -- two different years
      // in one answer. The league year turns over in March, so January and
      // February belong to the season that started the previous autumn.
      const asOfSeason = (() => {
        const [year, month] = date.split("-").map(Number);
        return month >= 3 ? year : year - 1;
      })();
      const season = as_of ? Math.min(asOfSeason, latestSeason) : latestSeason;
      const [games, byes] = await Promise.all([
        api.get("/api/v1/games", { season, order: "asc", include_playoffs: true, limit: 1000, offset: 0 }, extra.signal),
        api.get(`/api/v1/byes/${season}`, undefined, extra.signal),
      ]);
      const allGames = rows(games.data);
      let completed = allGames.filter((game) => gameDate(game) <= date && game.awayScore != null && game.homeScore != null);
      let completedSeason = season;
      let previousGames: NFLMetaApiResult | undefined;
      if (!completed.length) {
        const previousSeason = season - 1;
        previousGames = await api.get("/api/v1/games", { season: previousSeason, order: "asc", include_playoffs: true, limit: 1000, offset: 0 }, extra.signal);
        completed = rows(previousGames.data).filter((game) => gameDate(game) <= date && game.awayScore != null && game.homeScore != null);
        completedSeason = previousSeason;
      }
      const upcoming = allGames.filter((game) => gameDate(game) >= date);
      const asOfTime = Date.parse(`${date}T00:00:00Z`);
      const distanceInDays = (game: Record<string, unknown>) => Math.abs(Date.parse(`${gameDate(game)}T00:00:00Z`) - asOfTime) / 86_400_000;
      const anchor = upcoming.find((game) => distanceInDays(game) <= 7)
        ?? [...completed].reverse().find((game) => distanceInDays(game) <= 7);
      const currentWeek = anchor?.week == null ? null : Number(anchor.week);
      const latestCompletedWeek = completed.reduce((max, game) => Math.max(max, Number(game.week) || 0), 0) || null;
      const byeData = isRecord(byes.data) && Array.isArray(byes.data.byes) ? byes.data.byes.filter(isRecord) : [];
      const teamsOnBye = currentWeek == null ? [] : byeData.filter((team) => Array.isArray(team.bye_weeks) ? team.bye_weeks.map(Number).includes(currentWeek) : Number(team.bye_week) === currentWeek);
      const data = {
        as_of: date,
        current_season: season,
        current_week: currentWeek,
        games_today: allGames.filter((game) => gameDate(game) === date),
        games_this_week: currentWeek == null ? [] : allGames.filter((game) => Number(game.week) === currentWeek),
        teams_on_bye: teamsOnBye,
        most_recent_completed_week: latestCompletedWeek,
        most_recent_completed_season: latestCompletedWeek == null ? null : completedSeason,
      };
      return aggregateResult(data, { seasons, games, byes, ...(previousGames ? { previous_games: previousGames } : {}) });
    }, presentation({ fields, format }, { maxSummaryChars: 3_000, maxSummaryItems: 16 })),
  );

  registerTool(
    "nflmeta_api_get",
    {
      title: "Read any NFLMeta API endpoint",
      description: "Advanced fallback for clean documented /api/v1 paths. Example: nflmeta_api_get({ path: '/api/v1/reference/seasons' }).",
      inputSchema: strictInput({ path: z.string().startsWith("/api/v1/").max(500).describe("Clean /api/v1 path without ? or #"), query: rawQuerySchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ path, query: rawQuery, fields, format }, extra) => runApi(() => api.get(path, rawQuery, extra.signal), presentation({ fields, format })),
  );

  return server;
}
