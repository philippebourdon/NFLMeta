import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { paginationPolicyForPlan } from "@/lib/api-pagination";
import { type BillingPlan, normalizeBillingPlan } from "@/lib/customer-plans";
import { comparePlayers } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * How many players one comparison may name.
 *
 * There was no cap at all, and `player_keys` is the one list parameter on the
 * API whose every entry costs a full career game-log collection. That made a
 * single billed request into an unbounded amount of work: 24 keys with
 * `include_games=true` exhausted the ten-connection pool outright and returned
 * "timeout exceeded when trying to connect". The per-key loop behind it is now
 * one query (see comparePlayers), which removes the pool exhaustion, but the
 * work still grows with the list -- measured after that fix, against players
 * picked to span 1966 to 2025 so their seasons barely overlap: 8 keys 274 ms,
 * 25 keys 1.48 s, 50 keys 3.35 s. A ceiling is what keeps that honest.
 *
 * Shaped as a plan ladder like quotaForPlan and rowQuotaForPlan in
 * customer-plans.ts, with the same env override and the same fail-closed
 * parse, because it is the same kind of control: what a tier is allowed to ask
 * for in one go.
 *
 * The numbers are deliberately far below the plan's maxPageSize, which is the
 * project's usual answer to "how many rows may one request return". A row
 * there is a table row; a row here is a player's entire career, so the two are
 * not comparable units and reusing that number would have set the free tier at
 * 100 careers a request. The free rung is 8 because that is already the cap
 * this project's own MCP client enforces on the same parameter
 * (mcp-server/src/server.mts), so no first-party caller loses anything.
 *
 * This belongs in customer-plans.ts next to the other ladders. It is here
 * because that file was outside the scope this change was allowed to touch.
 */
function comparePlayerKeyLimitForPlan(plan: string | null | undefined): number {
  const limits: Record<BillingPlan, number> = {
    free: envInt("NFLMETA_PLAN_FREE_COMPARE_PLAYERS", 8),
    builder: envInt("NFLMETA_PLAN_STARTER_COMPARE_PLAYERS", 16),
    pro: envInt("NFLMETA_PLAN_PRO_COMPARE_PLAYERS", 32),
    team: envInt("NFLMETA_PLAN_BUSINESS_COMPARE_PLAYERS", 64),
  };
  const limit = limits[normalizeBillingPlan(plan)];
  // Never let an env override hand out more careers than the plan may return
  // as rows; the ladder above should always be the binding constraint.
  return Math.min(limit, paginationPolicyForPlan(plan).maxPageSize);
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const playerKeys = (req.nextUrl.searchParams.get("player_keys") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (playerKeys.length < 2) {
    return jsonApiError(auth, 400, "invalid_request", "player_keys must contain at least two players");
  }

  // Counted before de-duplication, on the list as sent. comparePlayers dedupes
  // internally, so counting after it would let a caller send the same key
  // 500 times and still be told the request was fine.
  const playerKeyLimit = comparePlayerKeyLimitForPlan(auth.billingPlan);
  if (playerKeys.length > playerKeyLimit) {
    return jsonApiError(
      auth,
      400,
      "invalid_request",
      `player_keys accepts at most ${playerKeyLimit} players per request on the ${auth.billingPlan} plan; `
        + `${playerKeys.length} were given. Split the comparison across requests.`,
    );
  }

  const seasonYears = (req.nextUrl.searchParams.get("season_years") || "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter(Number.isFinite);

  const includeGames = (req.nextUrl.searchParams.get("include_games") || "").trim().toLowerCase() === "true";
  const data = await comparePlayers({
    playerKeys,
    seasonYears: seasonYears.length ? seasonYears : undefined,
    includeGames,
  });
  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
