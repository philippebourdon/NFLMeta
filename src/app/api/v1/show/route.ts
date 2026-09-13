import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildAssetUrl, getShowMetadata } from "@/lib/metadata-api";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const record = await getShowMetadata();
  if (!record) {
    return jsonApiError(auth, 404, "not_found", "show metadata not found");
  }

  return jsonWithRateLimit(auth, {
    data: {
      summary: record.summary,
      tagline: record.tagline,
      studio: record.studio,
      network: record.network,
      content_rating: record.content_rating,
      art_path: record.art_path,
      art_url: buildAssetUrl(req, record.art_path),
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
