import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { listLogoAssets, type LogoCategory } from "@/lib/asset-catalog";
import { assetOrigin } from "@/lib/request-origin";
import { withApiErrorHandling } from "@/lib/api-route-error";

const CATEGORIES: LogoCategory[] = ["team", "season", "super_bowl", "stadium"];

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

  const categoryRaw = (req.nextUrl.searchParams.get("category") || "all").trim().toLowerCase();
  const search = (req.nextUrl.searchParams.get("search") || "").trim().toLowerCase();
  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 1000);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);

  const categoryFilter = categoryRaw === "all" ? null : (categoryRaw as LogoCategory);
  if (categoryFilter && !CATEGORIES.includes(categoryFilter)) {
    return jsonApiError(auth, 400, "invalid_request", `invalid category; expected one of: all, ${CATEGORIES.join(", ")}`);
  }

  const origin = assetOrigin(req);
  const all = listLogoAssets()
    .filter((item) => (categoryFilter ? item.category === categoryFilter : true))
    .filter((item) => {
      if (!search) return true;
      const haystack = `${item.key} ${item.label} ${item.category}`.toLowerCase();
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
      categories: ["all", ...CATEGORIES],
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
