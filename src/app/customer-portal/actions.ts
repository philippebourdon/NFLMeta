"use server";

import { redirect } from "next/navigation";
import { safeAuth } from "@/lib/clerk-safe";
import { deleteCustomerAccount, getCustomerPortalDataByClerkUserId, rotateCustomerApiKey } from "@/lib/customer-auth";
import { normalizeBillingPlan } from "@/lib/customer-plans";
import {
  cancelStripeBillingForAccountClosure,
  changeStripeSubscriptionPlan,
  createStripeCheckoutUrlForPlan,
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

export async function switchPlanAction(formData: FormData): Promise<void> {
  const userId = await requireClerkUserId();
  const plan = normalizeBillingPlan(String(formData.get("plan") || "free"));
  const interval = String(formData.get("interval") || "month");
  const prorationDate = String(formData.get("prorationDate") || "").trim();
  await changeStripeSubscriptionPlan(userId, plan, interval, prorationDate || null);
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
