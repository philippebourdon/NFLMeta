import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { resolveTeamBrandAsset } from "@/lib/asset-catalog";
import { assetOrigin } from "@/lib/request-origin";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ abbr: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const origin = assetOrigin(req);
  const { abbr } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season");
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  const teamName = req.nextUrl.searchParams.get("team_name");
  const data = resolveTeamBrandAsset("wordmark", abbr, teamName, Number.isFinite(seasonYear as number) ? seasonYear : undefined);

  if (!data) {
    return jsonApiError(auth, 404, "not_found", "team wordmark not found");
  }

  return jsonWithRateLimit(auth, {
    data: {
      ...data,
      url: data.url.startsWith("http://") || data.url.startsWith("https://")
        ? data.url
        : `${origin}${data.url.startsWith("/") ? "" : "/"}${data.url}`,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
