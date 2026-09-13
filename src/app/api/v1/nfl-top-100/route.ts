import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getNflTop100Season, listNflTop100Years, normalizeTop100Team } from "@/lib/nfl-top-100-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const years = await listNflTop100Years();
  const requestedYear = req.nextUrl.searchParams.get("year");
  const year = requestedYear ? Number.parseInt(requestedYear, 10) : years[0];
  if (!Number.isInteger(year) || !years.includes(year)) {
    return jsonApiError(auth, 400, "invalid_request", "year must be a published NFL Top 100 season");
  }

  const season = await getNflTop100Season(year);
  const team = normalizeTop100Team(req.nextUrl.searchParams.get("team"), year);
  const position = (req.nextUrl.searchParams.get("position") || "").trim().toUpperCase();
  const search = (req.nextUrl.searchParams.get("search") || req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 100);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 1_000_000);
  const filtered = season.rows.filter((row) => {
    if (team && row.displayTeam !== team) return false;
    if (position && (row.position || "").toUpperCase() !== position) return false;
    if (search && !`${row.displayName} ${row.player || ""} ${row.displayTeam || ""} ${row.position || ""}`.toLowerCase().includes(search)) return false;
    return true;
  });
  const data = filtered.slice(offset, offset + limit);

  return jsonWithRateLimit(auth, {
    data,
    meta: {
      year,
      status: season.complete ? "complete" : "in_progress",
      published: season.published,
      expected: 100,
      missing_ranks: season.missingRanks,
      total: filtered.length,
      limit,
      offset,
      returned: data.length,
      has_more: offset + data.length < filtered.length,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
