import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayoffPicture } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const seasonRaw = req.nextUrl.searchParams.get("season");
  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;

  const payload = await getPlayoffPicture(Number.isFinite(season as number) ? season : undefined);
  if (!payload) {
    return jsonApiError(auth, 404, "not_found", "playoff picture unavailable");
  }

  return jsonWithRateLimit(auth, { data: payload });
}

export const GET = withApiErrorHandling(handleGET);
