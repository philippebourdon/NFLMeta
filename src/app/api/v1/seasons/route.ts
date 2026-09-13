import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listSeasonsWithGameCounts } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);

  const yearsFrom = req.nextUrl.searchParams.get("year_from");
  const yearsTo = req.nextUrl.searchParams.get("year_to");
  const yearFrom = yearsFrom ? Number.parseInt(yearsFrom, 10) : null;
  const yearTo = yearsTo ? Number.parseInt(yearsTo, 10) : null;

  const all = await listSeasonsWithGameCounts();
  const filtered = all.filter((season) => {
    if (yearFrom != null && Number.isFinite(yearFrom) && season.year < yearFrom) return false;
    if (yearTo != null && Number.isFinite(yearTo) && season.year > yearTo) return false;
    return true;
  });

  const data = filtered.slice(offset, offset + limit);

  return jsonWithRateLimit(auth, {
    data,
    meta: {
      total: filtered.length,
      limit,
      offset,
      returned: data.length,
      has_more: offset + data.length < filtered.length,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
