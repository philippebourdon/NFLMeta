import { NextRequest, NextResponse } from "next/server";
import { denyWhenProdOnlyDisabled, requireAdminRouteAccess } from "@/lib/admin-auth";
import { updatePlayerField, type EditablePlayerFieldKey } from "@/lib/admin-data";

export const runtime = "nodejs";

type Payload = {
  fieldKey?: EditablePlayerFieldKey;
  value?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ player_key: string }> },
) {
  const denied = denyWhenProdOnlyDisabled(req, {
    asJson: true,
    message: "Inline player edits are only available in development.",
  });
  if (denied) return denied;

  const unauthorized = await requireAdminRouteAccess(req, { asJson: true });
  if (unauthorized) return unauthorized;

  const { player_key } = await params;
  const payload = (await req.json().catch(() => null)) as Payload | null;

  if (!payload?.fieldKey || typeof payload.value !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await updatePlayerField({
    playerKey: decodeURIComponent(player_key),
    fieldKey: payload.fieldKey,
    value: payload.value,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.alert || "Save failed." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
