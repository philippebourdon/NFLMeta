"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendContactEmail } from "@/lib/contact-email";
import { assertEmailRateLimit, requestIpFromHeaders } from "@/lib/email-delivery";

function contactPath(search = ""): string {
  return `/contact${search}`;
}

function trimmed(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitContactFormAction(formData: FormData): Promise<void> {
  let redirectTarget = contactPath("?notice=submitted#contact-form");
  try {
    const requestHeaders = await headers();
    const sourceIp = requestIpFromHeaders(requestHeaders);
    const name = trimmed(formData.get("name"));
    const email = trimmed(formData.get("email")).toLowerCase();
    const company = trimmed(formData.get("company"));
    const topic = trimmed(formData.get("topic")) || "general";
    const message = trimmed(formData.get("message"));
    const website = trimmed(formData.get("website"));

    if (!name) throw new Error("Please add your name.");
    if (!validateEmail(email)) throw new Error("Please enter a valid email address.");
    if (!message) throw new Error("Please add enough detail so we can respond usefully.");
    if (message.length > 4000) throw new Error("Keep the message under 4,000 characters.");
    if (!website) {
      await assertEmailRateLimit({ kind: "contact_form", sourceIp, sourceEmail: email });

      const result = await sendContactEmail({ name, email, company, topic, message, sourceIp });
      if (!result.sent) {
        console.error("Contact email failed", {
          error: result.error || "Unknown send failure",
          email,
          topic,
          sourceIp,
        });
        throw new Error("Unable to send the message right now. Please email info@sportsdbx.com directly.");
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the contact message.";
    redirectTarget = contactPath(`?alert=${encodeURIComponent(message)}#contact-form`);
  }
  redirect(redirectTarget);
}
