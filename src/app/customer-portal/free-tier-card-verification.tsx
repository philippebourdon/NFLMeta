"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import styles from "./page.module.css";

type IntentState = {
  clientSecret: string;
  publishableKey: string;
} | null;

export function InnerVerificationForm({
  accountEmail,
  accountName,
  collectBillingAddress,
  onRestart,
}: {
  accountEmail: string;
  accountName: string | null;
  collectBillingAddress: boolean;
  onRestart: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || !ready || inFlight.current || !mounted.current) {
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const submission = await elements.submit();
      if (!mounted.current) return;
      if (submission.error) {
        setError(submission.error.message || "Card details are incomplete.");
        return;
      }

      // confirmSetup, not confirmPayment: this stores the card and charges nothing.
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/customer-portal?verify=return`,
          payment_method_data: {
            billing_details: {
              email: accountEmail,
              ...(accountName ? { name: accountName } : {}),
            },
          },
        },
      });

      if (mounted.current && result.error) {
        setError(result.error.message || "Card verification failed.");
      }
    } catch {
      if (mounted.current) {
        setReady(false);
        setReloadRequired(true);
        setError("The secure card form could not be read. Reload the form and try again.");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.inlineForm}>
      <PaymentElement
        onReady={() => { setReady(true); setReloadRequired(false); setError(null); }}
        onLoadError={() => {
          setReady(false);
          setReloadRequired(true);
          setError("The secure card form could not load. Reload it to try again.");
        }}
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
      {error ? <p role="alert" className="flash flash-error">{error}</p> : null}
      {reloadRequired ? <button type="button" className={styles.primaryAction} onClick={onRestart} disabled={submitting}>Reload secure card form</button> : null}
      <button type="submit" className={styles.primaryAction} disabled={!stripe || !elements || !ready || submitting}>
        {submitting ? "Verifying..." : !ready ? "Waiting for secure card form..." : "Verify Card And Activate Key"}
      </button>
    </form>
  );
}

export default function FreeTierCardVerification({
  accountEmail,
  accountName,
  collectBillingAddress,
}: {
  accountEmail: string;
  accountName: string | null;
  collectBillingAddress: boolean;
}) {
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
      const response = await fetch("/api/customer-portal/free-tier-verification-intent", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Unable to start card verification.");
      }
      setIntent({
        clientSecret: payload.clientSecret,
        publishableKey: payload.publishableKey,
      });
    } catch (caughtError) {
      setIntent(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start card verification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className={styles.keyCard} id="verify-card">
      <span className={styles.sectionLabel}>Activation Required</span>
      <h2 className={styles.keyTitle}>Verify A Card To Activate Your Free Key</h2>
      <p>
        The Free plan stays free. NFLMeta asks for a card once so a key is tied to a real payment identity rather than
        a throwaway address. <strong>Nothing is charged now, and the Free plan never charges anything.</strong>
      </p>
      <p>
        Until a card is on file this account&rsquo;s API key returns <code>402 payment_method_required</code>.
      </p>
      {!intent ? (
        <div className={styles.actionRow}>
          <button type="button" className={styles.primaryAction} onClick={begin} disabled={loading}>
            {loading ? "Loading..." : "Add Card"}
          </button>
        </div>
      ) : null}
      {error ? <p className="flash flash-error">{error}</p> : null}
      {intent && stripePromise ? (
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
          <InnerVerificationForm
            accountEmail={accountEmail}
            accountName={accountName}
            collectBillingAddress={collectBillingAddress}
            onRestart={() => setIntent(null)}
          />
        </Elements>
      ) : null}
    </article>
  );
}
