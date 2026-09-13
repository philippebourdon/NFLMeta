import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerCareerStatsCatalog } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  return jsonWithRateLimit(auth, {
    data: getPlayerCareerStatsCatalog(),
  });
}

export const GET = withApiErrorHandling(handleGET);
