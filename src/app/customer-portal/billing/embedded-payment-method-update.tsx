"use client";

import { FormEvent, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import styles from "./page.module.css";

type EmbeddedPaymentMethodUpdateProps = {
  accountEmail: string;
  accountName: string | null;
  currentPaymentMethodSummary: string | null;
  collectBillingAddress: boolean;
};

type IntentState = {
  clientSecret: string;
  publishableKey: string;
} | null;

function InnerPaymentMethodForm({
  accountEmail,
  accountName,
  collectBillingAddress,
}: {
  accountEmail: string;
  accountName: string | null;
  collectBillingAddress: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setError(null);
    const submission = await elements.submit();
    if (submission.error) {
      setError(submission.error.message || "Payment details are incomplete.");
      setSubmitting(false);
      return;
    }

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/customer-portal/billing?billing=payment-method-return`,
        payment_method_data: {
          billing_details: {
            email: accountEmail,
            ...(accountName ? { name: accountName } : {}),
          },
        },
      },
    });

    if (result.error) {
      setError(result.error.message || "Payment method update failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.embeddedCheckoutForm}>
      <div className={styles.paymentShell}>
        <PaymentElement
          options={{
            business: { name: "NFLMeta" },
            defaultValues: {
              billingDetails: {
                email: accountEmail,
                ...(accountName ? { name: accountName } : {}),
              },
            },
            paymentMethodOrder: ["card"],
            wallets: {
              applePay: "never",
              googlePay: "never",
              link: "never",
            },
            fields: {
              billingDetails: {
                email: "never",
                name: accountName ? "never" : "auto",
                address: collectBillingAddress ? "auto" : "if_required",
              },
            },
            layout: {
              type: "tabs",
              defaultCollapsed: false,
            },
          }}
        />
      </div>
      {error ? <p className="flash flash-error">{error}</p> : null}
      <button type="submit" className={styles.planButton} disabled={!stripe || !elements || submitting}>
        {submitting ? "Saving..." : "Save Payment Method"}
      </button>
    </form>
  );
}

export default function EmbeddedPaymentMethodUpdate({
  accountEmail,
  accountName,
  currentPaymentMethodSummary,
  collectBillingAddress,
}: EmbeddedPaymentMethodUpdateProps) {
  const [intent, setIntent] = useState<IntentState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripePromise = useMemo(
    () => (intent ? loadStripe(intent.publishableKey, {
      developerTools: {
        assistant: {
          enabled: false,
        },
      },
    }) : null),
    [intent],
  );

  async function begin() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/customer-portal/payment-method-intent", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Unable to start payment method update.");
      }
      setIntent({
        clientSecret: payload.clientSecret,
        publishableKey: payload.publishableKey,
      });
    } catch (caughtError) {
      setIntent(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start payment method update.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className={`${styles.sideCard} ${styles.priorityCard}`} id="payment-method-card">
      <span className={styles.sectionLabel}>Payment Method</span>
      <h2>Card On File</h2>
      <p className={styles.supporting}>
        Update the card on file for renewals and plan changes. We do not store your card details here. Stripe handles
        card storage and PCI-compliant processing.
      </p>
      <div className={styles.checkoutMeta}>
        <div className={styles.checkoutMetaRow}>
          <span>Current card</span>
          <strong>{currentPaymentMethodSummary || "No default payment method on file"}</strong>
        </div>
        <div className={styles.checkoutMetaRow}>
          <span>Billing email</span>
          <strong>{accountEmail}</strong>
        </div>
      </div>
      {!intent ? (
        <div className={styles.inlineForm}>
          <button type="button" className={styles.planButtonSecondary} onClick={begin} disabled={loading}>
            {loading ? "Loading..." : "Update Payment Method"}
          </button>
        </div>
      ) : null}
      {error ? <p className="flash flash-error">{error}</p> : null}
      {intent && stripePromise ? (
        <div className={styles.embeddedCheckoutCard}>
          <p className={styles.embeddedCheckoutIntro}>
            Enter the replacement card below. After Stripe confirms it, the new card becomes the default payment
            method for future renewals and subscription changes.
          </p>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: intent.clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#4ca2f2",
                  colorBackground: "#0b2238",
                  colorText: "#eff7ff",
                  colorDanger: "#f2a3a3",
                  borderRadius: "16px",
                },
              },
            }}
          >
            <InnerPaymentMethodForm
              accountEmail={accountEmail}
              accountName={accountName}
              collectBillingAddress={collectBillingAddress}
            />
          </Elements>
        </div>
      ) : null}
    </article>
  );
}
