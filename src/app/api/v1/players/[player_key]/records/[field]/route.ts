import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { extractFieldValue } from "@/lib/api-slice-data";
import { getPlayerRecordsByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key, field } = await ctx.params;
  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "ALL").trim().toUpperCase();
  const seasonType = seasonTypeRaw === "REG" || seasonTypeRaw === "POST" || seasonTypeRaw === "ALL" ? seasonTypeRaw : null;
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const stats = (req.nextUrl.searchParams.get("stats") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const data = await getPlayerRecordsByKey(decodeURIComponent(player_key), { stats, seasonType });
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  const extracted = extractFieldValue(data as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported player records field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
