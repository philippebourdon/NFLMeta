import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listTeamsWithGameCounts } from "@/lib/public-data";
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

  const search = (req.nextUrl.searchParams.get("search") || "").trim().toLowerCase();
  const conference = (req.nextUrl.searchParams.get("conference") || "").trim().toUpperCase();
  const division = (req.nextUrl.searchParams.get("division") || "").trim().toUpperCase();
  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 64, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);

  const all = await listTeamsWithGameCounts();
  const filtered = all.filter((team) => {
    if (conference && (team.conference || "").toUpperCase() !== conference) return false;
    if (division && (team.division || "").toUpperCase() !== division) return false;
    if (search) {
      const haystack = [team.abbr, team.city || "", team.nickname || "", team.fullName || ""].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
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
