import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listAllStarGames } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const data = await listAllStarGames();
  return jsonWithRateLimit(auth, { data, meta: { returned: data.length } });
}

export const GET = withApiErrorHandling(handleGET);
