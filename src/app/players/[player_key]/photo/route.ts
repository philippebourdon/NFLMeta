import { NextRequest, NextResponse } from "next/server";
import { denyWhenProdOnlyDisabled, requireAdminRouteAccess } from "@/lib/admin-auth";
import { uploadPlayerHeadshot } from "@/lib/admin-data";
import { query } from "@/lib/db";

export const runtime = "nodejs";

function redirectToPlayer(req: NextRequest, playerKey: string) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  const origin = host
    ? `${forwardedProto || req.nextUrl.protocol.replace(/:$/, "")}://${host}`
    : req.nextUrl.origin;
  const url = new URL(`/players/${encodeURIComponent(playerKey)}`, origin);
  return NextResponse.redirect(url, 303);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ player_key: string }> },
) {
  const denied = denyWhenProdOnlyDisabled(req, {
    message: "Inline player uploads are only available in development.",
  });
  if (denied) return denied;

  const unauthorized = await requireAdminRouteAccess(req);
  if (unauthorized) return unauthorized;

  const { player_key } = await params;
  const decodedPlayerKey = decodeURIComponent(player_key);
  const playerRows = await query<{ id: number }>(
    "SELECT id FROM players WHERE player_key = $1 LIMIT 1",
    [decodedPlayerKey],
  );
  const player = playerRows[0];
  if (!player) {
    return redirectToPlayer(req, decodedPlayerKey);
  }

  const form = await req.formData();
  const fileValue = form.get("photo");
  const file = fileValue instanceof File ? fileValue : null;

  await uploadPlayerHeadshot({
    playerId: player.id,
    file,
  });

  return redirectToPlayer(req, decodedPlayerKey);
}
