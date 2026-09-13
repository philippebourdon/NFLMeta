import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listVenuesReference } from "@/lib/reference-data";
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

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const yearRaw = req.nextUrl.searchParams.get("year");
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 1000);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 1000000);

  const rows = await listVenuesReference();
  const filtered = rows.filter((row) => {
    if (q) {
      const haystack = `${row.venueName} ${row.city || ""} ${row.state || ""} ${row.primaryTeams.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (year != null && Number.isFinite(year)) {
      if (row.firstYear != null && row.firstYear > year) return false;
      if (row.lastYear != null && row.lastYear < year) return false;
    }
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
