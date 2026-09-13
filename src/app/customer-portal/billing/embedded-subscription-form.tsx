"use client";

import { FormEvent, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import styles from "./page.module.css";

type EmbeddedSubscriptionFormProps = {
  clientSecret: string;
  publishableKey: string;
  accountEmail: string;
  accountName: string | null;
  collectBillingAddress: boolean;
};

function InnerPaymentForm({
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

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/customer-portal/billing?billing=success`,
        payment_method_data: {
          billing_details: {
            email: accountEmail,
            ...(accountName ? { name: accountName } : {}),
          },
        },
      },
    });

    if (result.error) {
      setError(result.error.message || "Payment confirmation failed.");
      setSubmitting(false);
      return;
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
        {submitting ? "Confirming..." : "Confirm Subscription"}
      </button>
    </form>
  );
}

export default function EmbeddedSubscriptionForm({
  clientSecret,
  publishableKey,
  accountEmail,
  accountName,
  collectBillingAddress,
}: EmbeddedSubscriptionFormProps) {
  const stripePromise = useMemo(
    () => loadStripe(publishableKey, {
      developerTools: {
        assistant: {
          enabled: false,
        },
      },
    }),
    [publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
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
      <InnerPaymentForm
        accountEmail={accountEmail}
        accountName={accountName}
        collectBillingAddress={collectBillingAddress}
      />
    </Elements>
  );
}
