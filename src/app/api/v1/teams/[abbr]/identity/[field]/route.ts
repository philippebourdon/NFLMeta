import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildTeamIdentityData, normalizeTeamIdentityField } from "@/lib/api-identity-fields";
import { getTeamIdentity } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(
  req: NextRequest,
  ctx: { params: Promise<{ abbr: string; field: string }> },
) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { abbr, field } = await ctx.params;
  const normalizedField = normalizeTeamIdentityField(field);
  if (!normalizedField) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported team identity field");
  }

  const data = await getTeamIdentity(abbr);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "team not found");
  }

  const identity = buildTeamIdentityData(data);
  return jsonWithRateLimit(auth, { data: { field: normalizedField, value: identity[normalizedField] ?? null } });
}

export const GET = withApiErrorHandling(handleGET);
