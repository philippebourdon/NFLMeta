"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeAuth, safeCurrentUser } from "@/lib/clerk-safe";
import { ensureClerkUserAccount } from "@/lib/customer-auth";
import { requestIpFromHeaders } from "@/lib/email-delivery";
import { createFeatureRequest, toggleFeatureRequestVote } from "@/lib/feature-requests";
import { sendFeatureRequestNotificationEmail } from "@/lib/request-email";

function requestBoardPath(search = ""): string {
  return `/requests${search}`;
}

const requestBoardSignInPath = "/sign-in?redirect_url=%2Frequests";

async function requireRequestActor() {
  const { value: authState } = await safeAuth();
  const { userId } = authState;
  if (!userId) {
    redirect(requestBoardSignInPath);
  }
  const { value: user } = await safeCurrentUser();
  if (!user) {
    redirect(requestBoardSignInPath);
  }
  return ensureClerkUserAccount(user);
}

export async function submitFeatureRequestAction(formData: FormData): Promise<void> {
  let redirectTarget = requestBoardPath();
  try {
    const sourceIp = requestIpFromHeaders(await headers());
    const actor = await requireRequestActor();
    const requestType = String(formData.get("request_type") || "feature");
    const title = String(formData.get("title") || "");
    const detail = String(formData.get("detail") || "");
    const requestId = await createFeatureRequest({
      userId: actor.userId,
      name: actor.name,
      email: actor.email,
      requestType,
      title,
      detail,
    });
    const emailResult = await sendFeatureRequestNotificationEmail({
      requestId,
      requestType,
      title,
      detail,
      requesterName: actor.name,
      requesterEmail: actor.email,
      sourceIp,
    });
    if (!emailResult.sent) {
      console.error("Feature request notification email failed", {
        requestId,
        error: emailResult.error || "Unknown send failure",
      });
    }
    revalidatePath("/requests");
    revalidatePath("/admin/requests");
    redirectTarget = !emailResult.sent
      ? requestBoardPath(
          `?notice=submitted&alert=${encodeURIComponent("Request saved, but the notification email could not be sent.")}#request-${requestId}`,
        )
      : requestBoardPath(`?notice=submitted#request-${requestId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit request.";
    redirectTarget = requestBoardPath(`?alert=${encodeURIComponent(message)}`);
  }
  redirect(redirectTarget);
}

export async function toggleFeatureRequestVoteAction(formData: FormData): Promise<void> {
  const actor = await requireRequestActor();
  const requestId = Number.parseInt(String(formData.get("request_id") || "0"), 10);
  await toggleFeatureRequestVote(requestId, actor.userId);
  revalidatePath("/requests");
  revalidatePath("/admin/requests");
}
