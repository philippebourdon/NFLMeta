import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getStandings } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const seasonRaw = req.nextUrl.searchParams.get("season");
  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;

  const payload = await getStandings(Number.isFinite(season as number) ? season : undefined);
  if (!payload) {
    return jsonApiError(auth, 404, "not_found", "standings unavailable");
  }

  return jsonWithRateLimit(auth, { data: payload });
}

export const GET = withApiErrorHandling(handleGET);
