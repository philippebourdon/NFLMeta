import { NextRequest, NextResponse } from "next/server";
import { denyWhenProdOnlyDisabled, requireAdminRouteAccess } from "@/lib/admin-auth";
import { uploadContributorPhoto } from "@/lib/admin-data";

export const runtime = "nodejs";

function redirectToContributor(req: NextRequest, contributorKey: string) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  const origin = host
    ? `${forwardedProto || req.nextUrl.protocol.replace(/:$/, "")}://${host}`
    : req.nextUrl.origin;
  const url = new URL(`/contributors/${encodeURIComponent(contributorKey)}`, origin);
  return NextResponse.redirect(url, 303);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contributor_key: string }> },
) {
  const denied = denyWhenProdOnlyDisabled(req, {
    message: "Inline contributor uploads are only available in development.",
  });
  if (denied) return denied;

  const unauthorized = await requireAdminRouteAccess(req);
  if (unauthorized) return unauthorized;

  const { contributor_key } = await params;
  const decoded = decodeURIComponent(contributor_key);
  const form = await req.formData();
  const fileValue = form.get("photo");
  const file = fileValue instanceof File ? fileValue : null;
  await uploadContributorPhoto({ contributorKey: decoded, file });
  return redirectToContributor(req, decoded);
}
