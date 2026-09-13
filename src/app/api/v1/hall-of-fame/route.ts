import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listHallOfFameNominees } from "@/lib/api-hall-of-fame-data";
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
  const yearFrom = req.nextUrl.searchParams.get("year_from");
  const yearTo = req.nextUrl.searchParams.get("year_to");

  const result = await listHallOfFameNominees({
    search: req.nextUrl.searchParams.get("search") || undefined,
    role: req.nextUrl.searchParams.get("role") || undefined,
    ballotType: req.nextUrl.searchParams.get("ballot_type") || undefined,
    inductee: parseBoolean(req.nextUrl.searchParams.get("inductee")),
    yearFrom: yearFrom ? Number.parseInt(yearFrom, 10) : undefined,
    yearTo: yearTo ? Number.parseInt(yearTo, 10) : undefined,
    limit,
    offset,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: offset + result.rows.length < result.total,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
