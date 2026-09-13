import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getLatestDraftPickYear, listApiDraftPicks } from "@/lib/customer-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseOptionalPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function resolveYear(req: NextRequest): Promise<number | null> {
  const raw = req.nextUrl.searchParams.get("year") || req.nextUrl.searchParams.get("draft_year");
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return getLatestDraftPickYear();
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const year = await resolveYear(req);
  if (!year) {
    return jsonApiError(auth, 400, "invalid_request", "valid year is required");
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 50, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 1_000_000);
  const result = await listApiDraftPicks({
    year,
    team: req.nextUrl.searchParams.get("team") || undefined,
    round: parseOptionalPositiveInt(req.nextUrl.searchParams.get("round")),
    college: req.nextUrl.searchParams.get("college") || undefined,
    search: req.nextUrl.searchParams.get("search") || req.nextUrl.searchParams.get("q") || undefined,
    limit,
    offset,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      year,
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: result.hasMore,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
