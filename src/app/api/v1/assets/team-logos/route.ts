import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listTeamBrandAssets } from "@/lib/asset-catalog";
import { assetOrigin } from "@/lib/request-origin";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toAbsolute(origin: string, url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const abbr = (req.nextUrl.searchParams.get("abbr") || "").trim().toUpperCase();
  const search = (req.nextUrl.searchParams.get("search") || "").trim().toLowerCase();
  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 1000);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);

  const origin = assetOrigin(req);
  const all = listTeamBrandAssets("logo")
    .filter((item) => (abbr ? item.abbr === abbr : true))
    .filter((item) => {
      if (!search) return true;
      const haystack = `${item.abbr} ${item.team_name} ${item.label}`.toLowerCase();
      return haystack.includes(search);
    })
    .map((item) => ({ ...item, url: toAbsolute(origin, item.url) }));

  const data = all.slice(offset, offset + limit);

  return jsonWithRateLimit(auth, {
    data,
    meta: {
      total: all.length,
      limit,
      offset,
      returned: data.length,
      has_more: offset + data.length < all.length,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
