"use client";

import Image from "next/image";
import { useState } from "react";
import type { RetentionOffer } from "@/lib/subscription-retention";
import RetentionChoices from "./retention-choices";
import type { BillingInterval } from "@/lib/customer-plans";
import SubmitButton from "../submit-button";
import styles from "./page.module.css";

type PlanChangeReviewActionProps = {
  retentionOffer?: RetentionOffer | null;
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
  retentionOffer,
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

  if (plan === "free" && retentionOffer) {
    // Use a conservative count of full monthly periods from the next renewal.
    // A month is at most 31 days; do not promise savings on already-paid time.
    const savesOverHalf = retentionOffer.choices.length > 0 && retentionOffer.choices.every(choice => {
      const fullMonths = Math.floor((Date.parse(choice.resumeAt) - Date.parse(retentionOffer.renewalAt)) / (31 * 86400 * 1000));
      return fullMonths * retentionOffer.monthlyAmount > choice.amount * 2;
    });
    return <div className={styles.retentionReview}>
      <div className={styles.retentionBrandHeader}>
        <div className={styles.retentionHeading}>
          <h3 className={styles.retentionGraphicTitle}><Image src="/brand/retention/before-you-go-yellow.png"
            width={2172} height={724} alt="Before you go" sizes="(max-width: 540px) 225px, 350px" loading="eager" /></h3>
          <p className={styles.retentionTicket}>Keep your {currentPlanName} access with one payment{savesOverHalf ? " and save over 50%." : "."}</p>
        </div>
        <Image className={styles.retentionOfferBadge} src="/brand/retention/special-offer-yellow.png"
          width={1254} height={1254} alt="NFLMeta special offer" sizes="(max-width: 540px) 112.5px, 162.5px" loading="eager" />
      </div>
      <RetentionChoices offer={retentionOffer} />
      <div className={styles.retentionExit}>
        <button type="button" className={styles.retentionSecondary} onClick={() => setReviewOpen(false)}>Keep monthly billing</button>
        <form action={action}>
          <input type="hidden" name="plan" value="free" />
          <input type="hidden" name="interval" value="month" />
          <SubmitButton idleLabel="Cancel subscription" pendingLabel="Canceling..." className={styles.retentionSecondary} />
        </form>
      </div>
      <p className={styles.retentionFinePrint}>Canceling stops renewal.{nextRenewalDateLabel ? ` Paid access stays until ${nextRenewalDateLabel}.` : " Paid access stays through your current paid period."}</p>
    </div>;
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
      <form id={plan === "free" ? "cancel-subscription-review" : undefined} action={action} className={styles.reviewActions}>
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
