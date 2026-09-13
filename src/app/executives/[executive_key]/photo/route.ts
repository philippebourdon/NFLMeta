import { NextRequest, NextResponse } from "next/server";
import { denyWhenProdOnlyDisabled, requireAdminRouteAccess } from "@/lib/admin-auth";
import { uploadExecutivePhoto } from "@/lib/admin-data";

export const runtime = "nodejs";

function redirectToExecutive(req: NextRequest, executiveKey: string) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  const origin = host
    ? `${forwardedProto || req.nextUrl.protocol.replace(/:$/, "")}://${host}`
    : req.nextUrl.origin;
  const url = new URL(`/executives/${encodeURIComponent(executiveKey)}`, origin);
  return NextResponse.redirect(url, 303);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ executive_key: string }> },
) {
  const denied = denyWhenProdOnlyDisabled(req, {
    message: "Inline executive uploads are only available in development.",
  });
  if (denied) return denied;

  const unauthorized = await requireAdminRouteAccess(req);
  if (unauthorized) return unauthorized;

  const { executive_key } = await params;
  const decoded = decodeURIComponent(executive_key);
  const form = await req.formData();
  const fileValue = form.get("photo");
  const file = fileValue instanceof File ? fileValue : null;
  await uploadExecutivePhoto({ executiveKey: decoded, file });
  return redirectToExecutive(req, decoded);
}
