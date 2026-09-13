function configuredAppOrigin(): string | null {
  const raw = process.env.NFLMETA_APP_URL?.trim()
    || process.env.NFLMETA_API_BASE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || "";
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function requestOrigin(request: Request): string {
  const configured = configuredAppOrigin();
  if (configured) return configured;

  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(/:$/, "") || "http";
  return `${proto}://${host}`;
}

export function assetOrigin(request: Request): string {
  const assetBase = process.env.NFLMETA_ASSET_BASE_URL?.trim().replace(/\/+$/, "");
  if (assetBase) return assetBase;
  return requestOrigin(request);
}

export function denyCrossOriginRequest(
  request: Request,
  options: { asJson?: boolean } = {},
): NextResponse | null {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return null;

  const supplied = request.headers.get("origin");
  let expected: string;
  try {
    expected = new URL(requestOrigin(request)).origin;
  } catch {
    expected = "";
  }

  if (supplied && supplied !== "null" && supplied === expected) return null;
  if (options.asJson) {
    return NextResponse.json({ ok: false, error: "Cross-origin request denied" }, { status: 403 });
  }
  return new NextResponse("Cross-origin request denied", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
import { NextResponse } from "next/server";
