import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listStaff } from "@/lib/api-staff-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function parseBoolean(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const limit = parsePositiveInt(req.nextUrl.searchParams.get("limit"), 50, 200);
  const offset = parsePositiveInt(req.nextUrl.searchParams.get("offset"), 0, 100_000);
  const seasonRaw = req.nextUrl.searchParams.get("season_year");
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;

  const result = await listStaff({
    search: req.nextUrl.searchParams.get("search") || undefined,
    team: req.nextUrl.searchParams.get("team") || undefined,
    group: req.nextUrl.searchParams.get("group") || undefined,
    title: req.nextUrl.searchParams.get("title") || undefined,
    linkedToCoach: parseBoolean(req.nextUrl.searchParams.get("linked_to_coach")),
    seasonYear: Number.isFinite(seasonYear as number) ? seasonYear : undefined,
    limit,
    offset,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      season_year: result.seasonYear,
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: offset + result.rows.length < result.total,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
