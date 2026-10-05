"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { retentionDevPreview } from "@/lib/subscription-retention-preview";
import { safeCurrentUser, safeAuth } from "@/lib/clerk-safe";
import { deleteCustomerAccount, getCustomerPortalDataByClerkUserId, rotateCustomerApiKey } from "@/lib/customer-auth";
import { normalizeBillingPlan } from "@/lib/customer-plans";
import {
  cancelStripeBillingForAccountClosure,
  changeStripeSubscriptionPlan,
  createStripeCheckoutUrlForPlan,
  createRowPackCheckoutUrl,
} from "@/lib/stripe-billing";

async function requireClerkUserId(): Promise<string> {
  const { value } = await safeAuth();
  const { userId } = value;
  if (!userId) {
    redirect("/sign-in");
  }
  return userId;
}

export async function startCheckoutAction(formData: FormData): Promise<void> {
  const userId = await requireClerkUserId();
  const plan = normalizeBillingPlan(String(formData.get("plan") || "free"));
  const interval = String(formData.get("interval") || "month");
  const url = await createStripeCheckoutUrlForPlan(userId, plan, interval);
  redirect(url);
}

export async function purchaseRowPacksAction(formData: FormData): Promise<void> {
  const userId = await requireClerkUserId();
  const packs = Number(formData.get("packs"));
  const url = await createRowPackCheckoutUrl(userId, packs);
  redirect(url);
}

export async function switchPlanAction(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV === "development" && process.env.NFLMETA_RETENTION_PREVIEW_EMAIL) {
    const { value: previewUser } = await safeCurrentUser();
    if (retentionDevPreview(previewUser)) redirect("/customer-portal/billing?retention_preview=canceled");
  }
  const userId = await requireClerkUserId();
  const plan = normalizeBillingPlan(String(formData.get("plan") || "free"));
  const interval = String(formData.get("interval") || "month");
  const prorationDate = String(formData.get("prorationDate") || "").trim();
  try {
    await changeStripeSubscriptionPlan(userId, plan, interval, prorationDate || null);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      redirect("/customer-portal/billing?billing_error=payment-failed");
    }
    throw error;
  }
  redirect(`/customer-portal/billing?billing=${plan === "free" ? "downgraded" : "updated"}`);
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const userId = await requireClerkUserId();
  const confirmation = String(formData.get("confirmation") || "").trim().toUpperCase();
  if (confirmation !== "DELETE") {
    redirect("/customer-portal/billing?account_error=delete-confirm");
  }

  const portalData = await getCustomerPortalDataByClerkUserId(userId);
  if (portalData.subscription.provider === "stripe" && portalData.subscription.billingPlan !== "free") {
    redirect("/customer-portal/billing?account_error=cancel-billing-first");
  }

  await cancelStripeBillingForAccountClosure(userId);
  await deleteCustomerAccount(userId);
  redirect("/?account_deleted=1");
}

export async function rotateApiKeyAction(formData: FormData): Promise<void> {
  const userId = await requireClerkUserId();
  const confirmation = String(formData.get("confirmation") || "").trim().toUpperCase();
  if (confirmation !== "ROTATE") {
    redirect("/customer-portal?key=confirm");
  }
  await rotateCustomerApiKey(userId);
  redirect("/customer-portal?key=rotated");
}
