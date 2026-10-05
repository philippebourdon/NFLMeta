"use client";

import { useState } from "react";
import EmbeddedSubscriptionForm from "./embedded-subscription-form";
import styles from "./page.module.css";
import type { BillingInterval } from "@/lib/customer-plans";

type EmbeddedPlanActionsProps = {
  plan: string;
  planName: string;
  allowYearly: boolean;
  monthlyPrice: string;
  yearlyPrice: string | null;
  quotaLabel: string;
  accountEmail: string;
  accountName: string | null;
  collectBillingAddress: boolean;
};

type IntentState = {
  clientSecret: string;
  publishableKey: string;
  interval: BillingInterval;
} | null;

export default function EmbeddedPlanActions({
  plan,
  planName,
  allowYearly,
  monthlyPrice,
  yearlyPrice,
  quotaLabel,
  accountEmail,
  accountName,
  collectBillingAddress,
}: EmbeddedPlanActionsProps) {
  const [intent, setIntent] = useState<IntentState>(null);
  const [reviewInterval, setReviewInterval] = useState<BillingInterval | null>(null);
  const [loadingInterval, setLoadingInterval] = useState<BillingInterval | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function begin(interval: BillingInterval) {
    setLoadingInterval(interval);
    setError(null);
    try {
      const response = await fetch("/api/customer-portal/subscription-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Unable to start embedded billing.");
      }
      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setIntent({
        clientSecret: payload.clientSecret,
        publishableKey: payload.publishableKey,
        interval,
      });
      setReviewInterval(null);
    } catch (caughtError) {
      setIntent(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start embedded billing.");
    } finally {
      setLoadingInterval(null);
    }
  }

  const reviewedInterval = reviewInterval || intent?.interval || null;
  const recurringPriceLabel = reviewedInterval === "year" && yearlyPrice
    ? `${yearlyPrice} per year`
    : `${monthlyPrice} per month`;

  return (
    <div className={styles.embeddedUpgradeWrap}>
      {!reviewInterval && !intent ? (
        <div className={styles.planActions}>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReviewInterval("month");
            }}
            className={styles.planButton}
            disabled={loadingInterval !== null}
          >
            {`Review ${planName} Monthly`}
          </button>
          {allowYearly ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setReviewInterval("year");
              }}
              className={styles.planButtonSecondary}
              disabled={loadingInterval !== null}
            >
              {`Review ${planName} Yearly`}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="flash flash-error">{error}</p> : null}
      {reviewInterval ? (
        <div className={styles.reviewCard}>
          <p className={styles.reviewLead}>Review the new subscription before Stripe payment begins.</p>
          <div className={styles.reviewGrid}>
            <div className={styles.reviewRow}>
              <span>Plan</span>
              <strong>{planName}</strong>
            </div>
            <div className={styles.reviewRow}>
              <span>Cadence</span>
              <strong>{reviewInterval === "year" ? "Yearly" : "Monthly"}</strong>
            </div>
            <div className={styles.reviewRow}>
              <span>Recurring price</span>
              <strong>{recurringPriceLabel}</strong>
            </div>
            <div className={styles.reviewRow}>
              <span>Included quota</span>
              <strong>{quotaLabel}</strong>
            </div>
          </div>
          <div className={styles.reviewActions}>
            <button
              type="button"
              onClick={() => begin(reviewInterval)}
              className={styles.planButton}
              disabled={loadingInterval !== null}
            >
              {loadingInterval === reviewInterval ? "Loading..." : "Continue To Payment"}
            </button>
            <button
              type="button"
              className={styles.reviewCancelButton}
              onClick={() => {
                setReviewInterval(null);
                setIntent(null);
              }}
              disabled={loadingInterval !== null}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {intent ? (
        <div className={styles.embeddedCheckoutCard}>
          <div className={styles.checkoutHeading}>
            <span className={styles.checkoutEyebrow}>Secure Payment Step</span>
            <h4>{planName} checkout</h4>
            <p>
              You stay inside NFLMeta for this step. Stripe only provides the encrypted card field and payment
              confirmation behind the scenes.
            </p>
          </div>
          <div className={styles.reviewGrid}>
            <div className={styles.reviewRow}>
              <span>Plan</span>
              <strong>{planName}</strong>
            </div>
            <div className={styles.reviewRow}>
              <span>Cadence</span>
              <strong>{intent.interval === "year" ? "Yearly" : "Monthly"}</strong>
            </div>
            <div className={styles.reviewRow}>
              <span>Recurring price</span>
              <strong>{intent.interval === "year" && yearlyPrice ? `${yearlyPrice} per year` : `${monthlyPrice} per month`}</strong>
            </div>
            <div className={styles.reviewRow}>
              <span>Included quota</span>
              <strong>{quotaLabel}</strong>
            </div>
          </div>
          <div className={styles.checkoutMeta}>
            <div className={styles.checkoutMetaRow}>
              <span>Billing email</span>
              <strong>{accountEmail}</strong>
            </div>
            <div className={styles.checkoutMetaRow}>
              <span>Payment methods</span>
              <strong>Card only in this embedded flow</strong>
            </div>
          </div>
          <p className={styles.embeddedCheckoutIntro}>
            Enter card details to start {planName} {intent.interval === "year" ? "Yearly" : "Monthly"}.
          </p>
          <EmbeddedSubscriptionForm
            clientSecret={intent.clientSecret}
            publishableKey={intent.publishableKey}
            accountEmail={accountEmail}
            accountName={accountName}
            collectBillingAddress={collectBillingAddress}
          />
        </div>
      ) : null}
    </div>
  );
}
