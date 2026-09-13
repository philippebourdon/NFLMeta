import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildStaffHistoryData, getStaffProfileData } from "@/lib/api-staff-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ staff_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { staff_key } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season_year");
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  const data = await getStaffProfileData(
    decodeURIComponent(staff_key),
    Number.isFinite(seasonYear as number) ? seasonYear : undefined,
  );
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "staff member not found");
  }

  return jsonWithRateLimit(auth, { data: buildStaffHistoryData(data) });
}

export const GET = withApiErrorHandling(handleGET);
