import { NextRequest } from "next/server";
import { apiAuthErrorResponse, apiErrorBody, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { toLiveScoreApiResponse } from "@/lib/live-score-api";
import { getLiveScoreSnapshot } from "@/lib/live-score-store";
import { filterLiveScoreSnapshot, parseLiveScoreFilters } from "@/lib/live-score-filters";

export const dynamic = "force-dynamic";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  let filters;
  try {
    filters = parseLiveScoreFilters(req.nextUrl.searchParams);
  } catch (error) {
    return jsonWithRateLimit(auth, apiErrorBody(400, "invalid_request", error instanceof Error ? error.message : "Invalid live-score filters"), {
      status: 400, headers: { "Cache-Control": "private, no-store" },
    });
  }
  const snapshot = filterLiveScoreSnapshot(await getLiveScoreSnapshot(), filters);
  return jsonWithRateLimit(auth, toLiveScoreApiResponse(snapshot), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export const GET = withApiErrorHandling(handleGET);
