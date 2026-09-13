"use client";

import { useState } from "react";
import type { BillingInterval } from "@/lib/customer-plans";
import SubmitButton from "../submit-button";
import styles from "./page.module.css";

type PlanChangeReviewActionProps = {
  action: (formData: FormData) => void | Promise<void>;
  plan: string;
  interval: BillingInterval;
  planName: string;
  currentPlanName: string;
  currentIntervalLabel: string;
  recurringPriceLabel: string;
  quotaLabel: string;
  effectSummary: string;
  prorationDate?: number | null;
  dueNowLabel?: string | null;
  nextRenewalLabel?: string | null;
  nextRenewalDateLabel?: string | null;
  paymentMethodSummary?: string | null;
  paymentMethodHref?: string | null;
  triggerLabel: string;
  alternateTriggerLabel?: string;
  confirmLabel: string;
  pendingLabel: string;
  buttonClassName: string;
};

export default function PlanChangeReviewAction({
  action,
  plan,
  interval,
  planName,
  currentPlanName,
  currentIntervalLabel,
  recurringPriceLabel,
  quotaLabel,
  effectSummary,
  prorationDate,
  dueNowLabel,
  nextRenewalLabel,
  nextRenewalDateLabel,
  paymentMethodSummary,
  paymentMethodHref,
  triggerLabel,
  alternateTriggerLabel,
  confirmLabel,
  pendingLabel,
  buttonClassName,
}: PlanChangeReviewActionProps) {
  const [reviewOpen, setReviewOpen] = useState(false);

  if (!reviewOpen) {
    return (
      <div className={styles.reviewTriggers}>
        <button type="button" className={buttonClassName} onClick={() => setReviewOpen(true)}>
          {triggerLabel}
        </button>
        {alternateTriggerLabel ? (
          <button type="button" className={styles.cancelAliasButton} onClick={() => setReviewOpen(true)}>
            {alternateTriggerLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.reviewCard}>
      <p className={styles.reviewLead}>Review subscription change before it is applied.</p>
      <div className={styles.reviewGrid}>
        <div className={styles.reviewRow}>
          <span>Current plan</span>
          <strong>{currentPlanName}</strong>
        </div>
        <div className={styles.reviewRow}>
          <span>Current cadence</span>
          <strong>{currentIntervalLabel}</strong>
        </div>
        <div className={styles.reviewRow}>
          <span>New plan</span>
          <strong>{planName}</strong>
        </div>
        <div className={styles.reviewRow}>
          <span>Recurring price</span>
          <strong>{recurringPriceLabel}</strong>
        </div>
        <div className={styles.reviewRow}>
          <span>Included quota</span>
          <strong>{quotaLabel}</strong>
        </div>
        {typeof dueNowLabel === "string" ? (
          <div className={styles.reviewRow}>
            <span>Due now</span>
            <strong>{dueNowLabel}</strong>
          </div>
        ) : null}
        {typeof nextRenewalLabel === "string" ? (
          <div className={styles.reviewRow}>
            <span>Next renewal amount</span>
            <strong>{nextRenewalLabel}</strong>
          </div>
        ) : null}
        {typeof nextRenewalDateLabel === "string" ? (
          <div className={styles.reviewRow}>
            <span>Next renewal date</span>
            <strong>{nextRenewalDateLabel}</strong>
          </div>
        ) : null}
        {paymentMethodSummary ? (
          <div className={styles.reviewRow}>
            <span>Payment method</span>
            <strong>{paymentMethodSummary}</strong>
          </div>
        ) : null}
      </div>
      <p className={styles.reviewText}>{effectSummary}</p>
      {paymentMethodHref ? (
        <div className={styles.reviewActions}>
          <a href={paymentMethodHref} className={styles.reviewCancelButton}>
            Update Payment Method
          </a>
        </div>
      ) : null}
      <form action={action} className={styles.reviewActions}>
        <input type="hidden" name="plan" value={plan} />
        <input type="hidden" name="interval" value={interval} />
        {typeof dueNowLabel === "string" ? <input type="hidden" name="prorationDate" value={String(prorationDate)} /> : null}
        <SubmitButton
          idleLabel={confirmLabel}
          pendingLabel={pendingLabel}
          className={buttonClassName}
        />
        <button type="button" className={styles.reviewCancelButton} onClick={() => setReviewOpen(false)}>
          Cancel
        </button>
      </form>
    </div>
  );
}
