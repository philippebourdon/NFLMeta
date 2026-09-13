import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { getCoachesPayload } from "@/lib/metadata-api";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  return jsonWithRateLimit(auth, { data: await getCoachesPayload() });
}

export const GET = withApiErrorHandling(handleGET);
