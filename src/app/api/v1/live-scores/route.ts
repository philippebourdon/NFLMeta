import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { toLiveScoreApiResponse } from "@/lib/live-score-api";
import { getLiveScoreSnapshot } from "@/lib/live-score-store";

export const dynamic = "force-dynamic";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const snapshot = await getLiveScoreSnapshot();
  return jsonWithRateLimit(auth, toLiveScoreApiResponse(snapshot), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export const GET = withApiErrorHandling(handleGET);
