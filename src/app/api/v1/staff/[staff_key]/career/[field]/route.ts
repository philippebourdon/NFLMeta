import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildStaffCareerData, getStaffProfileData } from "@/lib/api-staff-data";
import { extractFieldValue } from "@/lib/api-slice-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ staff_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { staff_key, field } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season_year");
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  const data = await getStaffProfileData(
    decodeURIComponent(staff_key),
    Number.isFinite(seasonYear as number) ? seasonYear : undefined,
  );
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "staff member not found");
  }

  const extracted = extractFieldValue(buildStaffCareerData(data) as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported staff career field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
