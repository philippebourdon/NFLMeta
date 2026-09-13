import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { CURATED_IMAGES } from "@/lib/asset-catalog";
import { assetOrigin } from "@/lib/request-origin";
import { withApiErrorHandling } from "@/lib/api-route-error";

type Group = "brand" | "players";
const GROUPS: Group[] = ["brand", "players"];

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

  const groupRaw = (req.nextUrl.searchParams.get("group") || "all").trim().toLowerCase();
  const search = (req.nextUrl.searchParams.get("search") || "").trim().toLowerCase();
  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 1000);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);

  const groupFilter = groupRaw === "all" ? null : (groupRaw as Group);
  if (groupFilter && !GROUPS.includes(groupFilter)) {
    return jsonApiError(auth, 400, "invalid_request", `invalid group; expected one of: all, ${GROUPS.join(", ")}`);
  }

  const origin = assetOrigin(req);
  const all = CURATED_IMAGES
    .filter((item) => (groupFilter ? item.group === groupFilter : true))
    .filter((item) => {
      if (!search) return true;
      const haystack = `${item.key} ${item.label} ${item.group}`.toLowerCase();
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
      groups: ["all", ...GROUPS],
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
